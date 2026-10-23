import { ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM with a 32-byte key from PLATFORM_SECRETS_KEY (base64). There is no
// fallback key: without it, secret storage is refused instead of weakly encrypted.
function key(): Buffer {
  const raw = process.env.PLATFORM_SECRETS_KEY;
  const decoded = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (decoded.length !== 32) throw new ServiceUnavailableException('Secret storage is not configured (PLATFORM_SECRETS_KEY must be 32 bytes, base64).');
  return decoded;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith('v1:')) throw new Error('Unknown secret format');
  const raw = Buffer.from(stored.slice(3), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}
