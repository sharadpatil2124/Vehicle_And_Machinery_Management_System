const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

if (env.isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));

app.use(express.json({ limit: '100kb' }));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
