const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// تحميل المتغيرات البيئية
dotenv.config();

// الاتصال بقاعدة البيانات
connectDB();

const app = express();

// الـ Middlewares العامة - تم تحديث الـ CORS لحل مشكلة تحميل التقارير والـ PDF
app.use(cors({
  origin: function (origin, callback) {
    // قائمة المواقع المسموح لها بالوصول للنظام
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000', // لضمان العمل لو تغير منفذ React المحلي
      'https://station.intelakah.com'
    ];
    
    // السماح بالطلبات التي لا تحتوي على Origin (مثل تطبيقات الموبايل أو أدوات الفحص كـ Postman)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS Policy - Digital Monitoring System'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Disposition'], // كريسيتال حيوي: لكي يتمكن الـ Frontend من قراءة اسم ملف الـ PDF المولد
  credentials: true // للسماح بنقل الكوكيز وجلسات العمل الآمنة إن وجدت
}));

app.use(express.json()); // لقراءة الـ JSON body

// جعل مجلد الـ uploads عام ومتاح لتحميل وقراءة الملفات منه عبر المتصفح
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.send('API is running 🚀');
});

// تعريف المسارات (API Routes)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/topics', require('./routes/topicRoutes'));
app.use('/api/stations', require('./routes/stationRoutes'));

// تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});