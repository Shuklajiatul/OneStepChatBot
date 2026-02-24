const express                           = require('express');
const cors                              = require('cors');
const helmet                            = require('helmet');
const compression                       = require('compression');
const routes                            = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { addRequestId, requestLogger }   = require('./middleware/requestLogger');
const { apiLimiter }                    = require('./middleware/rateLimiter');
const slashUtils                        = require('slashUtils').init();
require('dotenv').config();
require('express-async-errors');

/**
 * Express Application Setup
 */

const app = express();

// Trust the first proxy hop (e.g. Nginx) so express-rate-limit can correctly identify client IPs from the X-Forwarded-For header.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS
// app.use(cors({
//     origin: '*',
//     credentials: true,
// }));

app.use(cors());

// Compression
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(addRequestId);
app.use(requestLogger);

// Rate limiting (apply to all routes)
// app.use(apiLimiter);

// API routes
const apiPrefix = process.env.API_PREFIX || '/api';
app.use(apiPrefix, routes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

module.exports = app;
