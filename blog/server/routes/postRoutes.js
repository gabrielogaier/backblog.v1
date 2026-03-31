const express = require('express');
const postController = require('../controllers/postController');
const postRevisionController = require('../controllers/postRevisionController');
const aiLogController = require('../controllers/aiLogController');
const conversationController = require('../controllers/conversationController');
const conversationMessageController = require('../controllers/conversationMessageController');

const router = express.Router();

router.get('/', postController.listValidators, postController.list);
router.post('/', postController.baseBodyValidators, postController.create);
router.post('/:id/generate', postController.generateValidators, postController.generate);
router.get('/:id/conversations', conversationController.listValidators, conversationController.list);
router.post('/:id/conversations', conversationController.createValidators, conversationController.create);
router.get(
  '/:id/conversations/:conversationId/messages',
  conversationMessageController.listValidators,
  conversationMessageController.list,
);
router.post(
  '/:id/conversations/:conversationId/messages',
  conversationMessageController.createValidators,
  conversationMessageController.create,
);
router.get('/:id/revisions', postRevisionController.listValidators, postRevisionController.list);
router.get('/:id/revisions/:revisionId', postRevisionController.showValidators, postRevisionController.show);
router.get('/:id/generation-logs', aiLogController.listValidators, aiLogController.list);
router.get('/:id', postController.show);
router.put('/:id', postController.updateValidators, postController.update);
router.delete('/:id', postController.remove);

module.exports = router;
