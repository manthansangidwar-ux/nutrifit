const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

// ── Health Profile sub-document
const healthProfileSchema = new mongoose.Schema({
  dateOfBirth:    Date,
  gender:         { type: String, enum: ['Male', 'Female', 'Other'] },
  height:         { type: Number, min: 100, max: 250 },  // cm
  weight:         { type: Number, min: 20,  max: 300 },  // kg

  // Calculated
  bmi:            Number,
  bmiCategory:    { type: String, enum: ['Underweight', 'Normal weight', 'Overweight', 'Obese'] },
  age:            Number,
  bmr:            Number,
  tdee:           Number,
  dailyCalories:  Number,
  proteinTarget:  Number,
  carbTarget:     Number,
  fatTarget:      Number,
  fiberTarget:    Number,

  // Goals & preferences
  activityLevel: {
    type: String,
    enum: ['Sedentary', 'Lightly active', 'Moderately active', 'Very active', 'Athlete'],
    default: 'Moderately active',
  },
  primaryGoal: {
    type: String,
    enum: ['Lose weight', 'Build muscle', 'Maintain weight', 'Improve energy', 'Manage diabetes', 'Heart health'],
  },
  dietPreference: {
    type: String,
    enum: ['No restriction', 'Vegetarian', 'Vegan', 'Keto', 'High protein', 'Gluten-free', 'Diabetic-friendly', 'Low sodium'],
    default: 'No restriction',
  },
  nutritionalNeeds: [String],
  medicalConditions:[String],
  allergies:        [String],
  cuisinePreferences:[String],
  city:             { type: String, default: 'Pune' },
}, { _id: false });

// ── User schema
const userSchema = new mongoose.Schema({
  firstName: {
    type: String, required: [true, 'First name is required'],
    trim: true, maxlength: [50, 'First name cannot exceed 50 characters'],
  },
  lastName: {
    type: String, required: [true, 'Last name is required'],
    trim: true, maxlength: [50, 'Last name cannot exceed 50 characters'],
  },
  email: {
    type: String, required: [true, 'Email is required'], unique: true,
    lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Enter a valid email'],
  },
  phone: { type: String, required: [true, 'Phone is required'], trim: true },
  password: {
    type: String, required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'], select: false,
  },
  healthProfile:    { type: healthProfileSchema, default: null },
  isProfileComplete:{ type: Boolean, default: false },
  role:             { type: String, enum: ['user', 'admin'], default: 'user' },
  isActive:         { type: Boolean, default: true },
  passwordChangedAt: Date,
  lastLogin:        Date,
  loginCount:       { type: Number, default: 0 },
}, {
  timestamps: true,
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// ── Virtual: full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ── Pre-save: hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = Date.now() - 1000;
  next();
});

// ── Instance: compare passwords
userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

// ── Instance: generate JWT
userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// ── Instance: check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    return parseInt(this.passwordChangedAt.getTime() / 1000, 10) > jwtTimestamp;
  }
  return false;
};

// ── Static: safe user fields to return
userSchema.statics.publicFields = '-password -__v -passwordChangedAt';

module.exports = mongoose.model('User', userSchema);
