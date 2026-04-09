/**
 * NutriFit Health Calculation Engine
 * Mifflin-St Jeor equations for BMR, TDEE, and macro targets
 */

const ACTIVITY_MULTIPLIERS = {
  'Sedentary':          1.2,
  'Lightly active':     1.375,
  'Moderately active':  1.55,
  'Very active':        1.725,
  'Athlete':            1.9,
};

const GOAL_ADJUSTMENTS = {
  'Lose weight':      -500,
  'Build muscle':     +300,
  'Maintain weight':   0,
  'Improve energy':  +100,
  'Manage diabetes': -200,
  'Heart health':    -100,
};

/**
 * Calculate BMI and category
 */
function calculateBMI(weightKg, heightCm) {
  const heightM = heightCm / 100;
  const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));

  let category, healthRisk, colorCode;
  if      (bmi < 18.5) { category = 'Underweight'; healthRisk = 'moderate'; colorCode = '#4a7fb5'; }
  else if (bmi < 25.0) { category = 'Normal weight'; healthRisk = 'low';    colorCode = '#3d7a5f'; }
  else if (bmi < 30.0) { category = 'Overweight';    healthRisk = 'moderate'; colorCode = '#c8a96e'; }
  else                 { category = 'Obese';          healthRisk = 'high';   colorCode = '#d94f4f'; }

  return { bmi, category, healthRisk, colorCode };
}

/**
 * Calculate age from date of birth
 */
function getAge(dateOfBirth) {
  if (!dateOfBirth) return 27; // default
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(10, Math.min(120, age));
}

/**
 * Calculate Basal Metabolic Rate (Mifflin-St Jeor)
 */
function calculateBMR(weightKg, heightCm, age, gender) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'Female' ? base - 161 : base + 5;
}

/**
 * Full health metrics calculation
 */
function calculateHealthMetrics({ weight, height, dateOfBirth, gender, activityLevel, primaryGoal }) {
  const bmiData  = calculateBMI(weight, height);
  const age      = getAge(dateOfBirth);
  const bmr      = calculateBMR(weight, height, age, gender);
  const tdee     = Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55));
  const adjustment = GOAL_ADJUSTMENTS[primaryGoal] || 0;
  const dailyCalories = Math.max(1200, Math.round(tdee + adjustment));

  // Macro targets
  const proteinTarget = Math.round(weight * 1.6);               // 1.6g per kg
  const fatTarget     = Math.round(dailyCalories * 0.25 / 9);   // 25% from fat
  const carbTarget    = Math.round((dailyCalories - proteinTarget * 4 - fatTarget * 9) / 4);
  const fiberTarget   = Math.round(dailyCalories / 100);         // ~14g per 1000 kcal

  return {
    ...bmiData,
    age,
    bmr:            Math.round(bmr),
    tdee,
    dailyCalories,
    proteinTarget,
    carbTarget,
    fatTarget,
    fiberTarget,
  };
}

/**
 * Score a meal against a user's health profile (0–100)
 */
function scoreMealForUser(meal, profile) {
  if (!meal.nutrition || !profile) return meal.qualityScore || 50;

  const n = meal.nutrition;
  const dailyCal = profile.dailyCalories || 2000;
  const mealTarget = dailyCal / 3;
  let score = 100;
  const breakdown = {};

  // Calorie fit (max penalty 25)
  const calDiff = Math.abs(n.calories - mealTarget) / mealTarget;
  const calPenalty = Math.min(25, calDiff * 50);
  score -= calPenalty;
  breakdown.calorieFit = Math.round(25 - calPenalty);

  // Protein bonus (up to +15)
  const proteinBonus = Math.min(15, (n.protein / (profile.proteinTarget || 80)) * 30) - 5;
  score += proteinBonus;
  breakdown.protein = Math.round(proteinBonus);

  // Fiber bonus (up to +10)
  const fiberBonus = Math.min(10, (n.fiber || 0) * 1.5);
  score += fiberBonus;
  breakdown.fiber = Math.round(fiberBonus);

  // Sugar penalty (max -15)
  const sugarLimit = profile.primaryGoal === 'Manage diabetes' ? 5 : 15;
  const sugarPenalty = Math.min(15, Math.max(0, ((n.sugar || 0) - sugarLimit) * 1.5));
  score -= sugarPenalty;
  breakdown.sugar = -Math.round(sugarPenalty);

  // Sodium penalty (max -15)
  const sodiumLimit = profile.dietPreference === 'Low sodium' ? 400 : 800;
  const sodiumPenalty = Math.min(15, Math.max(0, ((n.sodium || 0) - sodiumLimit) / 60));
  score -= sodiumPenalty;
  breakdown.sodium = -Math.round(sodiumPenalty);

  // Goal-specific adjustments
  if (profile.primaryGoal === 'Lose weight' && n.fat > 20)    score -= Math.min(10, (n.fat - 20) * 0.8);
  if (profile.primaryGoal === 'Build muscle' && n.protein > 30) score += 8;
  if (profile.primaryGoal === 'Heart health' && n.sodium < 400) score += 6;
  if (profile.primaryGoal === 'Manage diabetes' && n.fiber > 8)  score += 8;

  // Diet preference match
  const dietTags = meal.dietTags || [];
  if (profile.dietPreference && profile.dietPreference !== 'No restriction') {
    if (dietTags.includes(profile.dietPreference)) { score += 12; breakdown.dietMatch = 12; }
    else { score -= 5; }
  }

  // Nutritional needs bonus
  const needsMap = {
    'High fiber':      () => (n.fiber || 0) >= 6,
    'Low sugar':       () => (n.sugar || 0) <= 8,
    'Low fat':         () => (n.fat || 0) <= 10,
    'Omega-3':         () => dietTags.includes('Omega-3'),
    'Iron-rich':       () => (n.iron || 0) > 2,
    'Low cholesterol': () => (n.cholesterol || 0) < 50,
    'High protein':    () => (n.protein || 0) >= 25,
    'Low carb':        () => (n.carbohydrates || 0) <= 20,
  };
  (profile.nutritionalNeeds || []).forEach(need => {
    if (needsMap[need]?.()) score += 5;
  });

  // Allergen hard disqualifier
  const allergyMap = {
    'Nuts / Tree nuts': 'nuts', 'Dairy / Lactose': 'dairy', 'Eggs': 'eggs',
    'Shellfish': 'shellfish', 'Soy': 'soy', 'Gluten / Wheat': 'gluten', 'Sesame': 'sesame',
  };
  const foodAllergens = meal.allergens || [];
  for (const userAllergy of (profile.allergies || [])) {
    const key = allergyMap[userAllergy];
    if (key && foodAllergens.includes(key)) {
      score = 0;
      breakdown.allergenDisqualified = true;
      break;
    }
  }

  // Rating bonus
  if (meal.rating) score += (meal.rating - 4.0) * 5;

  return {
    score:     Math.min(100, Math.max(0, Math.round(score))),
    band:      score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Moderate' : 'Poor',
    breakdown,
  };
}

module.exports = { calculateBMI, calculateBMR, calculateHealthMetrics, getAge, scoreMealForUser };
