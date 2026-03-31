const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const positiveNumberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const defaultStoragePublicRoot = process.env.STORAGE_PUBLIC_ROOT || process.env.STORAGE_ROOT || path.resolve(__dirname, '..', 'storage');
const defaultStoragePrivateRoot = process.env.STORAGE_PRIVATE_ROOT || path.resolve(__dirname, '..', 'storage_private');

const parseCorsOrigins = (value) => {
  if (!value) return ['http://localhost:3000'];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const parseCsv = (value, fallback) => {
  if (!value) return fallback;
  const parsed = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: numberFromEnv(process.env.PORT, 4010),
  apiPrefix: process.env.API_PREFIX || '/api',
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
  },
  cookies: {
    sessionName: process.env.SESSION_COOKIE_NAME || 'backblog.sid',
    refreshName: process.env.REFRESH_COOKIE_NAME || 'backblog.refresh',
  },
  csrf: {
    cookieName: process.env.CSRF_COOKIE_NAME || 'backblog.csrf',
    cookieMaxAgeMs: numberFromEnv(process.env.CSRF_COOKIE_MAX_AGE_MS, 24 * 60 * 60 * 1000),
    enforceOrigin: process.env.CSRF_ENFORCE_ORIGIN !== 'false',
  },
  session: {
    hours: numberFromEnv(process.env.SESSION_EXPIRATION_HOURS, 12),
    refreshDays: numberFromEnv(process.env.REFRESH_TOKEN_DAYS, 30),
  },
  storage: {
    root: defaultStoragePublicRoot,
    publicRoot: defaultStoragePublicRoot,
    privateRoot: defaultStoragePrivateRoot,
  },
  upload: {
    maxImageSizeBytes: positiveNumberFromEnv(process.env.UPLOAD_MAX_IMAGE_SIZE_BYTES, 5 * 1024 * 1024),
    allowedImageMimeTypes: parseCsv(process.env.UPLOAD_ALLOWED_IMAGE_MIME_TYPES, [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: Number.isFinite(Number(process.env.OPENAI_TEMPERATURE))
      ? Number(process.env.OPENAI_TEMPERATURE)
      : 0.7,
    maxTokens: numberFromEnv(process.env.OPENAI_MAX_TOKENS, 1200),
  },
  security: {
    rateLimit: {
      loginWindowMs: positiveNumberFromEnv(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      loginMax: positiveNumberFromEnv(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 10),
      refreshWindowMs: positiveNumberFromEnv(process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      refreshMax: positiveNumberFromEnv(process.env.AUTH_REFRESH_RATE_LIMIT_MAX, 30),
      registerWindowMs: positiveNumberFromEnv(process.env.AUTH_REGISTER_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
      registerMax: positiveNumberFromEnv(process.env.AUTH_REGISTER_RATE_LIMIT_MAX, 5),
      publicLikeWindowMs: positiveNumberFromEnv(process.env.PUBLIC_LIKE_RATE_LIMIT_WINDOW_MS, 60 * 1000),
      publicLikeMax: positiveNumberFromEnv(process.env.PUBLIC_LIKE_RATE_LIMIT_MAX, 20),
      publicCommentWindowMs: positiveNumberFromEnv(process.env.PUBLIC_COMMENT_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
      publicCommentMax: positiveNumberFromEnv(process.env.PUBLIC_COMMENT_RATE_LIMIT_MAX, 10),
      adminUploadWindowMs: positiveNumberFromEnv(process.env.ADMIN_UPLOAD_RATE_LIMIT_WINDOW_MS, 60 * 1000),
      adminUploadMax: positiveNumberFromEnv(process.env.ADMIN_UPLOAD_RATE_LIMIT_MAX, 20),
    },
    bruteForce: {
      windowMs: positiveNumberFromEnv(process.env.AUTH_BRUTE_FORCE_WINDOW_MS, 15 * 60 * 1000),
      maxFailuresPerIp: positiveNumberFromEnv(process.env.AUTH_BRUTE_FORCE_MAX_FAILURES_PER_IP, 20),
      maxFailuresPerEmail: positiveNumberFromEnv(process.env.AUTH_BRUTE_FORCE_MAX_FAILURES_PER_EMAIL, 8),
      blockDurationMs: positiveNumberFromEnv(process.env.AUTH_BRUTE_FORCE_BLOCK_DURATION_MS, 30 * 60 * 1000),
    },
  },
};

config.isProduction = config.env === 'production';
config.session.ttlMs = config.session.hours * 60 * 60 * 1000;
config.session.refreshTtlMs = config.session.refreshDays * 24 * 60 * 60 * 1000;

module.exports = config;
