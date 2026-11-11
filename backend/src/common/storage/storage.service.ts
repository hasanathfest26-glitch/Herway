import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { decryptFileBuffer, encryptFileBuffer } from '../utils/crypto.util';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface StoredEncryptedObject {
  storageProvider: 'SUPABASE_PRIVATE' | 'ENCRYPTED_LOCAL';
  storagePath: string;
  encryptedDek: string;
  iv: string;
  authTag: string;
  fileSizeBytes: number;
  mimeType: string;
  originalFilename: string;
}

@Injectable()
export class StorageService {
  private readonly localRoot = path.resolve(process.cwd(), '.storage_private');

  private getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key && !url.includes('your-project') && !key.includes('your-')) {
      return createClient(url, key);
    }
    return null;
  }

  validateFile(file: { mimetype: string; size: number; originalname: string }) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type (${file.mimetype}). Allowed: JPEG, PNG, WEBP, PDF.`,
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File size must be between 1 byte and 10 MB.');
    }
  }

  async storePrivateEncryptedFile(
    bucket: 'documents' | 'verification',
    ownerUserId: string,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ): Promise<StoredEncryptedObject> {
    this.validateFile(file);

    const safeExt = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const objectKey = `${ownerUserId}/${crypto.randomUUID()}${safeExt}.enc`;
    const { encryptedBuffer, encryptedDek, iv, authTag } = encryptFileBuffer(file.buffer);

    const supabase = this.getSupabaseClient();
    const bucketName =
      bucket === 'documents'
        ? process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS || 'travel-documents-private'
        : process.env.SUPABASE_STORAGE_BUCKET_VERIFICATION || 'verification-private';

    if (supabase) {
      let { error } = await supabase.storage
        .from(bucketName)
        .upload(objectKey, encryptedBuffer, {
          contentType: 'application/octet-stream',
          upsert: false,
        });

      if (error && /not found/i.test(error.message)) {
        await supabase.storage.createBucket(bucketName, { public: false });
        const retry = await supabase.storage
          .from(bucketName)
          .upload(objectKey, encryptedBuffer, {
            contentType: 'application/octet-stream',
            upsert: false,
          });
        error = retry.error;
      }

      if (!error) {
        return {
          storageProvider: 'SUPABASE_PRIVATE',
          storagePath: `${bucketName}/${objectKey}`,
          encryptedDek,
          iv,
          authTag,
          fileSizeBytes: file.size,
          mimeType: file.mimetype,
          originalFilename: path.basename(file.originalname),
        };
      }
    }

    // Encrypted private local storage fallback when Supabase keys are not configured
    const fullDiskPath = path.resolve(this.localRoot, bucket, objectKey);
    if (!fullDiskPath.startsWith(this.localRoot)) {
      throw new BadRequestException('Invalid storage path');
    }
    await fs.mkdir(path.dirname(fullDiskPath), { recursive: true });
    await fs.writeFile(fullDiskPath, encryptedBuffer);

    return {
      storageProvider: 'ENCRYPTED_LOCAL',
      storagePath: `${bucket}/${objectKey}`,
      encryptedDek,
      iv,
      authTag,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      originalFilename: path.basename(file.originalname),
    };
  }

  async readDecryptedFile(params: {
    storageProvider: string;
    storagePath: string;
    encryptedDek: string;
    iv: string;
    authTag: string;
  }): Promise<Buffer> {
    let encryptedBuffer: Buffer;

    if (params.storageProvider === 'SUPABASE_PRIVATE') {
      const supabase = this.getSupabaseClient();
      if (!supabase) throw new NotFoundException('Supabase storage credentials unavailable');
      const [bucketName, ...rest] = params.storagePath.split('/');
      const objectKey = rest.join('/');
      const { data, error } = await supabase.storage.from(bucketName).download(objectKey);
      if (error || !data) throw new NotFoundException('Private stored file not found');
      encryptedBuffer = Buffer.from(await data.arrayBuffer());
    } else {
      const fullDiskPath = path.resolve(this.localRoot, params.storagePath);
      if (!fullDiskPath.startsWith(this.localRoot)) {
        throw new BadRequestException('Invalid storage path');
      }
      encryptedBuffer = await fs.readFile(fullDiskPath);
    }

    return decryptFileBuffer(encryptedBuffer, params.encryptedDek, params.iv, params.authTag);
  }

  async deleteStoredFile(storageProvider: string, storagePath: string): Promise<void> {
    if (storageProvider === 'SUPABASE_PRIVATE') {
      const supabase = this.getSupabaseClient();
      if (!supabase) return;
      const [bucketName, ...rest] = storagePath.split('/');
      await supabase.storage.from(bucketName).remove([rest.join('/')]);
      return;
    }

    const fullDiskPath = path.resolve(this.localRoot, storagePath);
    if (fullDiskPath.startsWith(this.localRoot)) {
      await fs.rm(fullDiskPath, { force: true });
    }
  }
}
