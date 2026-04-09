const { Food, Restaurant } = require('../models/Food');
const { AppError, catchAsync } = require('../utils/appError');

// ── GET /api/foods
exports.getFoods = catchAsync(async (req, res) => {
  const { category, diet, cuisine, maxCal, minProtein, search, page = 1, limit = 20 } = req.query;

  const filter = { isAvailable: true };
  if (category)   filter.category = category;
  if (cuisine)    filter.cuisine  = new RegExp(cuisine, 'i');
  if (diet)       filter.dietTags = { $in: [diet] };
  if (maxCal)     filter['nutrition.calories']  = { $lte: parseInt(maxCal) };
  if (minProtein) filter['nutrition.protein']   = { $gte: parseInt(minProtein) };
  if (search)     filter.$text = { $search: search };

  const skip  = (parseInt(page) - 1) * parseInt(limit);
  const [foods, total] = await Promise.all([
    Food.find(filter)
        .populate('restaurant', 'name area city overallRating priceRange')
        .sort({ qualityScore: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
    Food.countDocuments(filter),
  ]);

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    foods,
  });
});

// ── GET /api/foods/:id
exports.getFood = catchAsync(async (req, res, next) => {
  const food = await Food.findById(req.params.id)
    .populate('restaurant', 'name area city overallRating priceRange cuisineTypes');
  if (!food) return next(new AppError('Food item not found', 404));
  res.json({ success: true, food });
});

// ── GET /api/restaurants
exports.getRestaurants = catchAsync(async (req, res) => {
  const { city, healthFocused, minRating } = req.query;
  const filter = { isActive: true };
  if (city)         filter.city = new RegExp(city, 'i');
  if (healthFocused === 'true') filter.isHealthFocused = true;
  if (minRating)    filter.overallRating = { $gte: parseFloat(minRating) };

  const restaurants = await Restaurant.find(filter).sort({ overallRating: -1 }).lean();
  res.json({ success: true, total: restaurants.length, restaurants });
});

// ── GET /api/restaurants/:id
exports.getRestaurant = catchAsync(async (req, res, next) => {
  const [restaurant, menu] = await Promise.all([
    Restaurant.findById(req.params.id),
    Food.find({ restaurant: req.params.id, isAvailable: true }).lean(),
  ]);
  if (!restaurant) return next(new AppError('Restaurant not found', 404));
  res.json({ success: true, restaurant, menu });
});

// ── Admin: POST /api/foods
exports.createFood = catchAsync(async (req, res) => {
  const food = await Food.create(req.body);
  res.status(201).json({ success: true, food });
});

// ── Admin: PUT /api/foods/:id
exports.updateFood = catchAsync(async (req, res, next) => {
  const food = await Food.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!food) return next(new AppError('Food item not found', 404));
  res.json({ success: true, food });
});
