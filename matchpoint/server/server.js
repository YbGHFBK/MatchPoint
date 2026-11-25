require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./db/database');
const { requestLogger, auditLogger, errorLogger } = require('./middleware/logger');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const swipesRoutes = require('./routes/swipes');
const teamsRoutes = require('./routes/teams');
const eventsRoutes = require('./routes/events');
const { adminRouter, reportsRouter, fetchAllDictionaries } = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(requestLogger);
app.use('/api/events/:id/result', express.json({ limit: '7mb' }));
app.use(express.json());
app.use(auditLogger);
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
app.use('/api/teams', teamsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint не найден' });
});

app.use(errorLogger);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`MatchPoint server запущен: http://localhost:${PORT}`);
  });
}

module.exports = app;
