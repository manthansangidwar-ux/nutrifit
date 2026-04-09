const MealLog    = require('../models/MealLog');
const { Food }   = require('../models/Food');
const User       = require('../models/User');
const { AppError, catchAsync } = require('../utils/appError');

// ── POST /api/logs  — Log a meal
exports.logMeal = catchAsync(async (req, res, next) => {
  const { foodId, mealType, quantity = 1, notes } = req.body;
  if (!foodId || !mealType) return next(new AppError('foodId and mealType are required', 400));

  const food = await Food.findById(foodId);
  if (!food) return next(new AppError('Food item not found', 404));

  const log = await MealLog.create({
    user:     req.user._id,
    food:     foodId,
    mealType,
    quantity: parseFloat(quantity),
    notes,
    nutritionSnapshot: {
      calories:      food.nutrition?.calories,
      protein:       food.nutrition?.protein,
      carbohydrates: food.nutrition?.carbohydrates,
      fat:           food.nutrition?.fat,
      fiber:         food.nutrition?.fiber,
    },
  });

  await log.populate('food', 'name emoji nutrition');
  res.status(201).json({ success: true, message: 'Meal logged successfully', log });
});

// ── GET /api/logs/today  — Today's meal logs
exports.getTodayLogs = catchAsync(async (req, res) => {
  const [logs, totals] = await Promise.all([
    MealLog.getTodayLogs(req.user._id),
    MealLog.getDailyTotals(req.user._id),
  ]);

  // Get user targets for progress calculation
  const user = await User.findById(req.user._id).select('healthProfile');
  const p    = user.healthProfile;

  const progress = p ? {
    calories: { current: Math.round(totals.totalCalories), target: p.dailyCalories, pct: Math.min(100, Math.round(totals.totalCalories / p.dailyCalories * 100)) },
    protein:  { current: Math.round(totals.totalProtein),  target: p.proteinTarget, pct: Math.min(100, Math.round(totals.totalProtein  / p.proteinTarget  * 100)) },
    carbs:    { current: Math.round(totals.totalCarbs),    target: p.carbTarget,    pct: Math.min(100, Math.round(totals.totalCarbs    / p.carbTarget     * 100)) },
    fat:      { current: Math.round(totals.totalFat),      target: p.fatTarget,     pct: Math.min(100, Math.round(totals.totalFat      / p.fatTarget      * 100)) },
    fiber:    { current: Math.round(totals.totalFiber),    target: p.fiberTarget,   pct: Math.min(100, Math.round(totals.totalFiber    / p.fiberTarget    * 100)) },
  } : null;

  res.json({ success: true, logs, totals, progress });
});

// ── GET /api/logs/history  — Past 7 days
exports.getHistory = catchAsync(async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await MealLog.find({ user: req.user._id, loggedAt: { $gte: since } })
    .populate('food', 'name emoji nutrition category')
    .sort({ loggedAt: -1 })
    .lean();

  // Group by date
  const grouped = {};
  logs.forEach(log => {
    const dateKey = log.loggedAt.toISOString().split('T')[0];
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(log);
  });

  res.json({ success: true, logs, grouped });
});

// ── DELETE /api/logs/:id
exports.deleteLog = catchAsync(async (req, res, next) => {
  const log = await MealLog.findOne({ _id: req.params.id, user: req.user._id });
  if (!log) return next(new AppError('Log entry not found', 404));
  await log.deleteOne();
  res.json({ success: true, message: 'Log entry deleted' });
});
