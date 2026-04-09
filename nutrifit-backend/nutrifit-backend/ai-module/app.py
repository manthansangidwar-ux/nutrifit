"""
NutriFit Python AI Module
Flask + Pandas + Scikit-learn

Endpoints:
  GET  /health          — health check
  GET  /bmi             — calculate BMI
  POST /calorie-plan    — full daily targets
  POST /analyze         — score + insights for a single meal
  POST /recommend       — rank a list of meals (KNN)
  POST /nutrition-plan  — generate meal distribution plan
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.neighbors import NearestNeighbors
import logging, os

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════
#  CONSTANTS
# ═══════════════════════════════════════════════════
ACTIVITY_MULTIPLIERS = {
    'Sedentary':         1.2,
    'Lightly active':    1.375,
    'Moderately active': 1.55,
    'Very active':       1.725,
    'Athlete':           1.9,
}

GOAL_ADJUSTMENTS = {
    'Lose weight':     -500,
    'Build muscle':    +300,
    'Maintain weight':    0,
    'Improve energy':  +100,
    'Manage diabetes': -200,
    'Heart health':    -100,
}

IDEAL_VECTORS = {
    'Lose weight':     [0.70, 0.75, 0.85, 0.90, 0.80, 0.30, 0.90],
    'Build muscle':    [0.90, 1.00, 0.60, 0.70, 0.70, 0.60, 0.85],
    'Maintain weight': [0.80, 0.70, 0.70, 0.80, 0.80, 0.70, 0.88],
    'Manage diabetes': [0.60, 0.70, 0.90, 1.00, 0.80, 0.60, 0.85],
    'Heart health':    [0.70, 0.70, 0.90, 0.80, 1.00, 0.40, 0.90],
    'Improve energy':  [0.80, 0.80, 0.70, 0.80, 0.80, 0.70, 0.88],
}

# ═══════════════════════════════════════════════════
#  CORE CALCULATIONS
# ═══════════════════════════════════════════════════

def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    bmi = round(weight_kg / ((height_cm / 100) ** 2), 1)
    if   bmi < 18.5: category, risk = 'Underweight', 'moderate'
    elif bmi < 25.0: category, risk = 'Normal weight', 'low'
    elif bmi < 30.0: category, risk = 'Overweight', 'moderate'
    else:            category, risk = 'Obese', 'high'
    return {'bmi': bmi, 'category': category, 'healthRisk': risk}


def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if gender == 'Male' else base - 161


def get_age(date_of_birth: str) -> int:
    if not date_of_birth:
        return 27
    from datetime import date
    try:
        birth = date.fromisoformat(date_of_birth[:10])
        today = date.today()
        age   = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        return max(10, min(120, age))
    except Exception:
        return 27


def calculate_targets(profile: dict) -> dict:
    weight  = float(profile.get('weight', 70))
    height  = float(profile.get('height', 170))
    dob     = profile.get('dateOfBirth') or profile.get('dob')
    gender  = profile.get('gender', 'Male')
    activity= profile.get('activityLevel', 'Moderately active')
    goal    = profile.get('primaryGoal', 'Maintain weight')

    bmi_data   = calculate_bmi(weight, height)
    age        = get_age(dob)
    bmr        = calculate_bmr(weight, height, age, gender)
    tdee       = bmr * ACTIVITY_MULTIPLIERS.get(activity, 1.55)
    adjustment = GOAL_ADJUSTMENTS.get(goal, 0)
    daily_cal  = max(1200, round(tdee + adjustment))

    protein_g  = round(weight * 1.6)
    fat_g      = round(daily_cal * 0.25 / 9)
    carb_g     = round((daily_cal - protein_g * 4 - fat_g * 9) / 4)
    fiber_g    = round(daily_cal / 100)

    return {
        **bmi_data,
        'age':           age,
        'bmr':           round(bmr),
        'tdee':          round(tdee),
        'dailyCalories': daily_cal,
        'proteinTarget': protein_g,
        'carbTarget':    carb_g,
        'fatTarget':     fat_g,
        'fiberTarget':   fiber_g,
    }

# ═══════════════════════════════════════════════════
#  MEAL SCORING
# ═══════════════════════════════════════════════════

def score_meal(food: dict, profile: dict) -> dict:
    n       = food.get('nutrition', {})
    targets = calculate_targets(profile)
    daily   = targets['dailyCalories']
    meal_t  = daily / 3
    score   = 100.0
    bd      = {}

    # Calorie fit (penalty up to 25)
    cal_diff  = abs(n.get('calories', 500) - meal_t) / meal_t
    cal_pen   = min(25, cal_diff * 50)
    score    -= cal_pen
    bd['calorieFit'] = round(25 - cal_pen)

    # Protein bonus
    p_bonus   = min(15, (n.get('protein', 0) / targets['proteinTarget']) * 30) - 5
    score    += p_bonus
    bd['protein'] = round(p_bonus)

    # Fiber bonus
    f_bonus   = min(10, n.get('fiber', 0) * 1.5)
    score    += f_bonus
    bd['fiber'] = round(f_bonus)

    # Sugar penalty
    sugar_lim = 5 if profile.get('primaryGoal') == 'Manage diabetes' else 15
    s_pen     = min(15, max(0, (n.get('sugar', 0) - sugar_lim) * 1.5))
    score    -= s_pen
    bd['sugar'] = -round(s_pen)

    # Sodium penalty
    sod_lim   = 400 if profile.get('dietPreference') == 'Low sodium' else 800
    sod_pen   = min(15, max(0, (n.get('sodium', 0) - sod_lim) / 60))
    score    -= sod_pen
    bd['sodium'] = -round(sod_pen)

    # Goal adjustments
    goal = profile.get('primaryGoal', '')
    if goal == 'Lose weight'     and n.get('fat', 0) > 20:    score -= min(10, (n['fat'] - 20) * 0.8)
    if goal == 'Build muscle'    and n.get('protein', 0) > 30: score += 8
    if goal == 'Heart health'    and n.get('sodium', 0) < 400: score += 6
    if goal == 'Manage diabetes' and n.get('fiber', 0) > 8:    score += 8

    # Diet match bonus
    tags = food.get('dietTags', [])
    diet = profile.get('dietPreference', 'No restriction')
    if diet != 'No restriction':
        if diet in tags: score += 12;  bd['dietMatch'] = 12
        else:            score -= 5

    # Allergen hard disqualifier
    allergy_map = {
        'Nuts / Tree nuts': 'nuts', 'Dairy / Lactose': 'dairy', 'Eggs': 'eggs',
        'Shellfish': 'shellfish', 'Soy': 'soy', 'Gluten / Wheat': 'gluten',
    }
    for ua in profile.get('allergies', []):
        key = allergy_map.get(ua)
        if key and key in food.get('allergens', []):
            score = 0
            bd['allergenDisqualified'] = True
            break

    final = int(min(100, max(0, round(score))))
    band  = ('Excellent' if final >= 85 else 'Good' if final >= 70
             else 'Moderate' if final >= 55 else 'Poor')
    return {'score': final, 'band': band, 'breakdown': bd, 'targets': targets}


def generate_insights(food: dict, profile: dict, scored: dict) -> list:
    n       = food.get('nutrition', {})
    targets = scored['targets']
    insights= []
    cal_pct = round(n.get('calories', 0) / targets['dailyCalories'] * 100)
    insights.append(f"Provides {cal_pct}% of your {targets['dailyCalories']} kcal daily target.")
    prot    = n.get('protein', 0)
    p_pct   = round(prot / targets['proteinTarget'] * 100)
    if prot >= 25:
        insights.append(f"Excellent protein: {prot}g ({p_pct}% of daily target).")
    elif prot >= 15:
        insights.append(f"Moderate protein: {prot}g ({p_pct}% of daily target).")
    else:
        insights.append(f"Low protein ({prot}g). Consider pairing with a protein source.")
    if n.get('fiber', 0) >= 6:
        insights.append(f"High in fiber ({n['fiber']}g) — great for digestion and satiety.")
    if scored['breakdown'].get('allergenDisqualified'):
        insights.append("⚠️ Contains your listed allergens. Do not order this meal.")
    if profile.get('primaryGoal') == 'Manage diabetes' and n.get('sugar', 0) > 10:
        insights.append(f"Sugar content ({n.get('sugar', 0)}g) may affect blood sugar management.")
    return insights

# ═══════════════════════════════════════════════════
#  KNN RANKING
# ═══════════════════════════════════════════════════

def build_feature_vector(food: dict, targets: dict) -> list:
    n       = food.get('nutrition', {})
    daily   = targets['dailyCalories']
    cal_fit = 1 - min(1, abs(n.get('calories', 500) - daily / 3) / (daily / 3))
    p_fit   = min(1, n.get('protein', 0) / targets['proteinTarget'])
    f_fit   = min(1, n.get('fiber', 0) / 25)
    sug_fit = 1 - min(1, n.get('sugar', 0) / 30)
    sod_fit = 1 - min(1, n.get('sodium', 0) / 1500)
    fat_fit = 1 - min(1, n.get('fat', 0) / 60)
    rat_fit = (food.get('rating', 4) - 1) / 4
    return [cal_fit, p_fit, f_fit, sug_fit, sod_fit, fat_fit, rat_fit]


def rank_with_knn(foods: list, profile: dict, targets: dict) -> list:
    if len(foods) < 2:
        return foods
    goal   = profile.get('primaryGoal', 'Maintain weight')
    ideal  = IDEAL_VECTORS.get(goal, IDEAL_VECTORS['Maintain weight'])
    matrix = [build_feature_vector(f, targets) for f in foods] + [ideal]
    df     = pd.DataFrame(matrix)
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(df)
    fv     = scaled[:-1]
    iv     = scaled[-1].reshape(1, -1)
    k      = min(len(foods), 15)
    knn    = NearestNeighbors(n_neighbors=k, metric='euclidean')
    knn.fit(fv)
    _, indices = knn.kneighbors(iv)
    seen, ranked = set(), []
    for idx in indices[0]:
        if idx not in seen:
            ranked.append(foods[idx])
            seen.add(idx)
    for i, f in enumerate(foods):
        if i not in seen:
            ranked.append(f)
    return ranked

# ═══════════════════════════════════════════════════
#  FLASK ROUTES
# ═══════════════════════════════════════════════════

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'module': 'NutriFit AI', 'version': '2.0.0'})


@app.route('/bmi', methods=['GET'])
def bmi_route():
    try:
        h = float(request.args.get('height', 0))
        w = float(request.args.get('weight', 0))
        if not h or not w:
            return jsonify({'error': 'height and weight required'}), 400
        return jsonify(calculate_bmi(w, h))
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/calorie-plan', methods=['POST'])
def calorie_plan():
    try:
        data    = request.json or {}
        profile = data.get('profile', data)
        targets = calculate_targets(profile)
        return jsonify({'success': True, 'targets': targets})
    except Exception as e:
        log.error(f'calorie-plan: {e}')
        return jsonify({'error': str(e)}), 400


@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data    = request.json or {}
        food    = data.get('food', {})
        profile = data.get('profile', {})
        result  = score_meal(food, profile)
        result['insights']  = generate_insights(food, profile, result)
        result['foodName']  = food.get('name', 'Unknown')
        return jsonify({'success': True, **result})
    except Exception as e:
        log.error(f'analyze: {e}')
        return jsonify({'error': str(e)}), 400


@app.route('/recommend', methods=['POST'])
def recommend():
    try:
        data    = request.json or {}
        foods   = data.get('foods', [])
        profile = data.get('profile', {})
        if not foods:
            return jsonify({'error': 'foods list required'}), 400
        targets = calculate_targets(profile)
        scored  = []
        for food in foods:
            r = score_meal(food, profile)
            if r['score'] > 0:
                scored.append({**food, 'aiScore': r['score'], 'band': r['band']})
        ranked = rank_with_knn(scored, profile, targets)
        return jsonify({'success': True, 'total': len(ranked), 'ranked': ranked, 'targets': targets})
    except Exception as e:
        log.error(f'recommend: {e}')
        return jsonify({'error': str(e)}), 400


@app.route('/nutrition-plan', methods=['POST'])
def nutrition_plan():
    try:
        data    = request.json or {}
        profile = data.get('profile', data)
        targets = calculate_targets(profile)
        t       = targets
        plan = {
            'breakfast': {'calories': round(t['dailyCalories']*0.25), 'protein': round(t['proteinTarget']*0.25), 'carbs': round(t['carbTarget']*0.30), 'fat': round(t['fatTarget']*0.25)},
            'lunch':     {'calories': round(t['dailyCalories']*0.35), 'protein': round(t['proteinTarget']*0.35), 'carbs': round(t['carbTarget']*0.35), 'fat': round(t['fatTarget']*0.35)},
            'dinner':    {'calories': round(t['dailyCalories']*0.30), 'protein': round(t['proteinTarget']*0.30), 'carbs': round(t['carbTarget']*0.25), 'fat': round(t['fatTarget']*0.30)},
            'snacks':    {'calories': round(t['dailyCalories']*0.10), 'protein': round(t['proteinTarget']*0.10), 'carbs': round(t['carbTarget']*0.10), 'fat': round(t['fatTarget']*0.10)},
        }
        return jsonify({'success': True, 'targets': targets, 'mealPlan': plan})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('FLASK_ENV') == 'development')
