const { query } = require('../db');

const mapConversation = (row) => ({
  id: row.id,
  postId: row.post_id,
  ownerId: row.owner_id,
  title: row.title,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const mapMessage = (row) => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  metadata: row.metadata || null,
  createdAt: row.created_at.toISOString(),
});

async function listConversations(postId, ownerId) {
  const result = await query(
    `SELECT *
       FROM conversations
      WHERE post_id = $1
        AND owner_id = $2
   ORDER BY updated_at DESC`,
    [postId, ownerId],
  );

  return result.rows.map(mapConversation);
}

async function createConversation({ postId, ownerId, title }) {
  const result = await query(
    `INSERT INTO conversations (post_id, owner_id, title)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [postId, ownerId, title || 'Nova conversa'],
  );

  return mapConversation(result.rows[0]);
}

async function getConversation(conversationId) {
  const result = await query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
  return result.rowCount ? mapConversation(result.rows[0]) : null;
}

async function getConversationForUser(conversationId, ownerId) {
  const result = await query(
    `SELECT c.*
       FROM conversations c
      WHERE c.id = $1
        AND c.owner_id = $2
      LIMIT 1`,
    [conversationId, ownerId],
  );

  return result.rowCount ? mapConversation(result.rows[0]) : null;
}

async function touchConversation(conversationId) {
  await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);
}

async function listMessages(conversationId) {
  const result = await query(
    `SELECT *
       FROM conversation_messages
      WHERE conversation_id = $1
   ORDER BY created_at ASC`,
    [conversationId],
  );

  return result.rows.map(mapMessage);
}

async function addMessage({ conversationId, role, content, metadata }) {
  const result = await query(
    `INSERT INTO conversation_messages (conversation_id, role, content, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [conversationId, role, content, metadata || null],
  );

  await touchConversation(conversationId);
  return mapMessage(result.rows[0]);
}

module.exports = {
  listConversations,
  createConversation,
  getConversation,
  getConversationForUser,
  listMessages,
  addMessage,
};
