const { validationResult } = require('express-validator');
const User       = require('../models/User');
const { AppError, catchAsync } = require('../utils/appError');
const logger     = require('../utils/logger');

// ── Send token response helper
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = user.generateToken();
  const cookieOptions = {
    expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
  res.cookie('token', token, cookieOptions);
  user.password = undefined;
  res.status(statusCode).json({ success: true, message, token, user });
};

// ── POST /api/auth/register
exports.register = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array().map(e => e.msg).join('. '), 400));
  }

  const { firstName, lastName, email, phone, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return next(new AppError('Email already registered. Please sign in.', 409));

  const user = await User.create({ firstName, lastName, email, phone, password });
  logger.info(`New user registered: ${email}`);
  sendTokenResponse(user, 201, res, 'Account created successfully');
});

// ── POST /api/auth/login
exports.login = catchAsync(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array().map(e => e.msg).join('. '), 400));
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return next(new AppError('Invalid email or password', 401));
  }
  if (!user.isActive) return next(new AppError('Account is deactivated', 401));

  user.lastLogin   = Date.now();
  user.loginCount += 1;
  await user.save({ validateBeforeSave: false });

  logger.info(`User logged in: ${email}`);
  sendTokenResponse(user, 200, res, 'Login successful');
});

// ── GET /api/auth/me
exports.getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select(User.publicFields);
  res.json({ success: true, user });
});

// ── PUT /api/auth/update-profile
exports.updateProfile = catchAsync(async (req, res, next) => {
  const { firstName, lastName, phone } = req.body;
  if (!firstName && !lastName && !phone) {
    return next(new AppError('Provide at least one field to update', 400));
  }
  const updates = {};
  if (firstName) updates.firstName = firstName.trim();
  if (lastName)  updates.lastName  = lastName.trim();
  if (phone)     updates.phone     = phone.trim();

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true, runValidators: true,
  }).select(User.publicFields);

  res.json({ success: true, message: 'Profile updated', user });
});

// ── PUT /api/auth/change-password
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current and new password', 400));
  }
  if (newPassword.length < 8) {
    return next(new AppError('New password must be at least 8 characters', 400));
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword))) {
    return next(new AppError('Current password is incorrect', 401));
  }
  user.password = newPassword;
  await user.save();

  sendTokenResponse(user, 200, res, 'Password changed successfully');
});

// ── POST /api/auth/logout
exports.logout = (req, res) => {
  res.cookie('token', 'none', { expires: new Date(Date.now() + 10 * 1000), httpOnly: true });
  res.json({ success: true, message: 'Logged out successfully' });
};
