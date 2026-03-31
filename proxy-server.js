const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' })); // 提升上限以支持 base64 图片传输（vision 模型）

// TODO-016: Restrict CORS to known dev origins instead of wildcard '*'
// Allowed origins: Expo bundler (Metro) and Expo web dev server ports.
const ALLOWED_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];

// CORS headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Proxy to Hunyuan
app.post('/v1/chat/completions', async (req, res) => {
  // TODO-027: Validate Authorization header before forwarding to upstream API
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
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

const PORT = 3001;
// Bind to 0.0.0.0 so that native devices on the same LAN can reach the proxy.
// In production, use a proper backend instead of this dev proxy.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hunyuan proxy running on http://0.0.0.0:${PORT}`);
});
