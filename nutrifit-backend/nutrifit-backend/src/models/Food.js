const mongoose = require('mongoose');

// ── Nutrition Facts
const nutritionSchema = new mongoose.Schema({
  calories:      { type: Number, required: true },
  protein:       Number,
  carbohydrates: Number,
  fat:           Number,
  fiber:         Number,
  sugar:         Number,
  sodium:        Number,    // mg
  cholesterol:   Number,    // mg
  calcium:       Number,    // mg
  iron:          Number,    // mg
  vitaminC:      Number,
  omega3:        Number,
}, { _id: false });

// ── Food Item
const foodSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, index: true },
  description: String,
  restaurant:  { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  category: {
    type: String,
    enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Beverage'],
    required: true, index: true,
  },
  cuisine:     { type: String, index: true },
  nutrition:   nutritionSchema,
  dietTags: [{
    type: String,
    enum: ['Vegetarian', 'Vegan', 'High protein', 'Low carb', 'Keto', 'Gluten-free',
           'Low sodium', 'Low fat', 'High fiber', 'Diabetic-friendly', 'Low sugar', 'Omega-3'],
  }],
  allergens:   [String],
  price:       Number,
  emoji:       { type: String, default: '🍽️' },
  bgColor:     { type: String, default: '#f5f5f5' },
  qualityScore:{ type: Number, default: 50, min: 0, max: 100 },
  rating:      { type: Number, default: 4.0, min: 1, max: 5 },
  ratingCount: { type: Number, default: 0 },
  isAvailable: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

foodSchema.virtual('scoreBand').get(function () {
  if (this.qualityScore >= 85) return 'Excellent';
  if (this.qualityScore >= 70) return 'Good';
  if (this.qualityScore >= 55) return 'Moderate';
  return 'Poor';
});

// ── Full text search index
foodSchema.index({ name: 'text', description: 'text' });

// ── Restaurant
const restaurantSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  description:     String,
  city:            { type: String, index: true },
  area:            String,
  address:         String,
  phone:           String,
  email:           String,
  cuisineTypes:    [String],
  overallRating:   { type: Number, default: 4.0, min: 1, max: 5 },
  totalReviews:    { type: Number, default: 0 },
  isHealthFocused: { type: Boolean, default: false },
  priceRange:      { type: String, enum: ['$', '$$', '$$$'], default: '$$' },
  openingHours:    String,
  imageUrl:        String,
  isActive:        { type: Boolean, default: true },
}, { timestamps: true });

const Food       = mongoose.model('Food', foodSchema);
const Restaurant = mongoose.model('Restaurant', restaurantSchema);

module.exports = { Food, Restaurant };
