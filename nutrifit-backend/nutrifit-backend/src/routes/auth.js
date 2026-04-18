// ═══════════════════════════════════════════════
//  src/routes/auth.js
// ═══════════════════════════════════════════════
console.log("AUTH FILE LOADED ✅");
const express = require('express');
const { body } = require('express-validator');
const ctrl  = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

const registerRules = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', registerRules, ctrl.register);
router.post('/login',    loginRules,    ctrl.login);
router.post('/logout',   protect,       ctrl.logout);
router.get('/me',        protect,       ctrl.getMe);
router.put('/update',    protect,       ctrl.updateProfile);
router.put('/change-password', protect, ctrl.changePassword);

module.exports = router;
