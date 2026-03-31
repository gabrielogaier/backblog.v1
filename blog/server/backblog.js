const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');

require('./db'); // garante que o pool seja inicializado.

const app = express();

app.set('trust proxy', 1);
app.set('etag', config.isProduction ? 'weak' : false);

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

function isPrivateIpv4(hostname) {
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d{1,2})\./);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isDevelopmentOriginAllowed(origin) {
  try {
    const parsed = new URL(origin);
    const protocolAllowed = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    if (!protocolAllowed) return false;
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '::1'
      || isPrivateIpv4(hostname)
    );
  } catch {
    return false;
  }
}

const configuredCorsOrigins = new Set(
  (Array.isArray(config.cors.origin) ? config.cors.origin : [config.cors.origin])
    .map(normalizeOrigin)
    .filter(Boolean),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(compression());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (configuredCorsOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      if (!config.isProduction && isDevelopmentOriginAllowed(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  '/storage',
  express.static(config.storage.publicRoot, {
    dotfiles: 'deny',
    index: false,
    maxAge: config.isProduction ? '7d' : 0,
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(config.apiPrefix, routes);

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[api] erro não tratado', err);
  res.status(err.statusCode || 500).json({ message: err.message || 'Erro interno.' });
});

if (require.main === module) {
  const host = process.env.HOST || '0.0.0.0';
  app.listen(config.port, host, () => {
    console.log(`[backblog] API ouvindo em http://${host === '0.0.0.0' ? '0.0.0.0' : host}:${config.port}`);
  });
}

module.exports = app;
