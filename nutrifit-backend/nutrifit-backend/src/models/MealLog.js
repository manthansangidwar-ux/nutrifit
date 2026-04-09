const mongoose = require('mongoose');

const mealLogSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  food:     { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  loggedAt: { type: Date, default: Date.now, index: true },
  mealType: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'], required: true },
  quantity: { type: Number, default: 1, min: 0.5, max: 5 },
  notes:    String,

  // Snapshot of nutrition at time of logging (food data can change)
  nutritionSnapshot: {
    calories:      Number,
    protein:       Number,
    carbohydrates: Number,
    fat:           Number,
    fiber:         Number,
  },
}, { timestamps: true });

// ── Get today's logs for a user
mealLogSchema.statics.getTodayLogs = function (userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return this.find({ user: userId, loggedAt: { $gte: start, $lte: end } })
             .populate('food', 'name emoji nutrition restaurant')
             .sort({ loggedAt: 1 });
};

// ── Aggregate daily nutrition totals
mealLogSchema.statics.getDailyTotals = async function (userId, date = new Date()) {
  const start = new Date(date); start.setHours(0,0,0,0);
  const end   = new Date(date); end.setHours(23,59,59,999);
  const result = await this.aggregate([
    { $match: { user: userId, loggedAt: { $gte: start, $lte: end } } },
    { $group: {
      _id: null,
      totalCalories: { $sum: { $multiply: ['$nutritionSnapshot.calories',      '$quantity'] } },
      totalProtein:  { $sum: { $multiply: ['$nutritionSnapshot.protein',        '$quantity'] } },
      totalCarbs:    { $sum: { $multiply: ['$nutritionSnapshot.carbohydrates',  '$quantity'] } },
      totalFat:      { $sum: { $multiply: ['$nutritionSnapshot.fat',            '$quantity'] } },
      totalFiber:    { $sum: { $multiply: ['$nutritionSnapshot.fiber',          '$quantity'] } },
      count:         { $sum: 1 },
    }},
  ]);
  return result[0] || { totalCalories:0, totalProtein:0, totalCarbs:0, totalFat:0, totalFiber:0, count:0 };
};

module.exports = mongoose.model('MealLog', mealLogSchema);
