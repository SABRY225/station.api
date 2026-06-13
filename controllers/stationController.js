const Station = require('../models/Station');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Attachment = require('../models/Attachment');
exports.createStation = async (req, res) => {
  try {
    // البيانات القادمة من الفورم (تأتي كـ Strings بسبب استخدام multipart/form-data لوجود ملفات)
    const { topicId, stationName, governorate, workerName, electricityReading, gasReading, visitDate, status, notes } = req.body;
    
    const station = await Station.create({
      topicId, stationName, governorate, workerName,
      electricityReading, gasReading, visitDate, status, notes,
      createdBy: req.user._id // بيجي من الـ protect middleware
    });

    // لو المستخدم رفع ملفات، نسجلها في جدول الـ Attachments
    if (req.files && req.files.length > 0) {
      const attachmentsData = req.files.map(file => ({
        stationId: station._id,
        fileName: file.originalname,
        filePath: file.path
      }));
      await Attachment.insertMany(attachmentsData);
    }

    res.status(201).json({ message: 'تم حفظ المحطة والبيانات بنجاح', station });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.createBulkStations = async (req, res) => {
  try {
    const stationsData = req.body.stations; // سيحتوي على مصفوفة المحطات المرسلة
    
    if (!stationsData || !Array.isArray(stationsData) || stationsData.length === 0) {
      return res.status(400).json({ message: 'لا توجد بيانات محطات صالحة لمعالجتها.' });
    }

    const savedStations = [];

    // نمر على كل محطة لحفظها بشكل مستقل لضمان ربط ملفاتها الصحيحة بها
    for (let i = 0; i < stationsData.length; i++) {
      const currentStation = stationsData[i];
      
      // جلب الملفات المخصصة لهذه المحطة تحديداً (تأتي من multer مسمية بالـ index)
      const fileKey = `station_files_${i}`;
      let stationUploadedFiles = [];
      
      if (req.files && req.files[fileKey]) {
        // إذا كنت ترفع على Cloudinary أو تحفظ المسار محلياً:
        stationUploadedFiles = req.files[fileKey].map(file => file.path || file.filename);
      }

      // بناء الموديل الجديد للمحطة الحالية
      const newStation = new Station({
        topicId: currentStation.topicId,
        stationName: currentStation.stationName,
        governorate: currentStation.governorate,
        workerName: currentStation.workerName,
        electricityReading: currentStation.electricityReading || 0,
        gasReading: currentStation.gasReading || 0,
        visitDate: currentStation.visitDate,
        status: currentStation.status || 'Active',
        notes: currentStation.notes,
        attachments: stationUploadedFiles, // إرفاق مصفوفة الملفات الخاصة بها
        createdBy: req.user.id // المفتش الحالي
      });

      const saved = await newStation.save();
      savedStations.push(saved);
    }

    res.status(201).json({
      message: `تم بنجاح حفظ وتدشين عدد (${savedStations.length}) محطة بالمنظومة.`,
      data: savedStations
    });

  } catch (error) {
    console.error('Bulk Insert Error:', error);
    res.status(500).json({ message: 'حدث خطأ في السيرفر أثناء معالجة الإدخال الجماعي.', error: error.message });
  }
};

const htmlPdf = require('html-pdf-node');
exports.generateStationsPdfReport = async (req, res) => {
  const { stationIds } = req.body;

  if (!stationIds || stationIds.length === 0) {
    return res.status(400).json({ message: 'برجاء تحديد محطة واحدة على الأقل لتوليد التقرير.' });
  }

  try {
    // 1. جلب بيانات المحطات المحددة من قاعدة البيانات
    const selectedStations = await Station.find({ _id: { $in: stationIds } }).sort({ createdAt: -1 });

    if (!selectedStations || selectedStations.length === 0) {
      return res.status(404).json({ message: 'لم يتم العثور على أي بيانات للمحطات المحددة.' });
    }

    // 2. بناء سطور الجدول ديناميكياً
    let tableRows = '';
    selectedStations.forEach((station, index) => {
      tableRows += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; text-align: center; font-weight: bold; background-color: #f8fafc; font-size: 11px;">${index + 1}</td>
          <td style="padding: 12px; font-weight: bold; color: #0f172a; font-size: 12px;">${station.stationName}</td>
          <td style="padding: 12px; color: #334155; font-size: 12px;">${station.governorate}</td>
          <td style="padding: 12px; color: #334155; font-size: 12px;">${station.workerName || 'غير محدد'}</td>
          <td style="padding: 12px; color: #b45309; font-weight: bold; font-family: 'Arial'; font-size: 13px;">${(station.electricityReading || 0).toLocaleString('ar-EG')}</td>
          <td style="padding: 12px; color: #c2410c; font-weight: bold; font-family: 'Arial'; font-size: 13px;">${(station.gasReading || 0).toLocaleString('ar-EG')}</td>
          <td style="padding: 12px; color: #334155; font-family: 'Arial'; font-size: 12px;">${station.visitDate ? new Date(station.visitDate).toLocaleDateString('ar-EG') : '—'}</td>
        </tr>
      `;
    });

    // 3. الهيكل الكامل لصفحة الـ HTML (تم تحسين الاستقرار)
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير المحطات المجمع</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; background-color: #ffffff; }
          .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 25px; border-radius: 12px; color: white; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
          .header p { margin: 6px 0 0 0; font-size: 11px; color: #94a3b8; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #e2e8f0; }
          th { background-color: #0f172a; color: white; padding: 12px; text-align: right; font-size: 11px; font-weight: 700; }
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير فحص ومتابعة المحطات المجمع</h1>
          <p>تم استخراج هذا التقرير رسمياً بتاريخ: ${new Date().toLocaleDateString('ar-EG')} | إجمالي المحطات المرفقة: ${selectedStations.length}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th>اسم المحطة</th>
              <th>المحافظة</th>
              <th>القائم بالأعمال</th>
              <th>مقايسة الكهرباء</th>
              <th>مقايسة الغاز</th>
              <th>تاريخ الزيارة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="footer">
          هذا التقرير تم توليده تلقائياً عبر الأنظمة الداخلية للمنظومة الرقمية لإدارة المحطات &copy; 2026
        </div>
      </body>
      </html>
    `;

    // 4. خيارات توليد الـ PDF
    const options = { format: 'A4', margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } };
    const file = { content: htmlContent };

    // 🌟 التعديل الجوهري: تحويل الـ Promise القديم إلى await لمنع تعليق السيرفر (Uncaught Exception Crashes)
    const pdfBuffer = await htmlPdf.generatePdf(file, options);

    // 5. إرسال الهيدرز والـ Buffer بأمان
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': 'attachment; filename=report.pdf', 
      'Access-Control-Expose-Headers': 'Content-Disposition' // يخبر المتصفح بالسماح بقراءة اسم الملف
    });

    return res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF Generation Error:', error);
    // حماية تامة: في حال فشل التوليد، لا يسقط السيرفر (503)، بل يرجع كود 500 منظم ومفهوم للفرونت إند
    if (!res.headersSent) {
      return res.status(500).json({ 
        message: 'حدث خطأ بالسيرفر أثناء محاولة توليد ملف الـ PDF.', 
        error: error.message 
      });
    }
  }
};
exports.getStations = async (req, res) => {
  try {
    let query = {};

    // Filter by Visit Date
if (req.query.visitDateFrom) {
  const startDate = new Date(req.query.visitDateFrom);
  const endDate = new Date(req.query.visitDateFrom);

  endDate.setHours(23, 59, 59, 999);

  query.visitDate = {
    $gte: startDate,
    $lte: endDate
  };
}

    // Filter by Created Date
if (req.query.createdAtFrom) {
  const startDate = new Date(req.query.createdAtFrom);
  const endDate = new Date(req.query.createdAtFrom);

  endDate.setHours(23, 59, 59, 999);

  query.createdAt = {
    $gte: startDate,
    $lte: endDate
  };
}

    // Filter by Governorate
    if (
      req.query.governorate &&
      req.query.governorate.trim() !== ''
    ) {
      query.governorate = {
        $regex: req.query.governorate.trim(),
        $options: 'i'
      };
    }
  
    const stations = await Station.find(query)
      .sort({ createdAt: -1 });

    res.json(stations);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
exports.sendBulkReportToManager = async (req, res) => {
  const { stationIds } = req.body; // مصفوفة الـ IDs المرسلة من خانات الاختيار بالفرونت
  const currentUserId = req.user.id; 

  if (!stationIds || stationIds.length === 0) {
    return res.status(400).json({ message: 'يرجى تحديد المحطات المطلوب تضمينها بالتقرير.' });
  }

  try {
    // 1. جلب بيانات المرسل (المفتش الحالي) وإعدادات بريده
    const currentUser = await User.findById(currentUserId);
    if (!currentUser?.smtpEmail) {
      return res.status(400).json({ message: 'برجاء تهيئة إعدادات البريد الإلكتروني الخاصة بك أولاً.' });
    }

    // 2. جلب الحساب الخاص بالمدير (نبحث عن أول مستخدم بدوره Admin أو Manager)
    const manager = await User.findOne({ role: 'Manager' });
    if (!manager) return res.status(404).json({ message: 'لم يتم العثور على حساب المدير بالنظام لاستقبال التقرير.' });

    // 3. جلب بيانات كافة المحطات المحددة فقط
    const selectedStations = await Station.find({ _id: { $in: stationIds } });

    // 4. صياغة التقرير المجمع داخل جدول HTML فخم جداً للمدير
    let rowsHtml = '';
    selectedStations.forEach((s, idx) => {
      rowsHtml += `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155;">
          <td style="padding: 10px; font-weight: bold; text-align: center; background-color: #f8fafc;">${idx + 1}</td>
          <td style="padding: 10px; font-weight: bold; color: #0f172a;">${s.stationName}</td>
          <td style="padding: 10px;">${s.governorate}</td>
          <td style="padding: 10px;">${s.workerName}</td>
          <td style="padding: 10px; font-weight: bold; color: #b45309; font-family: Arial;">${s.electricityReading || 0}</td>
          <td style="padding: 10px; font-weight: bold; color: #c2410c; font-family: Arial;">${s.gasReading || 0}</td>
          <td style="padding: 10px; font-family: Arial;">${new Date(s.visitDate).toLocaleDateString('ar-EG')}</td>
        </tr>
      `;
    });

    const transporter = nodemailer.createTransport({
      host: "station.intelakah.com",
      port: 465,
      secure: true,
      auth: { user: currentUser.smtpEmail, pass: currentUser.smtpPass }
    });

    const mailOptions = {
      from: `"${currentUser.name}" <${currentUser.smtpEmail}>`,
      to: manager.email, // بريد المدير المستهدف تلقائياً
      subject: `📊 تقرير مجمع شامل - عدد المحطات المرفقة (${selectedStations.length})`,
      html: `
        <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 750px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; border-radius: 12px; color: white; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 18px;">تقرير فحص ومتابعة المحطات المجمع</h2>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #94a3b8;">تم إصدار هذا التقرير بناءً على الفلترة والتحديد اليدوي بواسطة: ${currentUser.name}</p>
          </div>

          <table width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; text-align: right;">
            <thead>
              <tr style="background-color: #0f172a; color: white; font-size: 12px;">
                <th style="padding: 12px; text-align: center; width: 40px;">#</th>
                <th style="padding: 12px;">اسم المحطة</th>
                <th style="padding: 12px;">المحافظة</th>
                <th style="padding: 12px;">القائم بالأعمال</th>
                <th style="padding: 12px;">مقايسة الكهرباء</th>
                <th style="padding: 12px;">مقايسة الغاز</th>
                <th style="padding: 12px;">تاريخ الزيارة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 25px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px;">
            إنشاء تلقائي رسمي عبر لوحة المتابعة الرقمية للمنظومة &copy; 2026
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'تم إرسال التقرير المجمع للمدير بنجاح' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'فشل السيرفر في معالجة التقرير وإرساله.' });
  }
};
exports.getStationById = async (req, res) => {
  try {
    const station = await Station.findById(req.params.id)
      .populate('topicId', 'name')
      .populate('createdBy', 'name');
      
    if (!station) return res.status(404).json({ message: 'المحطة غير موجودة' });

    const attachments = await Attachment.find({ stationId: station._id });

    res.json({ station, attachments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.shareStationEmail = async (req, res) => {
    console.log(req.params);
    console.log(req.user);
    
  const { email:toEmail } = req.body; // نستقبل فقط إيميل الشخص المستلِم
  const stationId = req.params.id;
  const currentUserId = req.user.id; // المعرف الخاص بالمستخدم الحالي الذي يرسل الآن

  if (!toEmail) {
    return res.status(400).json({ message: 'يرجى تحديد البريد الإلكتروني للمستقبل.' });
  }

  try {
    // 1. جلب بيانات إعدادات البريد الخاصة بالمستخدم الحالي من قاعدة البيانات
    const currentUser = await User.findById(currentUserId);
    if (!currentUser || !currentUser.smtpEmail || !currentUser.smtpPass) {
      return res.status(400).json({ 
        message: 'لم تقم بتهيئة إعدادات بريدك الإلكتروني بعد. يرجى الذهاب لصفحة الإعدادات أولاً لحفظ بريدك وباسوورد التطبيق.' 
      });
    }

    // 2. جلب بيانات المحطة
    const station = await Station.findById(stationId).populate('topicId', 'name');
    if (!station) return res.status(404).json({ message: 'المحطة غير موجودة' });

    // 3. إنشاء الـ Transporter الديناميكي تلقائياً من بيانات المستخدم المستخرجة
    const transporter = nodemailer.createTransport({
       host: "station.intelakah.com",
      port: 465,
      secure: true,
      auth: {
        user: currentUser.smtpEmail,
        pass: currentUser.smtpPass // تأتي تلقائياً من الداتابيز
      }
    });

    // 4. خيارات البريد
const mailOptions = {
  from: `"${currentUser.name}" <${currentUser.smtpEmail}>`,
  to: toEmail,
  subject: `📋 تقرير فحص ومتابعة: ${station.stationName}`,
  html: `
    <div dir="rtl" style="background-color: #f8fafc; padding: 30px 15px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; min-height: 100%;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); border-collapse: collapse;">
        
        <tr>
          <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px 24px; text-align: center;">
            <span style="background-color: rgba(6, 182, 212, 0.15); color: #22d3ee; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(6, 182, 212, 0.2); display: inline-block; margin-bottom: 8px; letter-spacing: 0.5px;">منظومة المتابعة الرقمية</span>
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; tracking-tight: -0.5px;">تقرير زيارة ميدانية رسمي</h2>
          </td>
        </tr>

        <tr>
          <td style="padding: 24px;">
            <p style="font-size: 14px; color: #334155; margin: 0 0 20px 0; line-height: 1.6;">
              مرحباً، <br />
              مرفق لكم تفاصيل القراءات والبيانات الفنية المسجلة للمحطة أدناه، والتي تم إرسالها وتدقيقها بواسطة المشرف: 
              <strong style="color: #0f172a; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px;">${currentUser.name}</strong>.
            </p>

            <table width="100%" style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; margin-bottom: 20px; border-collapse: collapse;">
              <tr>
                <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0;">
                  <span style="font-size: 12px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">اسم المحطة التابع لها</span>
                  <span style="font-size: 14px; color: #0f172a; font-weight: 800;">${station.stationName}</span>
                </td>
                <td style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; width: 40%;">
                  <span style="font-size: 12px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">المحافظة</span>
                  <span style="font-size: 14px; color: #334155; font-weight: 700;">${station.governorate}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 14px 16px;">
                  <span style="font-size: 12px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">الموضوع المشرف عليه</span>
                  <span style="font-size: 13px; color: #334155; font-weight: 700;">${station.topicId?.name || 'عام / غير محدد'}</span>
                </td>
                <td style="padding: 14px 16px;">
                  <span style="font-size: 12px; color: #64748b; font-weight: 600; display: block; margin-bottom: 2px;">تاريخ رصد القراءة</span>
                  <span style="font-size: 13px; color: #334155; font-weight: 700; font-family: sans-serif;">${new Date(station.visitDate).toLocaleDateString('ar-EG')}</span>
                </td>
              </tr>
            </table>

            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
              <tr>
                <td width="49%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; text-align: right;">
                  <span style="font-size: 11px; color: #b45309; font-weight: bold; display: block; margin-bottom: 4px;">⚡ عداد الكهرباء</span>
                  <span style="font-size: 24px; color: #78350f; font-weight: 900; font-family: Arial, sans-serif; line-height: 1;">${(station.electricityReading || 0).toLocaleString('ar-EG')}</span>
                  <span style="font-size: 10px; color: #b45309; font-weight: 600; display: block; margin-top: 4px;">كيلوواط / ساعة</span>
                </td>
                <td width="2%"></td>
                <td width="49%" style="background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 12px; padding: 16px; text-align: right;">
                  <span style="font-size: 11px; color: #c2410c; font-weight: bold; display: block; margin-bottom: 4px;">🔥 عداد الغاز</span>
                  <span style="font-size: 24px; color: #7c2d12; font-weight: 900; font-family: Arial, sans-serif; line-height: 1;">${(station.gasReading || 0).toLocaleString('ar-EG')}</span>
                  <span style="font-size: 10px; color: #c2410c; font-weight: 600; display: block; margin-top: 4px;">متر مكعب ³م</span>
                </td>
              </tr>
            </table>

            <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background-color: #ffffff;">
              <h4 style="margin: 0 0 6px 0; color: #0f172a; font-size: 13px; font-weight: 700; display: flex; items-center: center; gap: 4px;">
                📝 ملاحظات الفحص والزيارة الميدانية:
              </h4>
              <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6; background-color: #fafafa; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                ${station.notes || 'لا توجد ملاحظات أو توصيات استثنائية مسجلة لهذه الزيارة.'}
              </p>
            </div>

          </td>
        </tr>

        <tr>
          <td style="background-color: #f8fafc; padding: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0 0 4px 0; line-height: 1.4;">هذا البريد الإلكتروني مؤمن ومُرسل بشكل آمن عبر النظام الداخلي الخاص بالمنظومة.</p>
            <p style="font-size: 10px; color: #cbd5e1; margin: 0; font-family: sans-serif;">&copy; ${new Date().getFullYear()} Station Management System. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </div>
  `
};

    // 5. الإرسال الفعلي
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'تم إرسال التقرير بنجاح عبر بريدك الشخصي المحفوظ بالمنظومة.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'فشل الإرسال، تأكد من صلاحية إعدادات بريدك المخزنة بالملف الشخصي.' });
  }
};