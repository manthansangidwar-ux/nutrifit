const axios  = require('axios');
const User   = require('../models/User');
const { AppError, catchAsync } = require('../utils/appError');
const logger = require('../utils/logger');

// ── Build system prompt from user profile
function buildSystemPrompt(user) {
  const p = user.healthProfile;
  if (!p) {
    return 'You are an expert AI Dietitian for NutriFit. Give warm, practical nutrition advice in 2-4 sentences. Never diagnose medical conditions.';
  }
  return `You are an expert, warm AI Dietitian for NutriFit — a health food recommendation platform.

User profile:
- Name: ${user.firstName}
- BMI: ${p.bmi} (${p.bmiCategory})
- Age: ~${p.age} years | Gender: ${p.gender}
- Height: ${p.height}cm | Weight: ${p.weight}kg
- Primary goal: ${p.primaryGoal}
- Diet: ${p.dietPreference}
- Activity: ${p.activityLevel}
- Daily calories: ${p.dailyCalories} kcal
- Protein: ${p.proteinTarget}g | Carbs: ${p.carbTarget}g | Fat: ${p.fatTarget}g | Fiber: ${p.fiberTarget}g
- Nutritional needs: ${(p.nutritionalNeeds || []).join(', ') || 'none'}
- Medical conditions: ${(p.medicalConditions || []).filter(m => m !== 'None of the above').join(', ') || 'none'}
- Allergies: ${(p.allergies || []).filter(a => a !== 'None').join(', ') || 'none'}
- City: ${p.city}

Instructions:
- Give warm, practical, evidence-based dietary advice
- Keep responses under 120 words
- Use line breaks for readability
- Reference their specific profile data when relevant
- Never provide medical diagnoses or replace medical advice
- Suggest consulting a doctor for medical conditions`;
}

// ── POST /api/ai/chat
exports.chat = catchAsync(async (req, res, next) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return next(new AppError('Messages array is required', 400));
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return next(new AppError('AI service not configured. Please add ANTHROPIC_API_KEY to .env', 503));
  }

  const user = await User.findById(req.user._id);
  const systemPrompt = buildSystemPrompt(user);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system:     systemPrompt,
        messages:   messages.map(m => ({ role: m.role, content: m.content })),
      },
      {
        headers: {
          'Content-Type':        'application/json',
          'x-api-key':           process.env.ANTHROPIC_API_KEY,
          'anthropic-version':   '2023-06-01',
        },
        timeout: 20000,
      }
    );

    const reply = response.data.content?.[0]?.text;
    if (!reply) throw new Error('Empty response from AI');

    res.json({ success: true, reply });
  } catch (err) {
    logger.error('AI chat error:', err.response?.data || err.message);
    const status = err.response?.status;
    if (status === 401) return next(new AppError('Invalid Anthropic API key', 502));
    if (status === 429) return next(new AppError('AI service rate limit reached. Please wait a moment.', 429));
    return next(new AppError('AI Dietitian is temporarily unavailable', 503));
  }
});

// ── POST /api/ai/analyze
exports.analyzeMeal = catchAsync(async (req, res, next) => {
  const { foodName, nutrition, goal } = req.body;
  if (!foodName || !nutrition) return next(new AppError('foodName and nutrition are required', 400));

  if (!process.env.ANTHROPIC_API_KEY) {
    return next(new AppError('AI service not configured', 503));
  }

  const user = await User.findById(req.user._id);
  const p    = user.healthProfile;

  const prompt = `Briefly analyze this meal for the user in 3 bullet points:
Meal: ${foodName}
Nutrition: ${nutrition.calories} kcal, ${nutrition.protein}g protein, ${nutrition.carbohydrates}g carbs, ${nutrition.fat}g fat, ${nutrition.fiber}g fiber
User goal: ${goal || p?.primaryGoal || 'Maintain weight'}
Keep it concise and actionable.`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: prompt }] },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, timeout: 15000 }
    );
    res.json({ success: true, analysis: response.data.content?.[0]?.text });
  } catch (err) {
    return next(new AppError('Analysis unavailable', 503));
  }
});
