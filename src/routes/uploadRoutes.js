const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const {
  upload,
  uploadBill,
  getDocuments,
  getDocument,
  getDocumentHistory,
  getAuditLog,
  getVerificationSummary,
  deleteDocument,
  rerunAIForDocuments,
  recategorizeAllBills,
  getDocumentComments,
  createDocumentComment,
  deleteDocumentComment
} = require('../controllers/uploadController');
const { authorize } = require('../middleware/auth');

router.use(authorize('uploader', 'manager', 'admin'));

// Upload bill
router.post('/upload', upload.single('bill'), uploadBill);

// Verification snapshot summary
router.get('/documents/verification/summary', getVerificationSummary);

// Get all documents
router.get('/documents', getDocuments);

// Global audit log — must be before /:id to avoid route shadowing
router.get('/documents/audit-log', authorize('manager', 'admin'), getAuditLog);

// Get single document
router.get('/documents/:id', getDocument);

// Get document audit history
router.get('/documents/:id/history', getDocumentHistory);

// Document comments — static sub-paths before /:id routes
router.delete('/documents/comments/:comment_id', deleteDocumentComment);
router.get('/documents/:id/comments', getDocumentComments);
router.post('/documents/:id/comments', createDocumentComment);

// Delete document
router.delete('/documents/:id', deleteDocument);

// Re-run AI processing
router.post('/documents/reprocess', rerunAIForDocuments);

// Fix CoA categorization for all bills (no AI call, instant)
router.post('/documents/recategorize', authorize('manager', 'admin'), recategorizeAllBills);

async function serveFile(req, res, disposition) {
  const pool = require('../config/database');
  const { id } = req.params;
  const result = await pool.query('SELECT * FROM documents WHERE document_id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });

  const doc = result.rows[0];
  const user = req.user;
  // Non-admins/managers can only access files they uploaded
  if (!['admin', 'manager'].includes(user.role) && doc.uploaded_by !== user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(doc.file_path)) return res.status(404).json({ error: 'File not found on disk' });

  res.setHeader('Content-Type', doc.file_type);
  res.setHeader('Content-Disposition', `${disposition}; filename="${doc.file_name}"`);
  res.sendFile(path.resolve(doc.file_path));
}

// View/Download file
router.get('/files/:id', async (req, res) => {
  try { await serveFile(req, res, 'inline'); }
  catch (error) { console.error('Error serving file:', error); res.status(500).json({ error: 'Error serving file' }); }
});

// Download file (force download instead of preview)
router.get('/files/:id/download', async (req, res) => {
  try { await serveFile(req, res, 'attachment'); }
  catch (error) { console.error('Error downloading file:', error); res.status(500).json({ error: 'Error downloading file' }); }
});

module.exports = router;
