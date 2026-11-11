import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function resolveEncryptionKey(): Buffer {
  const hex = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DOCUMENT_ENCRYPTION_KEY missing or invalid in production');
  }
  const fallbackSecret = process.env.JWT_SECRET || 'herway-local-dev-key-do-not-use-in-prod';
  return crypto.createHash('sha256').update(fallbackSecret).digest();
}

export interface EncryptedPayload {
  cipherText: string;
  iv: string;
}

export function sha256Hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function encryptSensitiveValue(plainText: string): EncryptedPayload {
  const key = resolveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipherText: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

export function decryptSensitiveValue(cipherText: string, ivBase64: string): string {
  const key = resolveEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const raw = Buffer.from(cipherText, 'base64');
  const tag = raw.subarray(raw.length - 16);
  const payload = raw.subarray(0, raw.length - 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
}

/**
 * Envelope-encrypts raw file bytes with a random 256-bit Data Encryption Key (DEK),
 * then wraps the DEK using the platform master key.
 */
export function encryptFileBuffer(plainBuffer: Buffer): {
  encryptedBuffer: Buffer;
  encryptedDek: string;
  iv: string;
  authTag: string;
} {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
  const encryptedBuffer = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const wrappedDek = encryptSensitiveValue(dek.toString('hex'));

  return {
    encryptedBuffer,
    encryptedDek: `${wrappedDek.iv}:${wrappedDek.cipherText}`,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export function decryptFileBuffer(
  encryptedBuffer: Buffer,
  wrappedDek: string,
  ivBase64: string,
  authTagBase64: string,
): Buffer {
  const [dekIv, dekCipher] = wrappedDek.split(':');
  const dekHex = decryptSensitiveValue(dekCipher, dekIv);
  const dek = Buffer.from(dekHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, dek, Buffer.from(ivBase64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));
  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

export function generateOpaqueShareToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generateEncryptedDocumentKey(): { encryptedDek: string; iv: string } {
  const dek = crypto.randomBytes(32).toString('hex');
  const encrypted = encryptSensitiveValue(dek);
  return { encryptedDek: encrypted.cipherText, iv: encrypted.iv };
}
