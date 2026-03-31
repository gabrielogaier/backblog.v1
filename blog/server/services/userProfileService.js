const { pool, query } = require('../db');

const mapProfile = (row) => ({
  id: row.id,
  userId: row.user_id,
  displayName: row.display_name,
  slug: row.slug,
  shortDescription: row.short_description,
  aiInstruction: row.ai_instruction,
  alignment: row.ai_alignment || {},
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const alignmentLabels = {
  identityAuthor: "Identidade do autor",
  occupationPillars: "Ocupação e pilares",
  topics: "Tópicos dominados",
  toneStyle: "Tom e estilo",
  personality: "Personalidade e valores",
  hobbies: "Hobbies e histórias",
  avoid: "O que evitar",
  structure: "Estrutura preferida",
  objective: "Objetivo do blog",
};

function summarizeAlignment(alignment = {}) {
  return Object.entries(alignment)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => {
      const label = alignmentLabels[key] || key;
      return `${label}: ${value.trim()}.`;
    });
}

function buildInstruction({ displayName, slug, shortDescription, alignment }) {
  const lines = [
    `Você representa o autor ${displayName || "não identificado"}.`,
    shortDescription ? `Descrição breve: ${shortDescription}.` : "Nenhuma descrição breve foi fornecida.",
    slug ? `Os posts devem ser pensados para o domínio https://backblog.inf.br/${slug}.` : "Não há slug definido.",
    "Mantenha a escrita clara, pessoal e coerente com as respostas do autor.",
  ];

  const alignmentLines = summarizeAlignment(alignment);
  if (alignmentLines.length) {
    lines.push(...alignmentLines);
  }

  return lines.join(" ");
}

async function getProfileByUser(userId) {
  const result = await query('SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1', [userId]);
  if (!result.rowCount) {
    return null;
  }
  return mapProfile(result.rows[0]);
}

async function getProfileBySlug(slug) {
  if (!slug) {
    return null;
  }

  const normalizedSlug = String(slug).trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  const result = await query('SELECT * FROM user_profiles WHERE LOWER(slug) = LOWER($1) LIMIT 1', [normalizedSlug]);
  if (!result.rowCount) {
    return null;
  }

  return mapProfile(result.rows[0]);
}

async function upsertProfile(userId, payload) {
  const { displayName, slug, shortDescription, alignment } = payload;
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!normalizedSlug) {
    const error = new Error('Slug é obrigatório.');
    error.statusCode = 422;
    throw error;
  }

  const aiInstruction = buildInstruction({
    displayName,
    slug: normalizedSlug,
    shortDescription,
    alignment,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const slugConflict = await client.query(
      `SELECT 1
         FROM user_profiles
        WHERE LOWER(slug) = LOWER($1)
          AND user_id <> $2
        LIMIT 1`,
      [normalizedSlug, userId],
    );

    if (slugConflict.rowCount) {
      const error = new Error('Slug já está em uso por outra conta.');
      error.statusCode = 409;
      throw error;
    }

    const result = await client.query(
      `INSERT INTO user_profiles (user_id, display_name, slug, short_description, ai_instruction, ai_alignment)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             slug = EXCLUDED.slug,
             short_description = EXCLUDED.short_description,
             ai_instruction = EXCLUDED.ai_instruction,
             ai_alignment = EXCLUDED.ai_alignment,
             updated_at = NOW()
       RETURNING *`,
      [userId, displayName, normalizedSlug, shortDescription, aiInstruction, alignment || {}],
    );

    await client.query('COMMIT');
    return mapProfile(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getProfileByUser,
  getProfileBySlug,
  upsertProfile,
};
