const { query } = require('../db');

const MAX_LIMIT = 50;

const mapRevision = (row) => ({
  id: row.id,
  postId: row.post_id,
  source: row.source,
  content: row.content,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
});

async function listRevisions(postId, { page = 1, limit = 20, source }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const params = [postId];
  let sourceClause = '';

  if (source) {
    params.push(source);
    sourceClause = `AND source = $${params.length}`;
  }

  const result = await query(
    `SELECT *
       FROM post_revisions
      WHERE post_id = $1
        ${sourceClause}
   ORDER BY created_at DESC
      LIMIT $${params.length + 1}
     OFFSET $${params.length + 2}`,
    [...params, safeLimit, offset],
  );

  return {
    data: result.rows.map(mapRevision),
    meta: {
      page: safePage,
      limit: safeLimit,
      count: result.rowCount,
    },
  };
}

async function getRevision(postId, revisionId) {
  const result = await query(
    `SELECT *
       FROM post_revisions
      WHERE post_id = $1
        AND id = $2
      LIMIT 1`,
    [postId, revisionId],
  );

  if (!result.rowCount) {
    return null;
  }

  return mapRevision(result.rows[0]);
}

module.exports = {
  listRevisions,
  getRevision,
};
