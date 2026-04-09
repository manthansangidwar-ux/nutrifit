const User = require('../models/User');
const { calculateHealthMetrics } = require('../utils/healthCalc');
const { AppError, catchAsync }   = require('../utils/appError');

// ── POST /api/health/profile
exports.saveProfile = catchAsync(async (req, res, next) => {
  const {
    dateOfBirth, gender, height, weight,
    activityLevel, primaryGoal, dietPreference,
    nutritionalNeeds, medicalConditions, allergies,
    cuisinePreferences, city,
  } = req.body;

  if (!height || !weight) {
    return next(new AppError('Height and weight are required', 400));
  }

  // Calculate all health metrics
  const metrics = calculateHealthMetrics({
    weight: parseFloat(weight),
    height: parseFloat(height),
    dateOfBirth,
    gender,
    activityLevel,
    primaryGoal,
  });

  const profile = {
    dateOfBirth,
    gender,
    height: parseFloat(height),
    weight: parseFloat(weight),
    activityLevel,
    primaryGoal,
    dietPreference:     dietPreference || 'No restriction',
    nutritionalNeeds:   nutritionalNeeds   || [],
    medicalConditions:  (medicalConditions || []).filter(m => m !== 'None of the above'),
    allergies:          (allergies || []).filter(a => a !== 'None'),
    cuisinePreferences: cuisinePreferences || [],
    city: city || 'Pune',
    // Calculated
    bmi:           metrics.bmi,
    bmiCategory:   metrics.category,
    age:           metrics.age,
    bmr:           metrics.bmr,
    tdee:          metrics.tdee,
    dailyCalories: metrics.dailyCalories,
    proteinTarget: metrics.proteinTarget,
    carbTarget:    metrics.carbTarget,
    fatTarget:     metrics.fatTarget,
    fiberTarget:   metrics.fiberTarget,
  };

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { healthProfile: profile, isProfileComplete: true },
    { new: true }
  ).select(User.publicFields);

  res.json({ success: true, message: 'Health profile saved', user, metrics });
});

// ── GET /api/health/profile
exports.getProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('healthProfile isProfileComplete');
  if (!user.healthProfile) {
    return next(new AppError('Health profile not yet created. Please complete onboarding.', 404));
  }
  res.json({ success: true, profile: user.healthProfile });
});

// ── GET /api/health/bmi?height=170&weight=70
exports.calculateBMI = catchAsync(async (req, res, next) => {
  const height = parseFloat(req.query.height);
  const weight = parseFloat(req.query.weight);
  if (!height || !weight || height < 100 || weight < 20) {
    return next(new AppError('Valid height (100–250 cm) and weight (20–300 kg) are required', 400));
  }
  const { calculateBMI: calcBMI } = require('../utils/healthCalc');
  const result = calcBMI(weight, height);
  res.json({ success: true, ...result });
});

// ── GET /api/health/targets
exports.getTargets = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('healthProfile');
  if (!user.healthProfile) {
    return next(new AppError('Complete your health profile first', 404));
  }
  const p = user.healthProfile;
  res.json({
    success: true,
    targets: {
      dailyCalories: p.dailyCalories,
      proteinTarget: p.proteinTarget,
      carbTarget:    p.carbTarget,
      fatTarget:     p.fatTarget,
      fiberTarget:   p.fiberTarget,
      bmi:           p.bmi,
      bmiCategory:   p.bmiCategory,
    },
  });
});
