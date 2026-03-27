const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json({ limit: '10mb' })); // 提升上限以支持 base64 图片传输（vision 模型）

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-ASR-Secret-Id, X-ASR-Secret-Key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Proxy to Hunyuan
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const response = await fetch('https://api.hunyuan.cloud.tencent.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization,
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Tencent Cloud ASR Proxy — /api/transcribe
//
// Accepts: POST with JSON body { audio: "<base64>", format: "m4a" }
//   or credentials in headers X-ASR-Secret-Id / X-ASR-Secret-Key
//   (for development / Expo dev server use)
//
// TC3-HMAC-SHA256 signing is handled here server-side so that
// SecretId/SecretKey are never embedded in the mobile app bundle.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build TC3-HMAC-SHA256 signed request headers for Tencent Cloud APIs.
 * Reference: https://www.tencentcloud.com/document/product/1093/38347
 *
 * @param {string} secretId    - Tencent Cloud SecretId
 * @param {string} secretKey   - Tencent Cloud SecretKey
 * @param {string} service     - Service name, e.g. 'asr'
 * @param {string} action      - API action, e.g. 'SentenceRecognition'
 * @param {string} version     - API version, e.g. '2019-06-14'
 * @param {object} payload     - Request body as plain object
 * @param {string} [region]    - Region, defaults to 'ap-guangzhou'
 * @returns {{ url: string, headers: Record<string, string> }}
 */
function buildTencentSignedRequest(secretId, secretKey, service, action, version, payload, region = 'ap-guangzhou') {
  const host = `${service}.tencentcloudapi.com`;
  const algorithm = 'TC3-HMAC-SHA256';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // YYYY-MM-DD

  const body = JSON.stringify(payload);

  // Step 1: Canonical Request
  const hashedPayload = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = [
    'POST', '/', '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload,
  ].join('\n');

  // Step 2: String to Sign
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');

  // Step 3: Derive signing key and signature
  const secretDate    = crypto.createHmac('sha256', `TC3${secretKey}`).update(date, 'utf8').digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service, 'utf8').digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request', 'utf8').digest();
  const signature     = crypto.createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex');

  // Step 4: Authorization header
  const authorization =
    `${algorithm} Credential=${secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}`,
    headers: {
      'Content-Type':   'application/json; charset=utf-8',
      'Host':           host,
      'X-TC-Action':    action,
      'X-TC-Version':   version,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region':    region,
      'Authorization':  authorization,
    },
  };
}

app.post('/api/transcribe', async (req, res) => {
  try {
    // Credentials: from request headers (forwarded from mobile client)
    // In production, these should come from server-side env vars instead.
    const secretId  = req.headers['x-asr-secret-id']  || process.env.TENCENT_SECRET_ID;
    const secretKey = req.headers['x-asr-secret-key'] || process.env.TENCENT_SECRET_KEY;

    if (!secretId || !secretKey) {
      return res.status(401).json({ error: '缺少腾讯云 ASR 凭证（SecretId/SecretKey）' });
    }

    const { audio, format = 'm4a' } = req.body;

    if (!audio) {
      return res.status(400).json({ error: '缺少 audio 字段（base64 编码）' });
    }

    // Tencent SentenceRecognition payload
    const payload = {
      EngSerViceType: '16k_zh',   // Mandarin 16kHz engine
      SourceType: 1,               // 1 = base64 inline
      VoiceFormat: format,
      Data: audio,
      DataLen: Buffer.from(audio, 'base64').length,
      FilterPunc: 0,               // Keep punctuation
      ConvertNumMode: 1,           // Smart number conversion
    };

    const { url, headers } = buildTencentSignedRequest(
      secretId, secretKey,
      'asr', 'SentenceRecognition', '2019-06-14',
      payload
    );

    const tcResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await tcResponse.json();

    // Tencent wraps all errors in Response.Error
    if (data.Response?.Error) {
      const { Code, Message } = data.Response.Error;
      // Map auth errors back to 401
      if (Code === 'AuthFailure' || Code === 'AuthFailure.InvalidSecretId') {
        return res.status(401).json({ error: `认证失败: ${Message}` });
      }
      // Rate limit
      if (Code === 'RequestLimitExceeded') {
        return res.status(429).json({ error: `频率超限: ${Message}` });
      }
      return res.status(500).json({ error: `${Code}: ${Message}` });
    }

    const text = data.Response?.Result ?? '';
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hunyuan proxy running on http://0.0.0.0:${PORT}`);
  console.log(`Tencent ASR proxy available at http://0.0.0.0:${PORT}/api/transcribe`);
});
