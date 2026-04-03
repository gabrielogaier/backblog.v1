const argon2 = require('argon2');
const { query, pool } = require('../db');
const config = require('../config');
const { generateToken, hashToken } = require('../utils/tokens');
const workspaceService = require('./workspaceService');

const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
});

async function login({ email, password, userAgent, ipAddress }) {
  const result = await query(
    `SELECT id, email, password_hash, name, role
       FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1`,
    [email],
  );

  if (!result.rowCount) {
    return null;
  }

  const user = result.rows[0];
  const passwordMatches = await argon2.verify(user.password_hash, password);

  if (!passwordMatches) {
    return null;
  }

  const session = await createSession(user.id, { userAgent, ipAddress });
  await workspaceService.ensureUserWorkspace(user.id);

  await query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

  return {
    user: mapUser(user),
    session,
  };
}

async function createSession(userId, { userAgent, ipAddress }) {
  const sessionToken = generateToken();
  const refreshToken = generateToken();
  const sessionTokenHash = hashToken(sessionToken);
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + config.session.ttlMs);
  const refreshExpiresAt = new Date(Date.now() + config.session.refreshTtlMs);

  await query(
    `INSERT INTO sessions (user_id, session_token_hash, refresh_token_hash, user_agent, ip_address, expires_at, refresh_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, sessionTokenHash, refreshTokenHash, userAgent || null, ipAddress || null, expiresAt, refreshExpiresAt],
  );

  return {
    sessionToken,
    refreshToken,
    expiresAt,
    refreshExpiresAt,
  };
}

async function logout(sessionToken) {
  if (!sessionToken) {
    return;
  }

  const tokenHash = hashToken(sessionToken);
  await query('DELETE FROM sessions WHERE session_token_hash = $1', [tokenHash]);
}

async function getSessionByToken(sessionToken) {
  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashToken(sessionToken);

  const result = await query(
    `SELECT
        s.id AS session_id,
        s.expires_at,
        s.refresh_expires_at,
        u.id,
        u.email,
        u.name,
        u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
    WHERE s.session_token_hash = $1
      AND s.expires_at > NOW()
    LIMIT 1`,
    [tokenHash],
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0];

  return {
    session: {
      id: row.session_id,
      expiresAt: row.expires_at,
      refreshExpiresAt: row.refresh_expires_at,
    },
    user: mapUser(row),
  };
}

async function refreshSession({ sessionToken, refreshToken, userAgent, ipAddress }) {
  if (!refreshToken) {
    return null;
  }

  const refreshHash = hashToken(refreshToken);

  const result = await query(
    `SELECT
        s.id AS session_id,
        s.expires_at,
        s.refresh_expires_at,
        u.id,
        u.email,
        u.name,
        u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
    WHERE s.refresh_token_hash = $1
    LIMIT 1`,
    [refreshHash],
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0];

  if (row.refresh_expires_at <= new Date()) {
    await query('DELETE FROM sessions WHERE id = $1', [row.session_id]);
    return null;
  }

  const newSessionToken = generateToken();
  const newRefreshToken = generateToken();
  const newSessionHash = hashToken(newSessionToken);
  const newRefreshHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + config.session.ttlMs);
  const refreshExpiresAt = new Date(Date.now() + config.session.refreshTtlMs);

  await query(
    `UPDATE sessions
        SET session_token_hash = $1,
            refresh_token_hash = $2,
            user_agent = $3,
            ip_address = $4,
            expires_at = $5,
            refresh_expires_at = $6
      WHERE id = $7`,
    [newSessionHash, newRefreshHash, userAgent || null, ipAddress || null, expiresAt, refreshExpiresAt, row.session_id],
  );

  return {
    user: mapUser(row),
    session: {
      sessionToken: newSessionToken,
      refreshToken: newRefreshToken,
      expiresAt,
      refreshExpiresAt,
    },
  };
}

async function registerUser({ name, email, password }) {
  const trimmedEmail = email.trim();
  const normalizedEmail = trimmedEmail.toLowerCase();

  const existing = await query(
    `SELECT 1
       FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1`,
    [normalizedEmail],
  );

  if (existing.rowCount) {
    return null;
  }

  const passwordHash = await argon2.hash(password);

  const result = await query(
    `INSERT INTO users (name, email, password_hash, ai_daily_limit)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role`,
    [name?.trim() || null, trimmedEmail, passwordHash, config.openai.dailyLimitDefault],
  );

  return mapUser(result.rows[0]);
}

async function deleteAccount(userId) {
  if (!userId) {
    throw new Error('userId inválido para exclusão.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM posts WHERE author_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await workspaceService.deleteUserWorkspace(userId);
}

module.exports = {
  login,
  logout,
  getSessionByToken,
  refreshSession,
  registerUser,
  deleteAccount,
};
