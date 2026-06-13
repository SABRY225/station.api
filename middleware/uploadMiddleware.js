const multer = require('multer');
const path = require('path');

// تحديد مكان الحفظ واسم الملف المرفوع
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // هيتحفظ في فولدر الـ uploads بالسيرفر
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // اسم فريد باستخدام التاريخ
  }
});

const upload = multer({ storage: storage });

module.exports = upload;