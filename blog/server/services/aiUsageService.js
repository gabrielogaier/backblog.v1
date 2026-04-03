const { query } = require('../db');
const config = require('../config');

function runQuery(client, text, params) {
  if (client) {
    return client.query(text, params);
  }
  return query(text, params);
}

function normalizeUsageDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function mapAiUsage(row) {
  const limit = Number(row.limit || 0);
  const requestCount = Number(row.request_count || 0);
  const remaining = Math.max(limit - requestCount, 0);
  return {
    usageDate: normalizeUsageDate(row.usage_date),
    limit,
    requestCount,
    remaining,
    reachedLimit: remaining <= 0,
  };
}

function buildLimitReachedError() {
  const error = new Error('Voce atingiu seu limite diario de uso da IA. Tente novamente amanha.');
  error.statusCode = 429;
  error.code = 'AI_DAILY_LIMIT_REACHED';
  return error;
}

async function getAiUsage(userId, client = null) {
  const result = await runQuery(
    client,
    `SELECT
        CURRENT_DATE AS usage_date,
        LEAST(COALESCE(u.ai_daily_limit, $2), $2) AS limit,
        COALESCE(adu.request_count, 0) AS request_count
       FROM users u
  LEFT JOIN ai_daily_usage adu
         ON adu.user_id = u.id
        AND adu.usage_date = CURRENT_DATE
      WHERE u.id = $1
      LIMIT 1`,
    [userId, config.openai.dailyLimitDefault],
  );

  if (!result.rowCount) {
    const error = new Error('Usuário não encontrado para consultar limite diário de IA.');
    error.statusCode = 404;
    throw error;
  }

  return mapAiUsage(result.rows[0]);
}

async function lockUserUsage(client, userId) {
  await runQuery(client, 'SELECT pg_advisory_xact_lock($1::bigint)', [userId]);
}

async function assertCanUseAi(client, userId) {
  const aiUsage = await getAiUsage(userId, client);
  if (aiUsage.reachedLimit) {
    const error = buildLimitReachedError();
    error.details = aiUsage;
    throw error;
  }
  return aiUsage;
}

async function incrementUsage(client, userId) {
  await runQuery(
    client,
    `INSERT INTO ai_daily_usage (user_id, usage_date, request_count)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (user_id, usage_date)
     DO UPDATE SET request_count = ai_daily_usage.request_count + 1`,
    [userId],
  );

  return getAiUsage(userId, client);
}

module.exports = {
  getAiUsage,
  lockUserUsage,
  assertCanUseAi,
  incrementUsage,
  buildLimitReachedError,
};
