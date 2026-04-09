const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const { AppError, catchAsync } = require('../utils/appError');

// ── Protect: require valid JWT
const protect = catchAsync(async (req, res, next) => {
  let token;

  // 1) Get token from header
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) return next(new AppError('Not authorized. Please log in.', 401));

  // 2) Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError('Token is invalid or expired. Please log in again.', 401));
  }

  // 3) Check user still exists
  const user = await User.findById(decoded.id).select(User.publicFields);
  if (!user) return next(new AppError('The user belonging to this token no longer exists.', 401));

  // 4) Check if account is active
  if (!user.isActive) return next(new AppError('Your account has been deactivated.', 401));

  // 5) Check if password was changed after token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password was recently changed. Please log in again.', 401));
  }

  req.user = user;
  next();
});

// ── Optional auth: attach user if token present, don't fail if not
const optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select(User.publicFields);
    } catch (_) { /* ignore */ }
  }
  next();
});

// ── Restrict to specific roles
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
  next();
};

module.exports = { protect, optionalAuth, restrictTo };
