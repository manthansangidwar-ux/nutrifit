const logger = require('../utils/logger');

// ── Handle specific Mongoose errors
function handleCastError(err) {
  return { message: `Invalid ${err.path}: ${err.value}`, statusCode: 400 };
}
function handleDuplicateKey(err) {
  const field = Object.keys(err.keyValue)[0];
  return { message: `${field} already exists. Please use a different value.`, statusCode: 409 };
}
function handleValidationError(err) {
  const messages = Object.values(err.errors).map(e => e.message);
  return { message: messages.join('. '), statusCode: 400 };
}
function handleJWTError() {
  return { message: 'Invalid token. Please log in again.', statusCode: 401 };
}
function handleJWTExpiredError() {
  return { message: 'Your session has expired. Please log in again.', statusCode: 401 };
}

module.exports = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  // Known error types
  if (err.name === 'CastError')         ({ message, statusCode } = handleCastError(err));
  if (err.code === 11000)               ({ message, statusCode } = handleDuplicateKey(err));
  if (err.name === 'ValidationError')   ({ message, statusCode } = handleValidationError(err));
  if (err.name === 'JsonWebTokenError') ({ message, statusCode } = handleJWTError());
  if (err.name === 'TokenExpiredError') ({ message, statusCode } = handleJWTExpiredError());

  // Log server errors
  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${message}`, { url: req.originalUrl, method: req.method, stack: err.stack });
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
