/**
 * NutriFit Database Seed Script
 * Run: npm run seed
 * Clears and repopulates restaurants + food items
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Food, Restaurant } = require('../src/models/Food');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nutrifit';

// ── Restaurants data
const RESTAURANTS = [
  { name: 'The Green Table',       area: 'Koregaon Park', city: 'Pune', cuisineTypes: ['Healthy', 'Continental'], overallRating: 4.8, totalReviews: 1240, isHealthFocused: true,  priceRange: '$$',  description: 'Farm-to-table healthy eating for the health-conscious Puneri.' },
  { name: 'NourishCo',             area: 'Baner',         city: 'Pune', cuisineTypes: ['Healthy', 'Seafood'],    overallRating: 4.6, totalReviews: 890,  isHealthFocused: true,  priceRange: '$$$', description: 'Premium nutritionist-designed meals and seafood bowls.' },
  { name: 'Verdant Bowl',          area: 'Wakad',         city: 'Pune', cuisineTypes: ['Vegan', 'Asian'],        overallRating: 4.5, totalReviews: 560,  isHealthFocused: true,  priceRange: '$$',  description: 'Entirely plant-based bowls with bold Asian flavours.' },
  { name: 'HealthByte Café',       area: 'Aundh',         city: 'Pune', cuisineTypes: ['Café', 'Healthy'],       overallRating: 4.4, totalReviews: 720,  isHealthFocused: true,  priceRange: '$',   description: 'Your go-to breakfast & brunch spot with guilt-free bites.' },
  { name: 'Desi Fit Kitchen',      area: 'Kothrud',       city: 'Pune', cuisineTypes: ['Indian', 'Healthy'],     overallRating: 4.7, totalReviews: 1050, isHealthFocused: false, priceRange: '$',   description: 'Classic Indian food reimagined with lower sodium and oil.' },
  { name: 'WrapRight',             area: 'Shivajinagar',  city: 'Pune', cuisineTypes: ['Wraps', 'Healthy'],      overallRating: 4.3, totalReviews: 430,  isHealthFocused: true,  priceRange: '$',   description: 'Multigrain wraps and bowls packed with nutrients.' },
  { name: 'Morning Fuel',          area: 'Viman Nagar',   city: 'Pune', cuisineTypes: ['Breakfast', 'Healthy'],  overallRating: 4.6, totalReviews: 680,  isHealthFocused: true,  priceRange: '$$',  description: 'Protein-packed breakfasts to fuel your active day.' },
  { name: 'Mediterranean Bites',   area: 'Camp',          city: 'Pune', cuisineTypes: ['Mediterranean'],         overallRating: 4.4, totalReviews: 370,  isHealthFocused: false, priceRange: '$$$', description: 'Authentic Mediterranean small plates and salads.' },
  { name: 'Fit Dhaba',             area: 'Hinjewadi',     city: 'Pune', cuisineTypes: ['Indian', 'Healthy'],     overallRating: 4.5, totalReviews: 920,  isHealthFocused: true,  priceRange: '$',   description: 'Comfort Indian food made healthy for the IT crowd.' },
  { name: 'The Levant Kitchen',    area: 'Magarpatta',    city: 'Pune', cuisineTypes: ['Middle Eastern'],        overallRating: 4.6, totalReviews: 540,  isHealthFocused: false, priceRange: '$$',  description: 'Shawarma bowls and mezze plates from the Levant.' },
];

// ── Build food items using restaurant IDs
function buildFoods(restMap) {
  const r = (name) => restMap[name];
  return [
    {
      name: 'Grilled Chicken Power Bowl', restaurant: r('The Green Table'), category: 'Lunch',
      cuisine: 'Continental', emoji: '🥗', bgColor: '#eaf4ef',
      nutrition: { calories:380, protein:42, carbohydrates:28, fat:10, fiber:8, sugar:4, sodium:380, cholesterol:90 },
      dietTags: ['High protein','Low fat'], allergens: [], price: 340, rating: 4.8, ratingCount: 210, qualityScore: 92,
      description: 'Grilled chicken breast on a bed of quinoa, roasted vegetables, and herb dressing.',
    },
    {
      name: 'Baked Salmon with Quinoa', restaurant: r('NourishCo'), category: 'Dinner',
      cuisine: 'Continental', emoji: '🐟', bgColor: '#eef4fb',
      nutrition: { calories:420, protein:38, carbohydrates:32, fat:16, fiber:5, sugar:2, sodium:310, cholesterol:75, omega3:2.5 },
      dietTags: ['High protein','Gluten-free','Omega-3'], allergens: ['shellfish'], price: 520, rating: 4.6, ratingCount: 184, qualityScore: 89,
      description: 'Oven-baked Atlantic salmon fillet with tri-colour quinoa and steamed greens.',
    },
    {
      name: 'Tofu Stir-fry Bowl', restaurant: r('Verdant Bowl'), category: 'Lunch',
      cuisine: 'Asian', emoji: '🥦', bgColor: '#f0fdf4',
      nutrition: { calories:310, protein:24, carbohydrates:40, fat:9, fiber:7, sugar:12, sodium:490, cholesterol:0 },
      dietTags: ['Vegan','Vegetarian','Low fat'], allergens: ['soy'], price: 280, rating: 4.5, ratingCount: 97, qualityScore: 81,
      description: 'Crispy tofu with bok choy, broccoli, and ginger-soy sauce over brown rice.',
    },
    {
      name: 'Egg White Omelette + Rye Toast', restaurant: r('HealthByte Café'), category: 'Breakfast',
      cuisine: 'Café', emoji: '🍳', bgColor: '#fdf9ee',
      nutrition: { calories:290, protein:32, carbohydrates:22, fat:7, fiber:4, sugar:3, sodium:310, cholesterol:20 },
      dietTags: ['High protein','Low carb'], allergens: ['eggs','gluten'], price: 220, rating: 4.4, ratingCount: 143, qualityScore: 85,
      description: '4-egg-white omelette with spinach, mushrooms, and a slice of seeded rye toast.',
    },
    {
      name: 'Rajma Chawal (Low Sodium)', restaurant: r('Desi Fit Kitchen'), category: 'Dinner',
      cuisine: 'Indian', emoji: '🫘', bgColor: '#f5f3ff',
      nutrition: { calories:480, protein:22, carbohydrates:68, fat:8, fiber:14, sugar:4, sodium:220, cholesterol:0, iron:5 },
      dietTags: ['Vegetarian','High fiber','Low sodium'], allergens: [], price: 180, rating: 4.7, ratingCount: 312, qualityScore: 78,
      description: 'Slow-cooked red kidney beans in a tomato-onion gravy with steamed brown rice.',
    },
    {
      name: 'Multigrain Hummus Wrap', restaurant: r('WrapRight'), category: 'Lunch',
      cuisine: 'Mediterranean', emoji: '🥙', bgColor: '#fff1f2',
      nutrition: { calories:340, protein:18, carbohydrates:44, fat:11, fiber:6, sugar:5, sodium:420, cholesterol:0 },
      dietTags: ['Vegetarian','High fiber'], allergens: ['gluten','soy'], price: 195, rating: 4.3, ratingCount: 76, qualityScore: 74,
      description: 'Whole-wheat wrap filled with hummus, roasted vegetables, falafel, and tzatziki.',
    },
    {
      name: 'Oats & Berry Protein Bowl', restaurant: r('Morning Fuel'), category: 'Breakfast',
      cuisine: 'Healthy', emoji: '🫐', bgColor: '#fdf4ff',
      nutrition: { calories:260, protein:20, carbohydrates:34, fat:6, fiber:9, sugar:8, sodium:140, cholesterol:0 },
      dietTags: ['Vegetarian','High fiber','Low fat','Low sodium'], allergens: ['dairy'], price: 230, rating: 4.6, ratingCount: 88, qualityScore: 87,
      description: 'Steel-cut oats with whey protein, mixed berries, chia seeds, and almond butter.',
    },
    {
      name: 'Paneer Tikka with Brown Rice', restaurant: r('Fit Dhaba'), category: 'Dinner',
      cuisine: 'Indian', emoji: '🍛', bgColor: '#fff7ed',
      nutrition: { calories:440, protein:28, carbohydrates:50, fat:14, fiber:4, sugar:6, sodium:560, cholesterol:30, calcium:300 },
      dietTags: ['Vegetarian','High protein'], allergens: ['dairy'], price: 260, rating: 4.5, ratingCount: 201, qualityScore: 76,
      description: 'Tandoor-grilled paneer cubes in spiced yogurt marinade with brown basmati rice.',
    },
    {
      name: 'Greek Salad with Feta', restaurant: r('Mediterranean Bites'), category: 'Lunch',
      cuisine: 'Mediterranean', emoji: '🥗', bgColor: '#f0fdf4',
      nutrition: { calories:220, protein:12, carbohydrates:18, fat:14, fiber:5, sugar:8, sodium:380, cholesterol:25 },
      dietTags: ['Vegetarian','Gluten-free','Low carb'], allergens: ['dairy'], price: 310, rating: 4.4, ratingCount: 55, qualityScore: 72,
      description: 'Classic Greek salad with tomato, cucumber, olives, red onion, and crumbled feta.',
    },
    {
      name: 'Chicken Shawarma Bowl', restaurant: r('The Levant Kitchen'), category: 'Dinner',
      cuisine: 'Middle Eastern', emoji: '🌯', bgColor: '#fef2f2',
      nutrition: { calories:510, protein:36, carbohydrates:48, fat:15, fiber:6, sugar:5, sodium:620, cholesterol:85 },
      dietTags: ['High protein'], allergens: ['gluten'], price: 350, rating: 4.6, ratingCount: 178, qualityScore: 80,
      description: 'Marinated chicken shawarma over saffron rice with garlic sauce and pickled veggies.',
    },
    {
      name: 'Avocado Toast + Poached Egg', restaurant: r('HealthByte Café'), category: 'Breakfast',
      cuisine: 'Café', emoji: '🥑', bgColor: '#f0fdf4',
      nutrition: { calories:320, protein:16, carbohydrates:28, fat:18, fiber:8, sugar:3, sodium:280, cholesterol:185, omega3:1.2 },
      dietTags: ['Vegetarian','High fiber','Omega-3'], allergens: ['eggs','gluten'], price: 280, rating: 4.7, ratingCount: 165, qualityScore: 84,
      description: 'Smashed avocado on sourdough toast with a soft poached egg and micro-greens.',
    },
    {
      name: 'Moong Dal Cheela', restaurant: r('Desi Fit Kitchen'), category: 'Breakfast',
      cuisine: 'Indian', emoji: '🫓', bgColor: '#fef9ee',
      nutrition: { calories:240, protein:18, carbohydrates:30, fat:6, fiber:8, sugar:2, sodium:200, cholesterol:0, iron:3 },
      dietTags: ['Vegan','Vegetarian','High fiber','Low fat','Gluten-free','Diabetic-friendly','Low sodium'], allergens: [], price: 120, rating: 4.6, ratingCount: 290, qualityScore: 90,
      description: 'Savoury green moong dal crepes with ginger, coriander, and mint chutney.',
    },
    {
      name: 'Quinoa Tabbouleh Salad', restaurant: r('Mediterranean Bites'), category: 'Lunch',
      cuisine: 'Mediterranean', emoji: '🥙', bgColor: '#eef4fb',
      nutrition: { calories:280, protein:14, carbohydrates:38, fat:10, fiber:7, sugar:4, sodium:310, cholesterol:0 },
      dietTags: ['Vegan','Vegetarian','Gluten-free','Low fat'], allergens: [], price: 320, rating: 4.5, ratingCount: 120, qualityScore: 82,
      description: 'Quinoa-based tabbouleh with parsley, mint, tomatoes, lemon, and olive oil.',
    },
    {
      name: 'Lentil & Spinach Soup', restaurant: r('Verdant Bowl'), category: 'Lunch',
      cuisine: 'Healthy', emoji: '🍲', bgColor: '#f0fdf4',
      nutrition: { calories:200, protein:16, carbohydrates:28, fat:4, fiber:10, sugar:3, sodium:280, cholesterol:0, iron:4 },
      dietTags: ['Vegan','Vegetarian','Low fat','High fiber','Gluten-free','Diabetic-friendly'], allergens: [], price: 160, rating: 4.4, ratingCount: 88, qualityScore: 88,
      description: 'Hearty red lentil and spinach soup with cumin-tempered olive oil and lemon.',
    },
  ];
}

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data (preserve users)
    await Restaurant.deleteMany({});
    await Food.deleteMany({});
    console.log('🗑️  Cleared existing restaurants and foods');

    // Insert restaurants
    const createdRests = await Restaurant.insertMany(RESTAURANTS);
    console.log(`✅ Inserted ${createdRests.length} restaurants`);

    // Build ID map
    const restMap = {};
    createdRests.forEach(r => { restMap[r.name] = r._id; });

    // Insert foods
    const foods = buildFoods(restMap);
    await Food.insertMany(foods);
    console.log(`✅ Inserted ${foods.length} food items`);

    // Optional: create admin user
    const adminExists = await User.findOne({ email: 'admin@nutrifit.com' });
    if (!adminExists) {
      await User.create({
        firstName: 'Admin',
        lastName:  'NutriFit',
        email:     'admin@nutrifit.com',
        phone:     '9999999999',
        password:  'Admin@1234',
        role:      'admin',
        isProfileComplete: false,
      });
      console.log('✅ Admin user created: admin@nutrifit.com / Admin@1234');
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('📌 Start the server: npm run dev');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
