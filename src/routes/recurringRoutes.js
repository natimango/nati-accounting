const express = require('express');
const router = express.Router();
const { listTemplates, createTemplate, updateTemplate, deleteTemplate, spawnFromTemplate } = require('../controllers/recurringController');
const { authorize } = require('../middleware/auth');

router.use(authorize('manager', 'admin'));

router.get('/recurring/templates', listTemplates);
router.post('/recurring/templates', createTemplate);
router.patch('/recurring/templates/:template_id', updateTemplate);
router.delete('/recurring/templates/:template_id', authorize('admin'), deleteTemplate);
router.post('/recurring/templates/:template_id/spawn', spawnFromTemplate);

module.exports = router;
