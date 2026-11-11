
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files (RC Books)
const uploadsPath = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

app.get('/health', (req, res) => {
  res.send('API is running');
});

const routes = require('./routes');
app.use('/api', routes);

module.exports = app;
