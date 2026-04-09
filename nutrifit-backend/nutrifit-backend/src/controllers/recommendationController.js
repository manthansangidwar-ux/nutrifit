const User       = require('../models/User');
const { Food }   = require('../models/Food');
const { scoreMealForUser } = require('../utils/healthCalc');
const { AppError, catchAsync } = require('../utils/appError');

// ── GET /api/recommendations
exports.getRecommendations = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user.healthProfile) {
    return next(new AppError('Complete your health profile to get personalized recommendations', 400));
  }

  const profile  = user.healthProfile;
  const { sort = 'score', maxCal, category, diet, page = 1, limit = 20 } = req.query;

  // Build food query
  const filter = { isAvailable: true };
  if (category) filter.category = category;
  if (diet && diet !== 'All diets') filter.dietTags = { $in: [diet] };
  if (maxCal)   filter['nutrition.calories'] = { $lte: parseInt(maxCal) };

  const foods = await Food.find(filter)
    .populate('restaurant', 'name area city overallRating priceRange')
    .limit(100)
    .lean();

  // Score every meal for this specific user
  let scored = foods
    .map(food => {
      const result = scoreMealForUser(food, profile);
      return { ...food, compatibilityScore: result.score, scoreBand: result.band, scoreBreakdown: result.breakdown };
    })
    .filter(f => f.compatibilityScore > 0); // Remove allergen-flagged items

  // Sort
  const sortFns = {
    score:   (a, b) => b.compatibilityScore - a.compatibilityScore,
    rating:  (a, b) => b.rating - a.rating,
    'cal-asc': (a, b) => (a.nutrition?.calories || 0) - (b.nutrition?.calories || 0),
    protein: (a, b) => (b.nutrition?.protein || 0) - (a.nutrition?.protein || 0),
    price:   (a, b) => (a.price || 0) - (b.price || 0),
  };
  scored.sort(sortFns[sort] || sortFns.score);

  // Pagination
  const total    = scored.length;
  const startIdx = (parseInt(page) - 1) * parseInt(limit);
  const paginated = scored.slice(startIdx, startIdx + parseInt(limit));

  res.json({
    success: true,
    total,
    page:    parseInt(page),
    pages:   Math.ceil(total / parseInt(limit)),
    userGoal:      profile.primaryGoal,
    dailyCalories: profile.dailyCalories,
    recommendations: paginated,
  });
});

// ── GET /api/recommendations/top
exports.getTopPicks = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user.healthProfile) {
    return next(new AppError('Complete your health profile first', 400));
  }
  const profile = user.healthProfile;
  const foods   = await Food.find({ isAvailable: true }).populate('restaurant', 'name area city').limit(50).lean();
  const top = foods
    .map(food => {
      const result = scoreMealForUser(food, profile);
      return { ...food, compatibilityScore: result.score, scoreBand: result.band };
    })
    .filter(f => f.compatibilityScore > 0)
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, 5);

  res.json({ success: true, top });
});

// ── POST /api/recommendations/analyze
exports.analyzeMeal = catchAsync(async (req, res, next) => {
  const { foodId } = req.body;
  if (!foodId) return next(new AppError('foodId is required', 400));

  const [user, food] = await Promise.all([
    User.findById(req.user._id),
    Food.findById(foodId).populate('restaurant', 'name area city'),
  ]);

  if (!food)               return next(new AppError('Food item not found', 404));
  if (!user.healthProfile) return next(new AppError('Complete your health profile first', 400));

  const profile = user.healthProfile;
  const result  = scoreMealForUser(food, profile);
  const n       = food.nutrition || {};

  const insights = [];
  const calPct = Math.round((n.calories / profile.dailyCalories) * 100);
  insights.push(`Provides ${calPct}% of your daily ${profile.dailyCalories} kcal target.`);

  const protPct = Math.round((n.protein / profile.proteinTarget) * 100);
  if (n.protein >= 25) insights.push(`Excellent protein: ${n.protein}g (${protPct}% of daily target).`);
  else if (n.protein >= 15) insights.push(`Moderate protein: ${n.protein}g.`);
  else insights.push(`Low protein (${n.protein}g). Consider pairing with a protein source.`);

  if (n.fiber >= 6) insights.push(`High fiber (${n.fiber}g) — great for digestion and satiety.`);
  if (result.breakdown?.allergenDisqualified) insights.push('⚠️ Contains your listed allergens. Do not order.');

  res.json({
    success: true,
    food: food.name,
    score:    result.score,
    band:     result.band,
    breakdown: result.scoreBreakdown,
    insights,
    calorieContribution: `${calPct}% of daily target`,
    proteinContribution: `${protPct}% of protein target`,
  });
});
