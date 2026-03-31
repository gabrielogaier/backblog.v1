const { query } = require('../db');

async function getUserStats() {
  const result = await query(
    `SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(DISTINCT user_id) FROM sessions WHERE expires_at > NOW()) AS online_users`,
  );

  const row = result.rows[0] || {};

  return {
    totalUsers: Number(row.total_users) || 0,
    onlineUsers: Number(row.online_users) || 0,
  };
}

module.exports = {
  getUserStats,
};
