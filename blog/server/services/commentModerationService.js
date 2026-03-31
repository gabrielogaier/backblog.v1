const { query } = require('../db');

const COMMENT_STATUS = ['pending', 'approved', 'hidden'];
const MAX_LIMIT = 50;

function mapRow(row) {
  return {
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title,
    postSlug: row.post_slug,
    postYear: row.post_year,
    postMonth: row.post_month,
    authorName: row.author_name,
    authorEmail: row.author_email,
    content: row.content,
    status: row.status,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
  };
}

function buildFilters({ userId, status, search }) {
  const where = ['p.author_id = $1'];
  const params = [userId];

  if (status && COMMENT_STATUS.includes(status)) {
    params.push(status);
    where.push(`c.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const index = params.length;
    where.push(`(c.content ILIKE $${index} OR COALESCE(c.author_name, '') ILIKE $${index} OR p.title ILIKE $${index})`);
  }

  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function listComments({ userId, status, search, page = 1, limit = 10 }) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), MAX_LIMIT);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const { where, params } = buildFilters({ userId, status, search });

  const listQuery = `
    SELECT c.id, c.post_id, c.author_name, c.author_email, c.content, c.status, c.created_at,
           p.title AS post_title, p.slug AS post_slug, p.year AS post_year, p.month AS post_month
      FROM post_comments c
      JOIN posts p ON p.id = c.post_id
      ${where}
      ORDER BY c.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
  `;

  const countQuery = `
    SELECT COUNT(*)::INT AS total
      FROM post_comments c
      JOIN posts p ON p.id = c.post_id
      ${where}
  `;

  const [listResult, countResult] = await Promise.all([
    query(listQuery, [...params, safeLimit, offset]),
    query(countQuery, params),
  ]);

  return {
    data: listResult.rows.map(mapRow),
    meta: {
      page: safePage,
      limit: safeLimit,
      total: countResult.rows[0]?.total ?? 0,
    },
  };
}

async function updateCommentStatus({ commentId, userId, status }) {
  if (!COMMENT_STATUS.includes(status)) {
    const error = new Error('Status inválido.');
    error.status = 400;
    throw error;
  }

  const result = await query(
    `UPDATE post_comments c
        SET status = $1
      WHERE c.id = $2
        AND EXISTS (SELECT 1 FROM posts p WHERE p.id = c.post_id AND p.author_id = $3)
      RETURNING c.id, c.post_id, c.status`,
    [status, commentId, userId],
  );

  if (!result.rowCount) {
    return null;
  }

  return {
    id: result.rows[0].id,
    postId: result.rows[0].post_id,
    status: result.rows[0].status,
  };
}

module.exports = {
  COMMENT_STATUS,
  listComments,
  updateCommentStatus,
};
