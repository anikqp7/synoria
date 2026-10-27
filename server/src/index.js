const express = require('express');
const createSessionMiddleware = require('./middleware/session');
const errorHandler = require('./middleware/errorHandler');
const { getStatus } = require('./controllers/systemController');
const authRoutes = require('./routes/auth');

const app = express();

app.disable('x-powered-by');
app.use('/api/auth/resources', express.json({ limit: '7mb' }));
app.use(express.json({ limit: '64kb' }));
app.use('/api/auth', createSessionMiddleware(app), authRoutes);
app.get('/', require('./middleware/validateRequest'), getStatus);
app.use(errorHandler);

module.exports = app;
