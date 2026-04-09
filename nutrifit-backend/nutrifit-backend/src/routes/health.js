const express = require('express');
const ctrl    = require('../controllers/healthController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.post('/profile',  ctrl.saveProfile);
router.get('/profile',   ctrl.getProfile);
router.get('/bmi',       ctrl.calculateBMI);
router.get('/targets',   ctrl.getTargets);

module.exports = router;
