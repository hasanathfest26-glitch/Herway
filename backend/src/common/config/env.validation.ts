import * as crypto from 'crypto';

const EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString('hex');

export function validateSecurityEnvironment(): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return;

  const jwt = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (!jwt || jwt.length < 32 || jwt.includes('change-me') || jwt.includes('your-')) {
    throw new Error(
      'FATAL SECURITY ERROR: A strong >=32 char JWT_SECRET or SUPABASE_JWT_SECRET is required in production.',
    );
  }

  const docKey = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!docKey || !/^[0-9a-fA-F]{64}$/.test(docKey) || docKey.startsWith('0123456789')) {
    throw new Error(
      'FATAL SECURITY ERROR: A non-default 64-hex-character DOCUMENT_ENCRYPTION_KEY is required in production.',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('FATAL SECURITY ERROR: DATABASE_URL must be configured in production.');
  }
}

export function getJwtSecret(): string {
  const configured = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT secret missing in production environment');
  }
  return EPHEMERAL_DEV_SECRET;
}

export function getAllowedCorsOrigins(): (string | RegExp)[] | boolean {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || raw.trim() === '') {
    return process.env.NODE_ENV === 'production'
      ? ['https://admin.herway.in', 'https://partner.herway.in', /\.vercel\.app$/]
      : true;
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .map((origin) => {
      if (origin.includes('*')) {
        const escaped = origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return new RegExp(`^${escaped}$`);
      }
      return origin;
    });
}
