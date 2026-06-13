const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'غير مصرح، خطأ في التوكين' });
    }
  }
  if (!token) return res.status(401).json({ message: 'غير مصرح، لا يوجد توكين' });
};

// فلاتر الصلاحيات (الأدوار)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'ليس لديك الصلاحية للقيام بهذا الإجراء' });
    }
    next();
  };
};

module.exports = { protect, authorize };