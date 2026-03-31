const { pool, query } = require('../db');

const mapInstruction = (row) => ({
  id: row.id,
  ownerId: row.owner_id,
  title: row.title,
  body: row.body,
  priorityKeywords: row.priority_keywords || [],
  isDefault: row.is_default,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

async function listInstructions(ownerId) {
  const result = await query(
    `SELECT *
       FROM instructions
      WHERE owner_id = $1
   ORDER BY is_default DESC, updated_at DESC`,
    [ownerId],
  );

  return result.rows.map(mapInstruction);
}

async function getInstructionById(id, ownerId) {
  const result = await query('SELECT * FROM instructions WHERE id = $1 AND owner_id = $2', [id, ownerId]);
  if (!result.rowCount) {
    return null;
  }
  return mapInstruction(result.rows[0]);
}

async function createInstruction(payload, ownerId) {
  const {
    title,
    body,
    priorityKeywords = [],
    isDefault = false,
  } = payload;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (isDefault) {
      await client.query(
        'UPDATE instructions SET is_default = FALSE WHERE owner_id = $1 AND is_default = TRUE',
        [ownerId],
      );
    }

    const inserted = await client.query(
      `INSERT INTO instructions (owner_id, title, body, priority_keywords, is_default)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ownerId, title, body, priorityKeywords, isDefault],
    );

    const instruction = inserted.rows[0];

    await client.query(
      `INSERT INTO instruction_versions (instruction_id, version_number, title, body)
       VALUES ($1,
         COALESCE(
           (SELECT MAX(version_number) + 1 FROM instruction_versions WHERE instruction_id = $1),
           1
         ),
         $2,
         $3
       )`,
      [instruction.id, instruction.title, instruction.body],
    );

    await client.query('COMMIT');
    return mapInstruction(instruction);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateInstruction(id, payload, ownerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT * FROM instructions WHERE id = $1 AND owner_id = $2 FOR UPDATE',
      [id, ownerId],
    );
    if (!existing.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }

    if (payload.isDefault === true) {
      await client.query(
        'UPDATE instructions SET is_default = FALSE WHERE owner_id = $1 AND is_default = TRUE AND id <> $2',
        [ownerId, id],
      );
    }

    const current = existing.rows[0];
    const updated = await client.query(
      `UPDATE instructions
          SET title = $1,
              body = $2,
              priority_keywords = $3,
              is_default = $4,
              updated_at = NOW()
        WHERE id = $5
          AND owner_id = $6
        RETURNING *`,
      [
        payload.title || current.title,
        payload.body || current.body,
        Array.isArray(payload.priorityKeywords)
          ? payload.priorityKeywords
          : current.priority_keywords,
        payload.isDefault ?? current.is_default,
        id,
        ownerId,
      ],
    );

    if (payload.body || payload.title) {
      const fresh = updated.rows[0];
      await client.query(
        `INSERT INTO instruction_versions (instruction_id, version_number, title, body)
         VALUES ($1,
           COALESCE(
             (SELECT MAX(version_number) + 1 FROM instruction_versions WHERE instruction_id = $1),
             1
           ),
           $2,
           $3
         )`,
        [id, fresh.title, fresh.body],
      );
    }

    await client.query('COMMIT');
    return mapInstruction(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listInstructions,
  getInstructionById,
  createInstruction,
  updateInstruction,
};
