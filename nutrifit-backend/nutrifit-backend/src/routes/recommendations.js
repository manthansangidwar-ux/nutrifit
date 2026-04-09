const express = require('express');
const ctrl    = require('../controllers/recommendationController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/',         ctrl.getRecommendations);
router.get('/top',      ctrl.getTopPicks);
router.post('/analyze', ctrl.analyzeMeal);

module.exports = router;
