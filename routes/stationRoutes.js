const express = require('express');
const { createStation, getStations, getStationById, shareStationEmail, createBulkStations, sendBulkReportToManager, generateStationsPdfReport } = require('../controllers/stationController');
const { protect ,authorize} = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const router = express.Router();

// نستخدم array('files', 5) للسماح برفع حتى 5 ملفات معاً في الفورم
router.post('/', protect, upload.array('files', 5), createStation);
router.post('/bulk', protect, upload.any(), createBulkStations);
router.post('/report/manager', protect,authorize('Admin', 'Manager'), sendBulkReportToManager);
router.post('/report/pdf', protect, generateStationsPdfReport);
router.get('/', protect, getStations);
router.get('/:id', protect, getStationById);
router.post('/:id/share-email',protect, authorize('Admin', 'Manager'), shareStationEmail);

module.exports = router;