const express = require('express');
const { registerUser, loginUser, getUsers, updateEmailSettings } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/users',getUsers);
router.put('/email-settings', protect, updateEmailSettings);

module.exports = router;