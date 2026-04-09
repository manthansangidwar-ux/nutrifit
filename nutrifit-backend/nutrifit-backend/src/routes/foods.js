const express = require('express');
const ctrl    = require('../controllers/foodController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// Public (authenticated)
router.get('/',     ctrl.getFoods);
router.get('/:id',  ctrl.getFood);

// Admin only
router.post('/',    restrictTo('admin'), ctrl.createFood);
router.put('/:id',  restrictTo('admin'), ctrl.updateFood);

module.exports = router;
