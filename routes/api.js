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
  // Use values with good visual contrast for reliable AR detection.
  // These are sorted by how many white inner cells they have (more = easier to detect).
  const preferredMarkers = [63,55,59,61,62,45,54,27,30,23,46,51,57,58,39,43,53,60,21,42,15,47,29,30,31];
  const used = db.prepare('SELECT marker_value FROM panels ORDER BY marker_value').all()
    .map(r => r.marker_value);
  let marker = preferredMarkers.find(m => !used.includes(m));
  if (marker == null) {
    // Fallback: find any available value
    marker = 0;
    while (used.includes(marker) && marker <= 63) marker++;
  }
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

// Update marker position on the panel photo
router.put('/panels/:id/marker-position', (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const { marker_x_percent, marker_y_percent } = req.body;
  if (marker_x_percent == null || marker_y_percent == null) {
    return res.status(400).json({ error: 'marker_x_percent and marker_y_percent are required' });
  }

  db.prepare('UPDATE panels SET marker_x_percent = ?, marker_y_percent = ? WHERE id = ?')
    .run(marker_x_percent, marker_y_percent, panel.id);

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
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.json({ url: viewUrl, qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// --- Pattern Marker Generation (QR code as AR marker) ---

// Helper: get QR module grid for a panel's view URL
function getQRGrid(panelId) {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const viewUrl = `${baseUrl}/view/${panelId}`;
  const qr = QRCode.create(viewUrl, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const grid = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      row.push(qr.modules.data[y * size + x] ? 1 : 0); // 1 = dark, 0 = light
    }
    grid.push(row);
  }
  return { grid, size, url: viewUrl };
}

// Resample a grid to a target size using nearest-neighbor
function resampleGrid(grid, fromSize, toSize) {
  const out = [];
  for (let y = 0; y < toSize; y++) {
    const row = [];
    for (let x = 0; x < toSize; x++) {
      const sx = Math.floor(x * fromSize / toSize);
      const sy = Math.floor(y * fromSize / toSize);
      row.push(grid[sy][sx]);
    }
    out.push(row);
  }
  return out;
}

// Rotate a grid 90° clockwise
function rotateGridCW(g) {
  const s = g.length;
  const out = [];
  for (let y = 0; y < s; y++) {
    const row = [];
    for (let x = 0; x < s; x++) {
      row.push(g[s - 1 - x][y]);
    }
    out.push(row);
  }
  return out;
}

// Generate .patt file for AR.js pattern marker from the QR code
// Format: 4 rotations, each with 3 channels in BGR order, each channel is 16x16 values
// Channel order and value padding match the official AR.js marker trainer (threex-arpatternfile.js)
router.get('/panels/:id/marker.patt', (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const { grid, size } = getQRGrid(panel.id);
  const pattSize = 16;
  const sampled = resampleGrid(grid, size, pattSize);

  let patt = '';
  let current = sampled;

  for (let rot = 0; rot < 4; rot++) {
    // 3 channels in BGR order (matches AR.js marker trainer: channelOffset 2,1,0)
    for (let ch = 0; ch < 3; ch++) {
      for (let y = 0; y < pattSize; y++) {
        const row = [];
        for (let x = 0; x < pattSize; x++) {
          // dark module = 0 (black), light module = 255 (white)
          // pad to 3 chars to match official .patt format
          const val = current[y][x] ? 0 : 255;
          row.push(String(val).padStart(3));
        }
        patt += row.join(' ') + '\n';
      }
    }
    patt += '\n';
    current = rotateGridCW(current);
  }

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(patt);
});

// Convert marker_value (0-63) to a 3x3 binary grid for ARToolKit barcode marker
// marker_value is used directly as a 9-bit pattern, row-by-row
// 1 = white cell, 0 = black cell (ARToolKit convention)
function markerValueToGrid(value) {
  // Only 6 bits used for 3x3 (values 0-63), but we read 9 bits row-by-row
  // The marker_value IS the minimum rotation reading, use directly as bit pattern
  const grid = [];
  for (let row = 0; row < 3; row++) {
    const r = [];
    for (let col = 0; col < 3; col++) {
      const bitIndex = 8 - (row * 3 + col); // bit8 is top-left
      r.push((value >> bitIndex) & 1);
    }
    grid.push(r);
  }
  return grid;
}

// Generate an SVG of the QR code with embedded barcode marker in center
// The QR code uses H-level error correction (30%) to survive the center replacement
// The barcode marker in center is what AR.js detects for 3D overlay
router.get('/panels/:id/marker.svg', (req, res) => {
  const panel = db.prepare('SELECT * FROM panels WHERE id = ?').get(req.params.id);
  if (!panel) return res.status(404).json({ error: 'Panel not found' });

  const { grid, size } = getQRGrid(panel.id);

  const moduleSize = 8; // pixels per QR module
  const qrPixels = size * moduleSize;
  const quietZone = Math.round(moduleSize * 2); // white margin outside QR
  const svgSize = qrPixels + quietZone * 2;

  // Barcode marker sizing (must match patternRatio: 0.5)
  // Inner 3x3 pattern = 50% of total barcode marker size
  const barcodeInner = 40; // 3x3 cells, ~13px each
  const barcodeBorder = 20; // border on each side (so total = inner + 2*border = 80)
  const barcodeTotal = barcodeInner + barcodeBorder * 2; // 80px
  const barcodeQuiet = moduleSize * 2; // 16px quiet zone around barcode
  const clearSize = barcodeTotal + barcodeQuiet * 2; // ~112px total cleared area

  // Center of QR code in pixel coords
  const qrCenter = qrPixels / 2;
  const clearStart = qrCenter - clearSize / 2;

  // Which QR modules fall in the cleared center area
  const clearModStart = Math.floor(clearStart / moduleSize);
  const clearModEnd = Math.ceil((clearStart + clearSize) / moduleSize);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="${svgSize}" height="${svgSize}">`;
  // White background
  svg += `<rect x="0" y="0" width="${svgSize}" height="${svgSize}" fill="white"/>`;

  // Draw QR modules, skipping the center area
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x >= clearModStart && x < clearModEnd && y >= clearModStart && y < clearModEnd) {
        continue; // skip center area
      }
      if (grid[y][x]) { // dark module
        svg += `<rect x="${quietZone + x * moduleSize}" y="${quietZone + y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }

  // Draw barcode marker in center
  const bcX = quietZone + qrCenter - barcodeTotal / 2;
  const bcY = quietZone + qrCenter - barcodeTotal / 2;

  // White quiet zone behind barcode
  svg += `<rect x="${bcX - barcodeQuiet}" y="${bcY - barcodeQuiet}" width="${barcodeTotal + barcodeQuiet * 2}" height="${barcodeTotal + barcodeQuiet * 2}" fill="white"/>`;

  // Black border of barcode marker
  svg += `<rect x="${bcX}" y="${bcY}" width="${barcodeTotal}" height="${barcodeTotal}" fill="black"/>`;

  // White inner area of barcode marker
  svg += `<rect x="${bcX + barcodeBorder}" y="${bcY + barcodeBorder}" width="${barcodeInner}" height="${barcodeInner}" fill="white"/>`;

  // Draw 3x3 barcode pattern cells
  const barcodeGrid = markerValueToGrid(panel.marker_value);
  const cellSize = Math.floor(barcodeInner / 3);
  const innerX = bcX + barcodeBorder;
  const innerY = bcY + barcodeBorder;

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      // 0 = black cell, 1 = white cell
      const color = barcodeGrid[row][col] ? 'white' : 'black';
      svg += `<rect x="${innerX + col * cellSize}" y="${innerY + row * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`;
    }
  }

  svg += '</svg>';
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(svg);
});

module.exports = router;
