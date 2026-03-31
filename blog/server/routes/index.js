const express = require('express');
const authRoutes = require('./authRoutes');
const requireAuth = require('../middlewares/requireAuth');
const postRoutes = require('./postRoutes');
const instructionRoutes = require('./instructionRoutes');
const settingsRoutes = require('./settingsRoutes');
const uploadRoutes = require('./uploadRoutes');
const publicRoutes = require('./publicRoutes');
const userProfileRoutes = require('./userProfileRoutes');
const commentRoutes = require('./commentRoutes');
const { ensureCsrfCookie, issueCsrfToken, requireCsrf } = require('../middlewares/csrf');

const router = express.Router();

router.get('/csrf-token', ensureCsrfCookie, issueCsrfToken);

router.use('/admin', ensureCsrfCookie, requireCsrf);
router.use('/public', ensureCsrfCookie, requireCsrf);

router.use('/admin/auth', authRoutes);
router.use('/admin/posts', requireAuth, postRoutes);
router.use('/admin/instructions', requireAuth, instructionRoutes);
router.use('/admin/settings', requireAuth, settingsRoutes);
router.use('/admin/uploads', requireAuth, uploadRoutes);
router.use('/admin/profile', requireAuth, userProfileRoutes);
router.use('/admin/comments', requireAuth, commentRoutes);
router.use('/public', publicRoutes);

module.exports = router;
