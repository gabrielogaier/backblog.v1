const { query } = require('../db');

const mapPost = (row) => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  blogName: row.blog_name || 'Backblog',
  authorSlug: row.author_slug || null,
  excerpt: row.excerpt,
  contentRaw: row.content_raw,
  contentFinal: row.content_final,
  status: row.status,
  readingTimeMin: row.reading_time_min,
  publishedAt: row.published_at ? row.published_at.toISOString() : null,
  year: row.year,
  month: row.month,
  day: row.day,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  tags: row.tags || [],
});

const baseSelect = `
SELECT
  p.*,
  COALESCE(MAX(bs.blog_name), 'Backblog') AS blog_name,
  MAX(up.slug) AS author_slug,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'slug', t.slug)
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'
  ) AS tags
FROM posts p
LEFT JOIN blog_settings bs ON bs.user_id = p.author_id
LEFT JOIN user_profiles up ON up.user_id = p.author_id
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id
`;

const MAX_LIMIT = 50;

function buildWhere(filters) {
  const { year, month, tag, search, authorId } = filters;
  const conditions = ["p.status = 'published'"];
  const params = [];

  if (authorId) {
    params.push(Number(authorId));
    conditions.push(`p.author_id = $${params.length}`);
  }

  if (year) {
    params.push(Number(year));
    conditions.push(`p.year = $${params.length}`);
  }

  if (month) {
    params.push(Number(month));
    conditions.push(`p.month = $${params.length}`);
  }

  if (tag) {
    params.push(tag.toLowerCase());
    conditions.push(`EXISTS (
      SELECT 1 FROM post_tags pt2
      JOIN tags t2 ON t2.id = pt2.tag_id
      WHERE pt2.post_id = p.id
        AND (LOWER(t2.slug) = $${params.length} OR LOWER(t2.name) = $${params.length})
    )`);
  }

  if (search) {
    const searchValue = `%${search}%`;
    params.push(searchValue);
    const searchIndex = params.length;
    conditions.push(`
      (
        p.title ILIKE $${searchIndex}
        OR p.excerpt ILIKE $${searchIndex}
        OR p.content_raw ILIKE $${searchIndex}
        OR p.content_final ILIKE $${searchIndex}
      )
    `);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function listPublishedPosts(filters = {}) {
  const { clause, params } = buildWhere(filters);
  const safeLimit = Math.min(Math.max(Number(filters.limit) || 10, 1), MAX_LIMIT);
  const safePage = Math.max(Number(filters.page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const limitParamIndex = params.length + 1;
  const offsetParamIndex = params.length + 2;

  const result = await query(
    `${baseSelect}
     ${clause}
   GROUP BY p.id
   ORDER BY p.published_at DESC
   LIMIT $${limitParamIndex}
   OFFSET $${offsetParamIndex}`,
    [...params, safeLimit, offset],
  );

  return {
    data: result.rows.map(mapPost),
    meta: {
      page: safePage,
      limit: safeLimit,
      count: result.rowCount,
    },
  };
}

async function getPublishedPostByPermalink({ year, month, slug, authorId }) {
  const conditions = [
    "p.status = 'published'",
    'p.year = $1',
    'p.month = $2',
    'p.slug = $3',
  ];
  const params = [Number(year), Number(month), slug];

  if (authorId) {
    params.push(Number(authorId));
    conditions.push(`p.author_id = $${params.length}`);
  }

  const result = await query(
    `${baseSelect}
     WHERE ${conditions.join('\n       AND ')}
     GROUP BY p.id
     LIMIT 1`,
    params,
  );

  if (!result.rowCount) {
    return null;
  }

  return mapPost(result.rows[0]);
}

module.exports = {
  listPublishedPosts,
  getPublishedPostByPermalink,
};
