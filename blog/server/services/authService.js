const argon2 = require('argon2');
const { OAuth2Client } = require('google-auth-library');
const { query, pool } = require('../db');
const config = require('../config');
const { generateToken, hashToken } = require('../utils/tokens');
const workspaceService = require('./workspaceService');
const mailerService = require('./mailerService');

const loginFailureReasons = Object.freeze({
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  PASSWORD_NOT_SET: 'PASSWORD_NOT_SET',
});

const registerFailureReasons = Object.freeze({
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_OR_EXPIRED_CODE: 'INVALID_OR_EXPIRED_CODE',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  MAIL_UNAVAILABLE: 'MAIL_UNAVAILABLE',
});

const googleLoginFailureReasons = Object.freeze({
  GOOGLE_NOT_CONFIGURED: 'GOOGLE_NOT_CONFIGURED',
  GOOGLE_AUTH_FAILED: 'GOOGLE_AUTH_FAILED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  GOOGLE_ALREADY_LINKED: 'GOOGLE_ALREADY_LINKED',
});

const googleAuthClient = new OAuth2Client();
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  emailVerified: Boolean(row.email_verified),
});

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeName(name, fallback = null) {
  if (typeof name !== 'string') {
    return fallback;
  }

  const normalized = name.trim().replace(/\s+/g, ' ').slice(0, 120);
  return normalized || fallback;
}

function generateVerificationCode() {
  const numeric = Math.floor(Math.random() * 1000000);
  return String(numeric).padStart(6, '0');
}

function hashVerificationCode(emailNormalized, code) {
  return hashToken(`register:${emailNormalized}:${code}`);
}

function isGoogleEmailVerified(value) {
  return value === true || value === 'true';
}

async function completeLoginForUser({ userRow, userAgent, ipAddress }) {
  const session = await createSession(userRow.id, { userAgent, ipAddress });
  await workspaceService.ensureUserWorkspace(userRow.id);
  await query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [userRow.id]);

  return {
    success: true,
    user: mapUser(userRow),
    session,
  };
}

async function login({ email, password, userAgent, ipAddress }) {
  const result = await query(
    `SELECT id, email, password_hash, name, role, email_verified
       FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1`,
    [email],
  );

  if (!result.rowCount) {
    return {
      success: false,
      reason: loginFailureReasons.INVALID_CREDENTIALS,
    };
  }

  const user = result.rows[0];

  if (!user.password_hash) {
    return {
      success: false,
      reason: loginFailureReasons.PASSWORD_NOT_SET,
    };
  }

  if (user.email_verified !== true) {
    return {
      success: false,
      reason: loginFailureReasons.EMAIL_NOT_VERIFIED,
    };
  }

  const passwordMatches = await argon2.verify(user.password_hash, password);

  if (!passwordMatches) {
    return {
      success: false,
      reason: loginFailureReasons.INVALID_CREDENTIALS,
    };
  }

  return completeLoginForUser({ userRow: user, userAgent, ipAddress });
}

async function requestRegistrationCode({ name, email, password }) {
  const trimmedEmail = String(email || '').trim();
  const normalizedEmail = normalizeEmail(trimmedEmail);

  await query('DELETE FROM registration_verifications WHERE expires_at <= NOW()');

  const existing = await query(
    `SELECT 1
       FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1`,
    [normalizedEmail],
  );

  if (existing.rowCount) {
    return {
      success: false,
      reason: registerFailureReasons.EMAIL_ALREADY_REGISTERED,
    };
  }

  const passwordHash = await argon2.hash(password);
  const verificationCode = generateVerificationCode();
  const expiresAt = new Date(Date.now() + config.auth.emailVerificationCodeTtlMinutes * 60 * 1000);

  await query(
    `INSERT INTO registration_verifications (
        email,
        email_normalized,
        name,
        password_hash,
        code_hash,
        expires_at,
        attempts,
        last_sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())
      ON CONFLICT (email_normalized)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        code_hash = EXCLUDED.code_hash,
        expires_at = EXCLUDED.expires_at,
        attempts = 0,
        last_sent_at = NOW(),
        updated_at = NOW()`,
    [
      trimmedEmail,
      normalizedEmail,
      sanitizeName(name, null),
      passwordHash,
      hashVerificationCode(normalizedEmail, verificationCode),
      expiresAt,
    ],
  );

  try {
    await mailerService.sendVerificationCodeEmail({
      to: trimmedEmail,
      code: verificationCode,
      expiresMinutes: config.auth.emailVerificationCodeTtlMinutes,
      displayName: sanitizeName(name, null),
    });
  } catch (_error) {
    await query('DELETE FROM registration_verifications WHERE email_normalized = $1', [normalizedEmail]);
    return {
      success: false,
      reason: registerFailureReasons.MAIL_UNAVAILABLE,
    };
  }

  return {
    success: true,
    expiresInMinutes: config.auth.emailVerificationCodeTtlMinutes,
  };
}

async function verifyRegistrationCodeAndCreateUser({ email, code }) {
  const normalizedEmail = normalizeEmail(email);
  const typedCode = String(code || '').trim();
  const client = await pool.connect();
  let insertedUser = null;

  try {
    await client.query('BEGIN');

    const pendingResult = await client.query(
      `SELECT id, email, name, password_hash, code_hash, expires_at, attempts
         FROM registration_verifications
        WHERE email_normalized = $1
        LIMIT 1
        FOR UPDATE`,
      [normalizedEmail],
    );

    if (!pendingResult.rowCount) {
      await client.query('ROLLBACK');
      return {
        success: false,
        reason: registerFailureReasons.INVALID_OR_EXPIRED_CODE,
      };
    }

    const pending = pendingResult.rows[0];

    if (pending.expires_at <= new Date()) {
      await client.query('DELETE FROM registration_verifications WHERE id = $1', [pending.id]);
      await client.query('COMMIT');
      return {
        success: false,
        reason: registerFailureReasons.INVALID_OR_EXPIRED_CODE,
      };
    }

    if (pending.attempts >= config.auth.emailVerificationMaxAttempts) {
      await client.query('DELETE FROM registration_verifications WHERE id = $1', [pending.id]);
      await client.query('COMMIT');
      return {
        success: false,
        reason: registerFailureReasons.TOO_MANY_ATTEMPTS,
      };
    }

    const expectedHash = hashVerificationCode(normalizedEmail, typedCode);
    if (expectedHash !== pending.code_hash) {
      const nextAttempts = pending.attempts + 1;
      await client.query(
        `UPDATE registration_verifications
            SET attempts = $2,
                updated_at = NOW()
          WHERE id = $1`,
        [pending.id, nextAttempts],
      );

      if (nextAttempts >= config.auth.emailVerificationMaxAttempts) {
        await client.query('DELETE FROM registration_verifications WHERE id = $1', [pending.id]);
      }

      await client.query('COMMIT');
      return {
        success: false,
        reason: registerFailureReasons.INVALID_OR_EXPIRED_CODE,
      };
    }

    const existingUser = await client.query(
      `SELECT 1
         FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1`,
      [normalizedEmail],
    );

    if (existingUser.rowCount) {
      await client.query('DELETE FROM registration_verifications WHERE id = $1', [pending.id]);
      await client.query('COMMIT');
      return {
        success: false,
        reason: registerFailureReasons.EMAIL_ALREADY_REGISTERED,
      };
    }

    const inserted = await client.query(
      `INSERT INTO users (name, email, password_hash, email_verified, email_verified_at, ai_daily_limit)
       VALUES ($1, $2, $3, true, NOW(), $4)
       RETURNING id, email, name, role, email_verified`,
      [pending.name || null, pending.email, pending.password_hash, config.openai.dailyLimitDefault],
    );

    insertedUser = inserted.rows[0];

    await client.query('DELETE FROM registration_verifications WHERE id = $1', [pending.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await workspaceService.ensureUserWorkspace(insertedUser.id);

  return {
    success: true,
    user: mapUser(insertedUser),
  };
}

async function verifyGoogleIdToken(idToken) {
  if (!config.auth.googleClientId) {
    return {
      success: false,
      reason: googleLoginFailureReasons.GOOGLE_NOT_CONFIGURED,
    };
  }

  try {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken,
      audience: config.auth.googleClientId,
    });

    const payload = ticket.getPayload();
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (!payload || !payload.sub || !payload.email) {
      return {
        success: false,
        reason: googleLoginFailureReasons.GOOGLE_AUTH_FAILED,
      };
    }

    if (!GOOGLE_ISSUERS.has(String(payload.iss || ''))) {
      return {
        success: false,
        reason: googleLoginFailureReasons.GOOGLE_AUTH_FAILED,
      };
    }

    if (!Number.isFinite(payload.exp) || Number(payload.exp) <= nowInSeconds) {
      return {
        success: false,
        reason: googleLoginFailureReasons.GOOGLE_AUTH_FAILED,
      };
    }

    if (!isGoogleEmailVerified(payload.email_verified)) {
      return {
        success: false,
        reason: googleLoginFailureReasons.EMAIL_NOT_VERIFIED,
      };
    }

    return {
      success: true,
      profile: {
        sub: String(payload.sub),
        email: String(payload.email),
        name: sanitizeName(payload.name, null),
      },
    };
  } catch (_error) {
    return {
      success: false,
      reason: googleLoginFailureReasons.GOOGLE_AUTH_FAILED,
    };
  }
}

async function loginWithGoogle({ idToken, userAgent, ipAddress }) {
  const verification = await verifyGoogleIdToken(idToken);

  if (!verification.success) {
    return verification;
  }

  const { sub, email, name } = verification.profile;
  const normalizedEmail = normalizeEmail(email);

  const byGoogleSub = await query(
    `SELECT id, email, password_hash, name, role, email_verified, google_sub
       FROM users
      WHERE google_sub = $1
      LIMIT 1`,
    [sub],
  );

  if (byGoogleSub.rowCount) {
    const user = byGoogleSub.rows[0];
    if (user.email_verified !== true) {
      return {
        success: false,
        reason: googleLoginFailureReasons.EMAIL_NOT_VERIFIED,
      };
    }

    return completeLoginForUser({ userRow: user, userAgent, ipAddress });
  }

  const byEmail = await query(
    `SELECT id, email, password_hash, name, role, email_verified, google_sub
       FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1`,
    [normalizedEmail],
  );

  if (byEmail.rowCount) {
    const user = byEmail.rows[0];

    if (user.email_verified !== true) {
      return {
        success: false,
        reason: googleLoginFailureReasons.EMAIL_NOT_VERIFIED,
      };
    }

    if (user.google_sub && user.google_sub !== sub) {
      return {
        success: false,
        reason: googleLoginFailureReasons.GOOGLE_ALREADY_LINKED,
      };
    }

    const alreadyLinkedElsewhere = await query(
      `SELECT id
         FROM users
        WHERE google_sub = $1
          AND id <> $2
        LIMIT 1`,
      [sub, user.id],
    );

    if (alreadyLinkedElsewhere.rowCount) {
      return {
        success: false,
        reason: googleLoginFailureReasons.GOOGLE_ALREADY_LINKED,
      };
    }

    if (!user.google_sub) {
      await query(
        `UPDATE users
            SET google_sub = $1,
                google_linked_at = COALESCE(google_linked_at, NOW()),
                updated_at = NOW()
          WHERE id = $2`,
        [sub, user.id],
      );
      user.google_sub = sub;
    }

    return completeLoginForUser({ userRow: user, userAgent, ipAddress });
  }

  const fallbackName = sanitizeName(name, sanitizeName(normalizedEmail.split('@')[0], 'Usuário'));
  const created = await query(
    `INSERT INTO users (
        email,
        password_hash,
        name,
        email_verified,
        email_verified_at,
        google_sub,
        google_linked_at,
        ai_daily_limit
      )
      VALUES ($1, NULL, $2, true, NOW(), $3, NOW(), $4)
      RETURNING id, email, name, role, email_verified, google_sub`,
    [email.trim(), fallbackName, sub, config.openai.dailyLimitDefault],
  );

  return completeLoginForUser({ userRow: created.rows[0], userAgent, ipAddress });
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
        u.role,
        u.email_verified
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
        u.role,
        u.email_verified
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
    `INSERT INTO users (name, email, password_hash, email_verified, email_verified_at, ai_daily_limit)
     VALUES ($1, $2, $3, true, NOW(), $4)
     RETURNING id, email, name, role, email_verified`,
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
  loginFailureReasons,
  registerFailureReasons,
  googleLoginFailureReasons,
  requestRegistrationCode,
  verifyRegistrationCodeAndCreateUser,
  loginWithGoogle,
  logout,
  getSessionByToken,
  refreshSession,
  registerUser,
  deleteAccount,
};
