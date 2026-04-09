# NutriFit Backend — Complete API Documentation

## Architecture

```
nutrifit-backend/
├── src/
│   ├── server.js                  ← Express app entry point
│   ├── config/
│   │   └── database.js            ← MongoDB connection
│   ├── models/
│   │   ├── User.js                ← User + HealthProfile schema
│   │   ├── Food.js                ← Food + Restaurant schemas
│   │   └── MealLog.js             ← Daily meal tracking
│   ├── controllers/
│   │   ├── authController.js      ← Register, login, JWT
│   │   ├── healthController.js    ← BMI, calorie calc, profile
│   │   ├── foodController.js      ← Foods & restaurants CRUD
│   │   ├── recommendationController.js ← Scoring algorithm
│   │   ├── mealLogController.js   ← Log meals, daily totals
│   │   └── aiController.js        ← Anthropic API chat
│   ├── middleware/
│   │   ├── auth.js                ← JWT protect middleware
│   │   └── errorHandler.js        ← Global error handler
│   ├── routes/
│   │   ├── auth.js
│   │   ├── health.js
│   │   ├── foods.js
│   │   ├── restaurants.js
│   │   ├── recommendations.js
│   │   ├── logs.js
│   │   └── ai.js
│   └── utils/
│       ├── healthCalc.js          ← Mifflin-St Jeor, BMI, scoring
│       ├── appError.js            ← AppError + catchAsync
│       └── logger.js              ← Winston logger
├── ai-module/
│   ├── app.py                     ← Flask + Scikit-learn API
│   ├── requirements.txt
│   └── Dockerfile
├── scripts/
│   └── seed.js                    ← Database seeder
├── .env.example
├── docker-compose.yml
├── Dockerfile.backend
└── package.json
```

---

## Quick Start

### Option A — Docker (recommended)
```bash
cd nutrifit-backend
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
docker-compose up --build
# Seed the database (first time only):
docker exec nutrifit-backend npm run seed
```

### Option B — Manual

**Prerequisites:** Node.js 18+, MongoDB 6+, Python 3.9+

```bash
# 1. Backend
cd nutrifit-backend
npm install
cp .env.example .env       # fill in values
npm run seed               # seed DB
npm run dev                # starts on port 5000

# 2. Python AI module (optional)
cd ai-module
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py              # starts on port 8000
```

---

## Environment Variables

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/nutrifit
JWT_SECRET=your_long_random_secret_min_32_chars
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
ANTHROPIC_API_KEY=sk-ant-...
AI_MODULE_URL=http://localhost:8000
CLIENT_URL=http://localhost:5173
LOG_LEVEL=info
```

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected routes require:
```
Authorization: Bearer <jwt_token>
```

---

### Auth Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ✗ | Register new user |
| POST | `/auth/login` | ✗ | Login, returns JWT |
| POST | `/auth/logout` | ✓ | Logout (clears cookie) |
| GET  | `/auth/me` | ✓ | Get current user |
| PUT  | `/auth/update` | ✓ | Update name/phone |
| PUT  | `/auth/change-password` | ✓ | Change password |

**Register body:**
```json
{
  "firstName": "Arjun",
  "lastName": "Kulkarni",
  "email": "arjun@example.com",
  "phone": "9876543210",
  "password": "SecurePass123"
}
```

**Login body:**
```json
{ "email": "arjun@example.com", "password": "SecurePass123" }
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": { "id": "...", "firstName": "Arjun", "isProfileComplete": false }
}
```

---

### Health Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/health/profile` | Save/update health profile |
| GET  | `/health/profile` | Get user's health profile |
| GET  | `/health/bmi?height=170&weight=70` | Quick BMI calculation |
| GET  | `/health/targets` | Get daily calorie/macro targets |

**Save Profile body:**
```json
{
  "dateOfBirth": "1997-06-15",
  "gender": "Male",
  "height": 175,
  "weight": 72,
  "activityLevel": "Moderately active",
  "primaryGoal": "Build muscle",
  "dietPreference": "No restriction",
  "nutritionalNeeds": ["High protein", "High fiber"],
  "medicalConditions": [],
  "allergies": ["Dairy / Lactose"],
  "cuisinePreferences": ["North Indian", "Continental"],
  "city": "Pune"
}
```

---

### Food & Restaurant Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/foods` | List foods (with filters) |
| GET | `/foods/:id` | Single food detail |
| GET | `/restaurants` | List restaurants |
| GET | `/restaurants/:id` | Restaurant + full menu |

**Food query params:**
- `category` — Breakfast / Lunch / Dinner / Snack
- `diet` — Vegetarian / Vegan / High protein / etc.
- `cuisine` — Indian / Continental / etc.
- `maxCal` — max calories (e.g. 500)
- `minProtein` — min protein grams (e.g. 20)
- `search` — full text search
- `page`, `limit` — pagination

---

### Recommendation Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/recommendations` | Personalized ranked meals |
| GET  | `/recommendations/top` | Top 5 picks for today |
| POST | `/recommendations/analyze` | Score + insights for one meal |

**Recommendations query params:**
- `sort` — score / rating / cal-asc / protein / price
- `maxCal` — calorie ceiling
- `category`, `diet` — filters
- `page`, `limit`

**Analyze body:**
```json
{ "foodId": "65ab1234..." }
```

---

### Meal Log Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/logs` | Log a meal |
| GET    | `/logs/today` | Today's logs + macro progress |
| GET    | `/logs/history?days=7` | Past N days |
| DELETE | `/logs/:id` | Delete a log entry |

**Log meal body:**
```json
{
  "foodId": "65ab1234...",
  "mealType": "Lunch",
  "quantity": 1,
  "notes": "Felt great after this"
}
```

---

### AI Dietitian Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/chat` | Chat with AI dietitian |
| POST | `/ai/analyze` | Get AI analysis of a meal |

**Chat body:**
```json
{
  "messages": [
    { "role": "user", "content": "What should I eat for breakfast?" }
  ]
}
```

---

### Python AI Module Routes (port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/health` | Module health check |
| GET  | `/bmi?height=170&weight=70` | BMI calculation |
| POST | `/calorie-plan` | Full daily targets |
| POST | `/analyze` | Score a meal + insights |
| POST | `/recommend` | KNN-ranked meal list |
| POST | `/nutrition-plan` | Meal distribution plan |

---

## Connecting to the Frontend

In your NutriFit frontend (`NutriFit.html`), update the API calls to point to the backend:

```javascript
const API_BASE = 'http://localhost:5000/api';

// Register
const res = await fetch(`${API_BASE}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName, lastName, email, phone, password }),
});
const data = await res.json();
localStorage.setItem('nf_token', data.token);

// Authenticated request
const token = localStorage.getItem('nf_token');
const profile = await fetch(`${API_BASE}/health/profile`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

// Get recommendations
const recs = await fetch(`${API_BASE}/recommendations?sort=score&maxCal=600`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
```

---

## Admin Credentials (after seeding)
```
Email:    admin@nutrifit.com
Password: Admin@1234
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Framework | Express.js 4 |
| Database | MongoDB 7 + Mongoose 8 |
| Auth | JWT + bcrypt |
| Validation | express-validator |
| Security | helmet, cors, rate-limit, mongo-sanitize |
| Logging | Winston |
| AI Chat | Anthropic Claude API |
| ML Module | Python 3.11, Flask 3, Scikit-learn, Pandas |
| Container | Docker + Docker Compose |
