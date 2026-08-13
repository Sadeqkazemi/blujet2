import * as crypto from 'node:crypto';

const AGENCY_API_KEY_DOMAIN = 'blujet:agency-api-key:v1';

/**
 * Produces a deterministic lookup token without storing the raw API key.
 * The server-side PII key acts as a pepper and the domain prefix prevents
 * this digest from being reused across unrelated cryptographic contexts.
 */
export function hashAgencyApiKey(raw: string): string {
  const pepperHex = process.env.PII_ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-f]{64}$/i.test(pepperHex)) {
    throw new Error(
      'PII_ENCRYPTION_KEY must be 32 bytes of hex before API keys can be used',
    );
  }

  return crypto
    .createHmac('sha256', Buffer.from(pepperHex, 'hex'))
    .update(AGENCY_API_KEY_DOMAIN)
    .update('\0')
    .update(raw)
    .digest('hex');
}
