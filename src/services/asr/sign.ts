/**
 * TC3-HMAC-SHA256 signing for Tencent Cloud APIs.
 * Uses @noble/hashes (pure JS) so it works on React Native without Node.js crypto.
 *
 * Reference: https://www.tencentcloud.com/document/product/1093/38347
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex } from '@noble/hashes/utils.js';

function sha256Hex(data: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(data)));
}

function hmacSha256(key: Uint8Array | string, data: string): Uint8Array {
  const keyBytes = typeof key === 'string'
    ? new TextEncoder().encode(key)
    : key;
  return hmac(sha256, keyBytes, new TextEncoder().encode(data));
}

function hmacSha256Hex(key: Uint8Array | string, data: string): string {
  return bytesToHex(hmacSha256(key, data));
}

export type SignedRequest = {
  url: string;
  headers: Record<string, string>;
};

/**
 * Build TC3-HMAC-SHA256 signed request headers for Tencent Cloud APIs.
 *
 * @param secretId    - Tencent Cloud SecretId
 * @param secretKey   - Tencent Cloud SecretKey
 * @param service     - Service name, e.g. 'asr'
 * @param action      - API action, e.g. 'SentenceRecognition'
 * @param version     - API version, e.g. '2019-06-14'
 * @param payload     - Request body as plain object
 * @param region      - Region, defaults to 'ap-guangzhou'
 */
export function buildTencentSignedRequest(
  secretId: string,
  secretKey: string,
  service: string,
  action: string,
  version: string,
  payload: Record<string, unknown>,
  region = 'ap-guangzhou',
): SignedRequest {
  const host = `${service}.tencentcloudapi.com`;
  const algorithm = 'TC3-HMAC-SHA256';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // YYYY-MM-DD

  const body = JSON.stringify(payload);

  // Step 1: Canonical Request
  const hashedPayload = sha256Hex(body);
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
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Step 3: Derive signing key and signature
  const secretDate    = hmacSha256(new TextEncoder().encode(`TC3${secretKey}`), date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature     = hmacSha256Hex(secretSigning, stringToSign);

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
