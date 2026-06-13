const express = require('express');
const { createTopic, getTopics } = require('../controllers/topicController');
const { protect, authorize } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, authorize('Admin', 'Manager'), createTopic);
router.get('/', protect, getTopics);

module.exports = router;