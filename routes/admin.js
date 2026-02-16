const express = require('express');
const router = express.Router();
const path = require('path');

const viewsDir = path.join(__dirname, '..', 'views');

// Landing page
router.get('/', (req, res) => {
  res.sendFile(path.join(viewsDir, 'index.html'));
});

// Admin dashboard
router.get('/admin', (req, res) => {
  res.sendFile(path.join(viewsDir, 'admin.html'));
});

// Annotation editor for a specific panel
router.get('/editor/:id', (req, res) => {
  res.sendFile(path.join(viewsDir, 'editor.html'));
});

// AR viewer for a specific panel
router.get('/view/:id', (req, res) => {
  res.sendFile(path.join(viewsDir, 'viewer.html'));
});

// Print page for a specific panel
router.get('/print/:id', (req, res) => {
  res.sendFile(path.join(viewsDir, 'print.html'));
});

// AR detection test page
router.get('/test', (req, res) => {
  res.sendFile(path.join(viewsDir, 'test.html'));
});

// Standalone barcode marker test page
router.get('/test-marker/:id', (req, res) => {
  res.sendFile(path.join(viewsDir, 'test-marker.html'));
});

module.exports = router;
