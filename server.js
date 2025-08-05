const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const feedlyRoutes = require('./routes/feedly');
const instapaperRoutes = require('./routes/instapaper');

const app = express();
const PORT = process.env.PORT || 12012;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/feedly', feedlyRoutes);
app.use('/api/instapaper', instapaperRoutes);

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Open in browser to start swiping articles!`);
});
