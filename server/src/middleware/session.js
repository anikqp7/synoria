const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');

module.exports = function createSessionMiddleware(app) {
  let sessionMiddleware;
  return function handleSession(req, res, next) {
    // main() connects Mongoose before accepting requests; reuse its MongoDB client.
    if (!sessionMiddleware) {
      if (!process.env.SESSION_SECRET) return next(new Error('SESSION_SECRET is required.'));
      const store = MongoStore.create({ client: mongoose.connection.getClient() });
      app.locals.sessionStore = store;
      sessionMiddleware = session({
        name: 'department.sid',
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store,
        cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.SESSION_COOKIE_SECURE === 'true', maxAge: 7 * 24 * 60 * 60 * 1000 },
      });
    }
    sessionMiddleware(req, res, next);
  };
};
