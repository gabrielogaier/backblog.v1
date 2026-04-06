const express = require('express');
const publicController = require('../controllers/publicController');
const postEngagementController = require('../controllers/postEngagementController');
const authController = require('../controllers/authController');
const { registerLimiter } = require('../middlewares/authRateLimiters');
const { publicLikeLimiter, publicCommentLimiter } = require('../middlewares/trafficRateLimiters');

const router = express.Router();

router.get('/posts', publicController.listPosts);
router.get('/posts/:year/:month/:slug/engagement', postEngagementController.getEngagement);
router.post('/posts/:year/:month/:slug/likes', publicLikeLimiter, postEngagementController.toggleLike);
router.get('/posts/:year/:month/:slug/comments', postEngagementController.listComments);
router.post('/posts/:year/:month/:slug/comments', publicCommentLimiter, postEngagementController.createComment);
router.get('/posts/:year/:month/:slug', publicController.getPost);
router.get('/settings', publicController.getSettings);
router.get('/stats/users', publicController.getUserStats);
router.get('/blogs/:slug/posts/:year/:month/:postSlug', publicController.getBlogPostBySlug);
router.get('/blogs/:slug', publicController.getBlogBySlug);
router.post('/register/request-code', registerLimiter, authController.registerValidators, authController.requestRegisterCode);
router.post('/register/verify-code', registerLimiter, authController.registerVerifyValidators, authController.verifyRegisterCode);
router.post('/register', registerLimiter, authController.registerValidators, authController.register);

module.exports = router;
