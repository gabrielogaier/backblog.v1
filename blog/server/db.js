const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Carrega variáveis do blog/.env quando o módulo é importado diretamente.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const {
  PGHOST,
  PGPORT,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  PGSSLMODE,
} = process.env;

if (!PGHOST || !PGUSER || !PGDATABASE) {
  throw new Error('Configuração do banco inválida: defina PGHOST, PGUSER e PGDATABASE no .env');
}

const pool = new Pool({
  host: PGHOST,
  port: PGPORT ? Number(PGPORT) : 5432,
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
  ssl: PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('[db] conectado ao PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('[db] erro inesperado no pool', err);
});

const query = (text, params) => pool.query(text, params);

const closePool = () => pool.end();

module.exports = {
  pool,
  query,
  closePool,
};
