 console.log("NEW VERSION DEPLOYED 🚀");
 require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');

const connectDB      = require('./config/database');
const logger         = require('./utils/logger');
const errorHandler   = require('./middleware/errorHandler');
const { AppError }   = require('./utils/appError');

// ── Route imports
const authRoutes           = require('./routes/auth');
const healthRoutes         = require('./routes/health');
const foodRoutes           = require('./routes/foods');
const restaurantRoutes     = require('./routes/restaurants');
const recommendationRoutes = require('./routes/recommendations');
const logRoutes            = require('./routes/logs');
const aiRoutes             = require('./routes/ai');

// ── Connect to MongoDB
connectDB();

const app = express();


//  GLOBAL MIDDLEWARE
// ══════════════════════════════════════════════

// Security headers
app.use(helmet());

// CORS — allow frontend origin
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.CLIENT_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
    ];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Sanitize MongoDB query injection
app.use(mongoSanitize());

// Compression
app.use(compression());

// HTTP request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: msg => logger.info(msg.trim()) },
  }));
}

// ── Global rate limiter (100 req / 15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again in 15 minutes.' },
});
app.use('/api/', globalLimiter);

// ── Strict limiter for auth routes (20 req / 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many auth attempts. Please try again later.' },
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── AI rate limiter (30 req / 15 min)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'AI request limit reached. Please wait a moment.' },
});
app.use('/api/ai/', aiLimiter);

// ══════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════
app.use('/api/auth',            authRoutes);
app.use('/api/health',          healthRoutes);
app.use('/api/foods',           foodRoutes);
app.use('/api/restaurants',     restaurantRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/logs',            logRoutes);
app.use('/api/ai',              aiRoutes);

// ── Health check
app.get('/api/ping', (req, res) => {
  res.json({
    success: true,
    message: 'NutriFit API is running',
    version: '2.0.0',
    env:     process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API docs summary
app.get('/api', (req, res) => {
  res.json({
    name: 'NutriFit API',
    version: '2.0.0',
    endpoints: {
      auth:            '/api/auth — register, login, logout, me, update, change-password',
      health:          '/api/health — profile (GET/POST), bmi, targets',
      foods:           '/api/foods — list, detail',
      restaurants:     '/api/restaurants — list, detail with menu',
      recommendations: '/api/recommendations — personalized list, top 5, analyze meal',
      logs:            '/api/logs — log meal, today, history, delete',
      ai:              '/api/ai — chat with dietitian, analyze meal',
    },
  });
});

// ── 404 for unmatched routes
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// ── Global error handler (must be last)
app.use(errorHandler);

// ══════════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════════
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 NutriFit API running on http://localhost:${PORT} [${process.env.NODE_ENV}]`);
  logger.info(`📖 API docs at http://localhost:${PORT}/api`);
});

// ── Graceful shutdown
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION:', err.message);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => logger.info('Process terminated.'));
});

module.exports = app;
