const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db/database');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const swipesRoutes = require('./routes/swipes');
<<<<<<< HEAD
const { adminRouter, reportsRouter, fetchAllDictionaries } = require('./routes/admin');
=======
const teamsRoutes = require('./routes/teams');

>>>>>>> origin/main

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

app.get('/api/dictionaries', async (req, res, next) => {
  try {
    const data = await fetchAllDictionaries();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/swipes', swipesRoutes);
<<<<<<< HEAD
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);
=======
app.use('/api/teams', teamsRoutes);
>>>>>>> origin/main

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint не найден' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`MatchPoint server запущен: http://localhost:${PORT}`);
  });
}

module.exports = app;