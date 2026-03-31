const { query } = require('../db');

const MAX_LIMIT = 50;

const mapLog = (row) => ({
  id: row.id,
  postId: row.post_id,
  instructionId: row.instruction_id,
  model: row.model,
  promptTokens: row.prompt_tokens,
  completionTokens: row.completion_tokens,
  costUsd: row.cost_usd,
  latencyMs: row.latency_ms,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

async function listLogs(postId, { page = 1, limit = 20, status }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const params = [postId];
  let statusClause = '';

  if (status) {
    params.push(status);
    statusClause = `AND status = $${params.length}`;
  }

  const result = await query(
    `SELECT *
       FROM ai_generation_logs
      WHERE post_id = $1
        ${statusClause}
   ORDER BY created_at DESC
      LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    [...params, safeLimit, offset],
  );

  return {
    data: result.rows.map(mapLog),
    meta: {
      page: safePage,
      limit: safeLimit,
      count: result.rowCount,
    },
  };
}

module.exports = {
  listLogs,
};
