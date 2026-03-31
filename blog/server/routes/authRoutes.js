const express = require('express');
const authController = require('../controllers/authController');
const requireAuth = require('../middlewares/requireAuth');
const { loginLimiter, refreshLimiter } = require('../middlewares/authRateLimiters');

const router = express.Router();

router.post('/login', loginLimiter, authController.loginValidators, authController.login);
router.post('/refresh', refreshLimiter, authController.refresh);
router.get('/me', requireAuth, authController.me);
router.post('/logout', requireAuth, authController.logout);
router.delete('/account', requireAuth, authController.deleteAccount);

module.exports = router;
