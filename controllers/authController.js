const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// إنشاء حساب جديد (مبدئياً للأدمن والمستخدمين)
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'المستخدم موجود بالفعل' });

    const user = await User.create({ name, email, password, role });
    res.status(201).json({
      _id: user._id, name: user.name, email: user.email, role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// تسجيل الدخول
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id, name: user.name, email: user.email, role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUsers = async (req,res) =>{
    try {
        const users = await User.find().select('-password'); // استبعاد الباسورد من النتيجة
        res.json(users);
    } catch (error) {
    res.status(500).json({ message: error.message });

    }
}

// @desc    تحديث إعدادات البريد الإلكتروني للمستخدم الحالي
// @route   PUT /api/auth/email-settings
// @access  Private
exports.updateEmailSettings = async (req, res) => {
  const { smtpEmail, smtpPass } = req.body;

  try {
    // req.user.id يأتي من ميدل وير الحماية (protect) بعد فك التوكن
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    // تحديث البيانات
    if (smtpEmail) user.smtpEmail = smtpEmail;
    if (smtpPass) user.smtpPass = smtpPass;

    await user.save();
    res.json({ message: 'تم حفظ إعدادات البريد الإلكتروني بنجاح.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};