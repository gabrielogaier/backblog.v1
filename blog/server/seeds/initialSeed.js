/* eslint-disable no-console */
const path = require('path');
const dotenv = require('dotenv');
const argon2 = require('argon2');
const { pool } = require('../db');

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const DEFAULT_INSTRUCTION = {
  title: 'Voz padrão do blog',
  body: [
    'Escreva em primeira pessoa, com tom reflexivo e direto ao ponto.',
    'Use parágrafos curtos, subtítulos em Markdown quando fizer sentido e conclua com um convite à ação simples.',
    'Mantenha consistência com publicações anteriores e priorize clareza sobre floreios.',
  ].join('\n'),
  priorityKeywords: ['ia', 'produtividade', 'reflexões'],
};

async function ensureAdminUser(client) {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no arquivo blog/.env antes de rodar o seed.');
  }

  const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  const existing = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);

  if (existing.rowCount) {
    const userId = existing.rows[0].id;
    await client.query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [userId, passwordHash],
    );
    return userId;
  }

  const inserted = await client.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [ADMIN_EMAIL, passwordHash, 'Administrador', 'admin'],
  );
  return inserted.rows[0].id;
}

async function ensureDefaultInstruction(client, ownerId) {
  const existingDefault = await client.query(
    'SELECT id FROM instructions WHERE owner_id = $1 AND is_default = true LIMIT 1',
    [ownerId],
  );

  if (existingDefault.rowCount) {
    const instructionId = existingDefault.rows[0].id;
    await client.query(
      `UPDATE instructions
         SET title = $1,
             body = $2,
             priority_keywords = $3,
             updated_at = NOW()
       WHERE id = $4`,
      [DEFAULT_INSTRUCTION.title, DEFAULT_INSTRUCTION.body, DEFAULT_INSTRUCTION.priorityKeywords, instructionId],
    );
    await ensureInstructionVersion(client, instructionId);
    return instructionId;
  }

  const inserted = await client.query(
    `INSERT INTO instructions (owner_id, title, body, priority_keywords, is_default)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`,
    [ownerId, DEFAULT_INSTRUCTION.title, DEFAULT_INSTRUCTION.body, DEFAULT_INSTRUCTION.priorityKeywords],
  );
  const instructionId = inserted.rows[0].id;
  await ensureInstructionVersion(client, instructionId);
  return instructionId;
}

async function ensureInstructionVersion(client, instructionId) {
  const hasVersion = await client.query(
    'SELECT 1 FROM instruction_versions WHERE instruction_id = $1 LIMIT 1',
    [instructionId],
  );

  if (hasVersion.rowCount) {
    return;
  }

  await client.query(
    `INSERT INTO instruction_versions (instruction_id, version_number, title, body)
     VALUES ($1, 1, $2, $3)`,
    [instructionId, DEFAULT_INSTRUCTION.title, DEFAULT_INSTRUCTION.body],
  );
}

async function runSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const adminId = await ensureAdminUser(client);
    const instructionId = await ensureDefaultInstruction(client, adminId);
    await client.query('COMMIT');
    console.log('[seed] Usuário admin pronto (id=%s) e instrução padrão (id=%s).', adminId, instructionId);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[seed] Falhou:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();
