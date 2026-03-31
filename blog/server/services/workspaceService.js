const fs = require('fs/promises');
const path = require('path');
const { query } = require('../db');
const config = require('../config');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureBaseDir() {
  await Promise.all([
    ensureDir(config.storage.publicRoot),
    ensureDir(config.storage.privateRoot),
  ]);
}

function getDefaultPrivateWorkspacePath(userId) {
  return path.join(config.storage.privateRoot, String(userId));
}

function getLegacyPublicWorkspacePath(userId) {
  return path.join(config.storage.publicRoot, String(userId));
}

async function ensureUserWorkspace(userId) {
  if (!userId) {
    throw new Error('userId obrigatório para criar workspace.');
  }

  await ensureBaseDir();

  const existing = await query('SELECT root_path FROM user_workspaces WHERE user_id = $1', [userId]);
  const defaultPrivatePath = getDefaultPrivateWorkspacePath(userId);
  const legacyPublicPath = getLegacyPublicWorkspacePath(userId);

  if (existing.rowCount) {
    const existingPath = existing.rows[0].root_path;
    const normalizedExistingPath = path.resolve(existingPath);
    const normalizedLegacyPath = path.resolve(legacyPublicPath);

    // Migração de hardening: workspace interno deve sair do diretório público.
    if (normalizedExistingPath === normalizedLegacyPath) {
      await ensureDir(defaultPrivatePath);
      await query('UPDATE user_workspaces SET root_path = $2 WHERE user_id = $1', [userId, defaultPrivatePath]);
      return defaultPrivatePath;
    }

    await ensureDir(existingPath);
    return existingPath;
  }

  const rootPath = defaultPrivatePath;
  await ensureDir(rootPath);

  await query(
    `INSERT INTO user_workspaces (user_id, root_path)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET root_path = EXCLUDED.root_path`,
    [userId, rootPath],
  );

  return rootPath;
}

function getWorkspacePath(userId, ...segments) {
  if (!userId) {
    throw new Error('userId obrigatório para montar path do workspace.');
  }
  return path.join(config.storage.privateRoot, String(userId), ...segments);
}

async function ensureUserPublicWorkspace(userId) {
  if (!userId) {
    throw new Error('userId obrigatório para criar workspace público.');
  }

  await ensureBaseDir();
  const publicPath = getLegacyPublicWorkspacePath(userId);
  await ensureDir(publicPath);
  return publicPath;
}

async function deleteUserWorkspace(userId) {
  if (!userId) {
    return;
  }

  const result = await query('SELECT root_path FROM user_workspaces WHERE user_id = $1', [userId]);
  const storedPath = result.rows[0]?.root_path;
  const fallbackPrivatePath = getDefaultPrivateWorkspacePath(userId);
  const publicPath = getLegacyPublicWorkspacePath(userId);
  const targets = [storedPath, fallbackPrivatePath, publicPath].filter(Boolean);

  // Remove todo conteúdo associado ao usuário (interno e público).
  await Promise.all(
    targets.map(async (target) => {
      try {
        await fs.rm(target, { recursive: true, force: true });
      } catch (error) {
        console.error('[workspace] falha ao remover workspace do usuário', error);
      }
    }),
  );
}

module.exports = {
  ensureUserWorkspace,
  ensureUserPublicWorkspace,
  getWorkspacePath,
  deleteUserWorkspace,
};
