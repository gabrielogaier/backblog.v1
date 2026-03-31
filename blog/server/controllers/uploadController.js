const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const config = require('../config');
const workspaceService = require('../services/workspaceService');

const MAX_IMAGE_SIZE = config.upload.maxImageSizeBytes;
const allowedMimeTypes = config.upload.allowedImageMimeTypes;

const MIME_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function detectMimeTypeFromBuffer(fileBuffer) {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    fileBuffer[0] === 0x89 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x4e &&
    fileBuffer[3] === 0x47 &&
    fileBuffer[4] === 0x0d &&
    fileBuffer[5] === 0x0a &&
    fileBuffer[6] === 0x1a &&
    fileBuffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: RIFF....WEBP
  if (
    fileBuffer[0] === 0x52 &&
    fileBuffer[1] === 0x49 &&
    fileBuffer[2] === 0x46 &&
    fileBuffer[3] === 0x46 &&
    fileBuffer[8] === 0x57 &&
    fileBuffer[9] === 0x45 &&
    fileBuffer[10] === 0x42 &&
    fileBuffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // GIF: GIF87a/GIF89a
  if (
    fileBuffer[0] === 0x47 &&
    fileBuffer[1] === 0x49 &&
    fileBuffer[2] === 0x46 &&
    fileBuffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  return null;
}

async function safelyDeleteFile(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // Evita falha cascata ao limpar upload inválido.
  }
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    workspaceService
      .ensureUserPublicWorkspace(req.user.id)
      .then((dir) => cb(null, dir))
      .catch((err) => cb(err));
  },
  filename(_req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${timestamp}-${random}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Tipo de imagem não permitido.'));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
  },
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Imagem excede o tamanho máximo permitido.' });
    }

    if (error.message === 'Tipo de imagem não permitido.') {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  });
};

const validateImageSignature = async (req, res, next) => {
  if (!req.file?.path) {
    return next();
  }

  try {
    const fileBuffer = await fs.readFile(req.file.path);
    const detectedMimeType = detectMimeTypeFromBuffer(fileBuffer);

    if (!detectedMimeType || !allowedMimeTypes.includes(detectedMimeType)) {
      await safelyDeleteFile(req.file.path);
      return res.status(400).json({ message: 'Arquivo inválido. Envie uma imagem suportada.' });
    }

    const safeExtension = MIME_TO_EXTENSION[detectedMimeType];
    if (safeExtension) {
      const currentExt = path.extname(req.file.filename).toLowerCase();
      if (currentExt !== safeExtension) {
        const baseName = path.basename(req.file.filename, currentExt);
        const safeFilename = `${baseName}${safeExtension}`;
        const safePath = path.join(path.dirname(req.file.path), safeFilename);
        await fs.rename(req.file.path, safePath);
        req.file.filename = safeFilename;
        req.file.path = safePath;
      }
    }

    req.file.mimetype = detectedMimeType;
    return next();
  } catch (error) {
    await safelyDeleteFile(req.file.path);
    return next(error);
  }
};

const uploadImage = [
  handleUpload,
  validateImageSignature,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Arquivo não recebido.' });
    }

    const relativePath = path.relative(config.storage.publicRoot, req.file.path).replace(/\\/g, '/');
    const url = `/storage/${relativePath}`;

    return res.status(201).json({
      url,
      path: relativePath,
      size: req.file.size,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });
  },
];

module.exports = {
  uploadImage,
};
