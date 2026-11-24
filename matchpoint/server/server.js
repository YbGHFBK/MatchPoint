const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db/database');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT NOW() AS db_time');
    res.json({ status: 'ok', db_time: rows[0].db_time });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.use('/api/auth', authRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint не найден' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`MatchPoint server запущен: http://localhost:${PORT}`);
});