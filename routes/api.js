const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const db = require('../db/init');

// Multer config for panel image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, req.app.locals.uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `panel-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// --- Panels CRUD ---

// List all panels
router.get('/panels', (req, res) => {
  const panels = db.prepare('SELECT * FROM panels ORDER BY created_at DESC').all();
  res.json(panels);
});

// Get single panel
router.get('/panels/:id', (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });
  res.json(panel);
});

// Create panel
router.post('/panels', upload.single('image'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Find next available marker value (0-63)
  const used = db.prepare('SELECT marker_value FROM panels ORDER BY marker_value').all()
    .map(r => r.marker_value);
  let marker = 0;
  while (used.includes(marker) && marker <= 63) marker++;
  if (marker > 63) return res.status(400).json({ error: 'All 64 marker slots are in use' });

  const imageFilename = req.file ? req.file.filename : null;

  const result = db.prepare(
    'INSERT INTO panels (name, description, image_filename, marker_value) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', imageFilename, marker);

  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(panel);
});

// Update panel
router.put('/panels/:id', upload.single('image'), (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const { name, description } = req.body;
  const imageFilename = req.file ? req.file.filename : panel.image_filename;

  db.prepare(
    'UPDATE panels SET name = ?, description = ?, image_filename = ? WHERE id = ?'
  ).run(name || panel.name, description !== undefined ? description : panel.description, imageFilename, panel.id);

  const updated = db.prepare('SELECT * FROM panels WHERE id = ?').get(panel.id);
  res.json(updated);
});

// Delete panel
router.delete('/panels/:id', (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  db.prepare('DELETE FROM panels WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Upload/replace panel image
router.post('/panels/:id/image', upload.single('image'), (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  db.prepare('UPDATE panels SET image_filename = ? WHERE id = ?').run(req.file.filename, panel.id);

  const updated = db.prepare('SELECT * FROM panels WHERE id = ?').get(panel.id);
  res.json(updated);
});

// --- Annotations CRUD ---

// Get annotations for a panel
router.get('/panels/:id/annotations', (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const annotations = db.prepare('SELECT * FROM annotations WHERE panel_id = ?').all(req.params.id);
  res.json(annotations);
});

// Create annotation
router.post('/panels/:id/annotations', (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const { x_percent, y_percent, label, description, color } = req.body;
  if (x_percent == null || y_percent == null || !label) {
    return res.status(400).json({ error: 'x_percent, y_percent, and label are required' });
  }

  const result = db.prepare(
    'INSERT INTO annotations (panel_id, x_percent, y_percent, label, description, color) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(panel.id, x_percent, y_percent, label, description || '', color || '#ff0000');

  const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(annotation);
});

// Update annotation
router.put('/annotations/:id', (req, res) => {
  const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id);
  if (!annotation) return res.status(404).json({ error: 'Annotation not found' });

  const { x_percent, y_percent, label, description, color } = req.body;

  db.prepare(
    'UPDATE annotations SET x_percent = ?, y_percent = ?, label = ?, description = ?, color = ? WHERE id = ?'
  ).run(
    x_percent != null ? x_percent : annotation.x_percent,
    y_percent != null ? y_percent : annotation.y_percent,
    label || annotation.label,
    description !== undefined ? description : annotation.description,
    color || annotation.color,
    annotation.id
  );

  const updated = db.prepare('SELECT * FROM annotations WHERE id = ?').get(annotation.id);
  res.json(updated);
});

// Delete annotation
router.delete('/annotations/:id', (req, res) => {
  const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(req.params.id);
  if (!annotation) return res.status(404).json({ error: 'Annotation not found' });

  db.prepare('DELETE FROM annotations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// --- QR Code Generation ---

router.get('/panels/:id/qrcode', async (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const viewUrl = `${baseUrl}/view/${panel.id}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(viewUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.json({ url: viewUrl, qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// --- Barcode Marker SVG Generation ---

// Generate a 3x3 barcode marker SVG for a given value (0-63)
router.get('/marker/:value.svg', (req, res) => {
  const value = parseInt(req.params.value, 10);
  if (isNaN(value) || value < 0 || value > 63) {
    return res.status(400).json({ error: 'Marker value must be 0-63' });
  }

  // 3x3 matrix: 6 bits → 9 cells but only inner 3x3 matters
  // The marker is a 5x5 grid: outer ring is black border, inner 3x3 is the pattern
  const bits = [];
  for (let i = 5; i >= 0; i--) {
    bits.push((value >> i) & 1);
  }

  // Map 6 bits to 3x3 grid (row by row, top-left to bottom-right)
  // Pad with 0s for the remaining 3 cells
  const grid = [
    [bits[0], bits[1], bits[2]],
    [bits[3], bits[4], bits[5]],
    [0, 0, 0] // parity/padding row
  ];

  // Build SVG: 5x5 grid (black border + 3x3 inner)
  const cellSize = 50;
  const totalSize = cellSize * 5;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}">`;
  // White background
  svg += `<rect x="0" y="0" width="${totalSize}" height="${totalSize}" fill="white"/>`;

  // Black border (outer ring)
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 || r === 4 || c === 0 || c === 4) {
        svg += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }

  // Inner 3x3 pattern
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const fill = grid[r][c] === 1 ? 'white' : 'black';
      svg += `<rect x="${(c + 1) * cellSize}" y="${(r + 1) * cellSize}" width="${cellSize}" height="${cellSize}" fill="${fill}"/>`;
    }
  }

  svg += '</svg>';

  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

module.exports = router;
