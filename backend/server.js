const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

const path = require('path');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB().then(() => {
  // Start Telegram Bot
  const { startBot } = require('./services/telegramBot');
  startBot();
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Return 404 for missing assets in /assets to prevent serving index.html
app.use('/assets', (req, res) => {
  res.status(404).send('Asset not found');
});

// Mount Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/notifications', require('./routes/notifications'));

// Wildcard route to serve index.html for frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong on the server!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in production mode on port ${PORT}`);
});
