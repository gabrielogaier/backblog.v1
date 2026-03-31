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

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(compression());
app.use(
  cors({
    origin: config.cors.origin,
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
