const express = require('express');
const ctrl    = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.post('/chat',    ctrl.chat);
router.post('/analyze', ctrl.analyzeMeal);

module.exports = router;
