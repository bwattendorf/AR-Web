const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Persistent data directory (single Railway volume at /app/data)
const dataDir = process.env.DATA_PATH || path.join(__dirname, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.locals.uploadsDir = uploadsDir;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Routes
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

app.use('/', adminRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`AR.js Panel Viewer running on port ${PORT}`);
});
