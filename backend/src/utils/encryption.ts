import crypto from 'crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;

function deriveKey(): Buffer | null {
  if (!env.encryptionKey) return null;
  return crypto.scryptSync(env.encryptionKey, 'topdealsgh-totp-v1', 32);
}

/** Encrypt sensitive at-rest values (e.g. TOTP secrets). Returns plaintext when ENCRYPTION_KEY is unset (dev only). */
export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext.startsWith('enc:')) return ciphertext;

  const key = deriveKey();
  if (!key) {
    throw new Error('ENCRYPTION_KEY required to decrypt stored secrets');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted payload');

  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const data = Buffer.from(parts[3], 'hex');

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
