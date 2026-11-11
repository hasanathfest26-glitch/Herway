import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageService } from './storage.service';

describe('StorageService (Private Encrypted Document Vault)', () => {
  const storage = new StorageService();
  const samplePlain = Buffer.from('CONFIDENTIAL-PASSPORT-BYTES-123456', 'utf8');

  afterAll(async () => {
    await fs.rm(path.resolve(process.cwd(), '.storage_private', 'documents', 'test-user'), {
      recursive: true,
      force: true,
    });
  });

  it('rejects unsupported MIME types such as executables or scripts', async () => {
    await expect(
      storage.storePrivateEncryptedFile('documents', 'test-user', {
        buffer: Buffer.from('echo pwn'),
        mimetype: 'application/x-msdownload',
        size: 8,
        originalname: 'payload.exe',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('encrypts file bytes at rest with envelope AES-256-GCM and decrypts accurately', async () => {
    const stored = await storage.storePrivateEncryptedFile('documents', 'test-user', {
      buffer: samplePlain,
      mimetype: 'application/pdf',
      size: samplePlain.length,
      originalname: 'passport.pdf',
    });

    expect(stored.storageProvider).toBe('ENCRYPTED_LOCAL');
    const diskBytes = await fs.readFile(path.resolve(process.cwd(), '.storage_private', stored.storagePath));
    expect(diskBytes.toString('utf8')).not.toContain('CONFIDENTIAL-PASSPORT');

    const decrypted = await storage.readDecryptedFile({
      storageProvider: stored.storageProvider,
      storagePath: stored.storagePath,
      encryptedDek: stored.encryptedDek,
      iv: stored.iv,
      authTag: stored.authTag,
    });
    expect(decrypted.equals(samplePlain)).toBe(true);

    await storage.deleteStoredFile(stored.storageProvider, stored.storagePath);
  });
});
