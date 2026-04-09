const express = require('express');
const ctrl    = require('../controllers/mealLogController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.post('/',          ctrl.logMeal);
router.get('/today',      ctrl.getTodayLogs);
router.get('/history',    ctrl.getHistory);
router.delete('/:id',     ctrl.deleteLog);

module.exports = router;
