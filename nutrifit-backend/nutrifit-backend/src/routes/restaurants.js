const express = require('express');
const ctrl    = require('../controllers/foodController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get('/',     ctrl.getRestaurants);
router.get('/:id',  ctrl.getRestaurant);

module.exports = router;
