const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');
const crypto = require('crypto');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

console.log('💳 Razorpay Configuration:', {
  keyId: process.env.RAZORPAY_KEY_ID ? '***' + process.env.RAZORPAY_KEY_ID.slice(-10) : 'NOT SET',
  hasSecret: !!process.env.RAZORPAY_KEY_SECRET
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Email transporter configuration
const gmailEmail = process.env.GMAIL_EMAIL?.trim();
const gmailPassword = process.env.GMAIL_APP_PASSWORD?.trim();

console.log('📧 Email Configuration:', {
  email: gmailEmail ? '***' + gmailEmail.slice(-10) : 'NOT SET',
  hasPassword: !!gmailPassword,
  passwordLength: gmailPassword?.length || 0
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword
  },
  logger: true,
  debug: true
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } }));
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://tathagat:Tathagat123@cluster0.8adckmm.mongodb.net/';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ============ Schemas ============

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String },
  password: { type: String },
  selectedCategory: String,
  selectedExam: String,
  city: String,
  gender: String,
  dob: String,
  profilePic: String,
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const courseSchema = new mongoose.Schema({
  name: String,
  description: String,
  instructor: mongoose.Schema.Types.ObjectId,
  price: Number,
  thumbnail: String,
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const enrollmentSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  courseId: mongoose.Schema.Types.ObjectId,
  enrolledAt: { type: Date, default: Date.now },
  expiresAt: Date,
  status: { type: String, enum: ['active', 'expired', 'completed'], default: 'active' },
  progress: Number
});

const mockTestSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  duration: Number,
  totalQuestions: Number,
  published: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  courseId: mongoose.Schema.Types.ObjectId,
  amount: Number,
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  transactionId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const announcementSchema = new mongoose.Schema({
  title: String,
  content: String,
  type: String,
  priority: String,
  audience: String,
  isActive: { type: Boolean, default: true },
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now }
});

const studyMaterialSchema = new mongoose.Schema({
  title: String,
  description: String,
  subject: String,
  type: String,
  fileUrl: String,
  uploadedBy: mongoose.Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now }
});

const discussionSchema = new mongoose.Schema({
  title: String,
  content: String,
  category: String,
  authorId: mongoose.Schema.Types.ObjectId,
  replies: [{ userId: mongoose.Schema.Types.ObjectId, content: String, createdAt: Date }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const subjectSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  name: { type: String, required: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const questionSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  question: { type: String, required: true },
  questionType: { type: String, enum: ['mcq', 'short-answer', 'long-answer'], default: 'mcq' },
  options: [String],
  correctAnswer: String,
  explanation: String,
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const chapterSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  name: { type: String, required: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const topicSchema = new mongoose.Schema({
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  name: { type: String, required: true },
  description: String,
  isFullTestSection: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const testSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  chapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  title: { type: String, required: true },
  description: String,
  instructions: String,
  duration: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const emailOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Create models
const User = mongoose.model('User', userSchema);
const Course = mongoose.model('Course', courseSchema);
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
const MockTest = mongoose.model('MockTest', mockTestSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const StudyMaterial = mongoose.model('StudyMaterial', studyMaterialSchema);
const Discussion = mongoose.model('Discussion', discussionSchema);
const Subject = mongoose.model('Subject', subjectSchema);
const Question = mongoose.model('Question', questionSchema);
const Chapter = mongoose.model('Chapter', chapterSchema);
const Topic = mongoose.model('Topic', topicSchema);
const Test = mongoose.model('Test', testSchema);
const EmailOtp = mongoose.model('EmailOtp', emailOtpSchema);

// ============ Middleware ============

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.id);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ============ Routes ============

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

// ============ Student/Public Routes ============

// Get published courses for students
app.get('/api/courses/student/published-courses', async (req, res) => {
  try {
    const courses = await Course.find({ published: true })
      .select('name description price thumbnail instructor createdAt')
      .limit(20);

    res.json({
      success: true,
      courses: courses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Phone OTP endpoint
app.post('/api/auth/phone/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    // Generate a random OTP (in production, use a real SMS service like Twilio)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // For demo purposes, just return success
    // In production, send via SMS provider
    console.log(`OTP for ${phoneNumber}: ${otp}`);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      otp: otp // Remove in production!
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Email OTP - Send email
app.post('/api/auth/email/send-email', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Email send request for:', email);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if Gmail credentials are configured
    if (!gmailEmail || !gmailPassword) {
      console.error('❌ Gmail credentials not configured');
      console.error('Email configured:', !!gmailEmail);
      console.error('Password configured:', !!gmailPassword);
      return res.status(500).json({
        success: false,
        message: 'Email service not configured. Please contact support.'
      });
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiration to 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    console.log('🔐 Generated OTP:', otp, 'for email:', email);

    // Save OTP to database (upsert)
    await EmailOtp.findOneAndUpdate(
      { email },
      { email, otp, expiresAt },
      { upsert: true }
    );

    console.log('💾 OTP saved to database');

    // Send email with OTP
    try {
      console.log('📨 Attempting to send email...');
      const mailOptions = {
        from: gmailEmail,
        to: email,
        subject: 'Your OTP for Login - Tathagat Academy',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px;">
              <h2 style="color: #333; text-align: center;">🔐 Your Login OTP</h2>
              <p style="color: #666; text-align: center; font-size: 16px;">
                Your One-Time Password (OTP) for Tathagat Academy is:
              </p>
              <div style="background-color: #007bff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h1 style="color: white; letter-spacing: 2px; margin: 0;">${otp}</h1>
              </div>
              <p style="color: #666; text-align: center;">
                This OTP will expire in 10 minutes.
              </p>
              <p style="color: #999; text-align: center; font-size: 12px; margin-top: 20px;">
                If you didn't request this OTP, please ignore this email.
              </p>
            </div>
          </div>
        `
      };

      console.log('📋 Mail options prepared:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent successfully to ${email} with response:`, info.response);
    } catch (emailError) {
      console.error('❌ Error sending email:', emailError.message);
      console.error('Email error code:', emailError.code);
      console.error('Email error response:', emailError.response);
      console.log(`⚠️ Email send failed but OTP saved to DB: ${otp}`);
    }

    res.json({
      success: true,
      message: 'OTP sent to email successfully'
    });
  } catch (error) {
    console.error('Error in send-email endpoint:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Email OTP - Verify email
app.post('/api/auth/email/verify', async (req, res) => {
  try {
    const { email, otpCode } = req.body;

    console.log('🔍 Verify attempt - Email:', email, 'OTP:', otpCode, 'OTP length:', otpCode?.length);
    console.log('📝 Request body keys:', Object.keys(req.body));
    console.log('📋 Email type:', typeof email, 'OTP type:', typeof otpCode);

    // Validate inputs
    if (!email) {
      console.log('❌ Email is missing or empty');
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (!otpCode) {
      console.log('❌ OTP code is missing or empty');
      return res.status(400).json({ success: false, message: 'OTP code is required' });
    }

    if (otpCode.length !== 6) {
      console.log('❌ OTP code length is invalid:', otpCode.length);
      return res.status(400).json({ success: false, message: 'OTP must be 6 digits' });
    }

    // Find the OTP record
    const otpRecord = await EmailOtp.findOne({ email });

    console.log('📋 OTP Record found:', !!otpRecord);
    if (otpRecord) {
      console.log('📋 Stored OTP:', otpRecord.otp, 'Stored Email:', otpRecord.email);
      console.log('⏰ Expires at:', otpRecord.expiresAt, 'Current time:', new Date());
    }

    if (!otpRecord) {
      console.log('❌ No OTP record found for email:', email);
      return res.status(400).json({ success: false, message: 'OTP not found. Please request a new OTP.' });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      await EmailOtp.deleteOne({ email });
      console.log('⏰ OTP expired for email:', email);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // Verify OTP - trim both for safety
    const storedOtp = otpRecord.otp.toString().trim();
    const receivedOtp = otpCode.toString().trim();

    console.log('🔐 Comparing OTPs - Stored:', `'${storedOtp}'`, 'Received:', `'${receivedOtp}'`);
    if (storedOtp !== receivedOtp) {
      console.log('❌ OTP mismatch');
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
    }

    // OTP is valid - delete it
    await EmailOtp.deleteOne({ email });

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        email,
        name: email.split('@')[0],
        role: 'student',
        isActive: true
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });

    console.log('✅ Email OTP verified successfully for:', email);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      redirectTo: '/user-details'
    });
  } catch (error) {
    console.error('Error verifying email OTP:', error.message, error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ User Routes (Student) ============

// Middleware to verify user token
const userAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Verify token and get user details
app.get('/api/user/verify-token', userAuth, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        city: user.city || '',
        gender: user.gender || '',
        dob: user.dob || '',
        profilePic: user.profilePic || '',
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's enrolled courses (My Courses)
app.get('/api/user/student/my-courses', userAuth, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ studentId: req.user._id })
      .populate('courseId', 'name description price thumbnail instructor')
      .lean();

    const courses = enrollments.map(enr => ({
      _id: enr._id,
      courseId: enr.courseId,
      enrolledAt: enr.enrolledAt,
      status: enr.status,
      progress: enr.progress || 0,
      expiresAt: enr.expiresAt
    }));

    res.json({
      success: true,
      courses: courses
    });
  } catch (error) {
    console.error('Error fetching my courses:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user details
app.post('/api/user/update-details', userAuth, async (req, res) => {
  try {
    const { name, email, phoneNumber, city, gender, dob, profilePic } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        name,
        email,
        phoneNumber,
        city,
        gender,
        dob,
        profilePic,
        updatedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'User details updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phoneNumber: updatedUser.phoneNumber,
        city: updatedUser.city || '',
        gender: updatedUser.gender || '',
        dob: updatedUser.dob || '',
        profilePic: updatedUser.profilePic || '',
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Error updating user details:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save user selected category
app.post('/api/user/save-category', userAuth, async (req, res) => {
  try {
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { selectedCategory: category, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Category saved successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        selectedCategory: updatedUser.selectedCategory
      }
    });
  } catch (error) {
    console.error('Error saving category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Save user selected exam
app.post('/api/user/save-exam', userAuth, async (req, res) => {
  try {
    const { category, exam } = req.body;

    if (!category || !exam) {
      return res.status(400).json({ success: false, message: 'Category and exam are required' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { selectedCategory: category, selectedExam: exam, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Exam saved successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        selectedCategory: updatedUser.selectedCategory,
        selectedExam: updatedUser.selectedExam
      }
    });
  } catch (error) {
    console.error('Error saving exam:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload profile picture
app.post('/api/user/upload-profile', userAuth, async (req, res) => {
  try {
    if (!req.files || !req.files.profilePic) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const file = req.files.profilePic;

    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({ success: false, message: 'File must be an image' });
    }

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'File size must be less than 5MB' });
    }

    const fileName = `${req.user._id}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const uploadPath = `./uploads/${fileName}`;

    file.mv(uploadPath, async (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(500).json({ success: false, message: 'File upload failed' });
      }

      const imageUrl = `/uploads/${fileName}`;

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { profilePic: imageUrl },
        { new: true }
      );

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        url: imageUrl,
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          phoneNumber: updatedUser.phoneNumber,
          city: updatedUser.city || '',
          gender: updatedUser.gender || '',
          dob: updatedUser.dob || '',
          profilePic: updatedUser.profilePic || '',
          role: updatedUser.role
        }
      });
    });
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify and unlock course payment (demo endpoint for testing)
app.post('/api/user/payment/verify-and-unlock', userAuth, async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ success: false, message: 'Course ID is required' });
    }

    // Create enrollment
    const enrollment = new Enrollment({
      studentId: req.user._id,
      courseId: courseId,
      enrolledAt: new Date(),
      status: 'active'
    });

    await enrollment.save();

    // Create payment record
    const payment = new Payment({
      studentId: req.user._id,
      courseId: courseId,
      amount: 0,
      status: 'paid',
      transactionId: 'demo_' + Date.now()
    });

    await payment.save();

    res.json({
      success: true,
      message: 'Course unlocked successfully',
      enrollment: {
        id: enrollment._id,
        status: enrollment.status
      }
    });
  } catch (error) {
    console.error('Error unlocking course:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Payment Routes (Razorpay) ============

// Create Razorpay Order
app.post('/api/pay/create-order', userAuth, async (req, res) => {
  try {
    const { courseId, amount, courseName } = req.body;

    if (!courseId || !amount) {
      return res.status(400).json({ success: false, message: 'CourseId and amount are required' });
    }

    const amountInPaise = Math.round(Number(amount));

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${req.user._id}_${courseId}_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Verify Razorpay Payment
app.post('/api/pay/verify', userAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    // Verify signature
    const signatureBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(signatureBody)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Signature mismatch:', { expected: expectedSignature, received: razorpay_signature });
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Payment verified - create enrollment record
    const enrollment = new Enrollment({
      studentId: req.user._id,
      courseId: courseId,
      enrolledAt: new Date(),
      status: 'active'
    });

    await enrollment.save();

    // Create payment record
    const payment = new Payment({
      studentId: req.user._id,
      courseId: courseId,
      amount: Math.round(Number(req.body.amount || 0) / 100) || 0,
      status: 'paid',
      transactionId: razorpay_payment_id
    });

    await payment.save();

    console.log('✅ Payment verified and enrollment created for user:', req.user._id, 'course:', courseId);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      enrollment: {
        id: enrollment._id,
        status: enrollment.status
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Admin Routes ============

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, role: 'admin' });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
    
    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Dashboard Routes ============

app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalCourses = await Course.countDocuments({ published: true });
    const newEnrollments = await Enrollment.countDocuments({ enrolledAt: { $gte: start7 } });
    const recentPayments = await Payment.find({ createdAt: { $gte: start7 } }).limit(5);
    
    const revenue = recentPayments.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0);

    res.json({
      success: true,
      metrics: {
        users: totalUsers,
        students: totalStudents,
        teachers: totalTeachers,
        courses: totalCourses,
        enroll7: newEnrollments,
        rev7: revenue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ All Students Routes ============

app.get('/api/admin/students', adminAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { role: 'student' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      students,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ All Teachers Routes ============

app.get('/api/admin/teachers', adminAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { role: 'teacher' };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const teachers = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      teachers,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Teacher
app.post('/api/admin/teachers', adminAuth, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if teacher already exists
    const existingTeacher = await User.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = new User({
      name,
      email,
      password: hashedPassword,
      role: 'teacher'
    });

    await teacher.save();
    res.json({ success: true, teacher: teacher.toObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Teacher
app.put('/api/admin/teachers/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, phoneNumber, selectedCategory, selectedExam } = req.body;

    const teacher = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phoneNumber, selectedCategory, selectedExam, updatedAt: Date.now() },
      { new: true }
    ).select('-password');

    res.json({ success: true, teacher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Teacher
app.delete('/api/admin/teachers/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Teacher deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ All Users Routes ============

app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Student
app.put('/api/admin/students/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, phoneNumber, selectedCategory, selectedExam } = req.body;
    
    const student = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phoneNumber, selectedCategory, selectedExam, updatedAt: Date.now() },
      { new: true }
    ).select('-password');

    res.json({ success: true, student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Student
app.delete('/api/admin/students/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Courses Routes ============

app.get('/api/admin/courses', adminAuth, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const courses = await Course.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Course.countDocuments(query);

    res.json({
      success: true,
      courses,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/courses', adminAuth, async (req, res) => {
  try {
    const { name, description, price, thumbnail } = req.body;

    const course = new Course({
      name,
      description,
      price,
      thumbnail,
      instructor: req.user._id
    });

    await course.save();
    res.json({ success: true, course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle Publish Course (MUST come before generic :id route)
app.put('/api/admin/courses/:id/toggle-publish', adminAuth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    course.published = !course.published;
    course.updatedAt = Date.now();
    await course.save();

    res.json({
      success: true,
      message: course.published ? 'Course published' : 'Course unpublished',
      course
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Course
app.put('/api/admin/courses/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, price, thumbnail } = req.body;

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { name, description, price, thumbnail, updatedAt: Date.now() },
      { new: true }
    );

    res.json({ success: true, course });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Course
app.delete('/api/admin/courses/:id', adminAuth, async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Subject Management Routes ============

// Get all courses (for dropdown in course content manager)
app.get('/api/courses', adminAuth, async (req, res) => {
  try {
    const courses = await Course.find({}).select('_id name');
    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get subjects for a course
app.get('/api/subjects/:courseId', adminAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const subjects = await Subject.find({ courseId });
    res.json({ success: true, subjects });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new subject
app.post('/api/subjects', adminAuth, async (req, res) => {
  try {
    const { courseId, name, description } = req.body;
    const subject = new Subject({
      courseId,
      name,
      description
    });
    await subject.save();
    res.json({ success: true, subject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update subject
app.put('/api/subjects/:id', adminAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { name, description, updatedAt: Date.now() },
      { new: true }
    );
    res.json({ success: true, subject });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete subject
app.delete('/api/subjects/:id', adminAuth, async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Subject deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Question Management Routes ============

// Get questions for a subject
app.get('/api/questions/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const questions = await Question.find({ subjectId });
    res.json({ success: true, questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new question
app.post('/api/questions', adminAuth, async (req, res) => {
  try {
    const { subjectId, courseId, question, questionType, options, correctAnswer, explanation, difficulty } = req.body;
    const newQuestion = new Question({
      subjectId,
      courseId,
      question,
      questionType,
      options,
      correctAnswer,
      explanation,
      difficulty
    });
    await newQuestion.save();
    res.json({ success: true, question: newQuestion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update question
app.put('/api/questions/:id', adminAuth, async (req, res) => {
  try {
    const { question, questionType, options, correctAnswer, explanation, difficulty } = req.body;
    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      { question, questionType, options, correctAnswer, explanation, difficulty, updatedAt: Date.now() },
      { new: true }
    );
    res.json({ success: true, question: updatedQuestion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete question
app.delete('/api/questions/:id', adminAuth, async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Question deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Chapter Management Routes ============

// Get chapters for a subject
app.get('/api/chapters/:subjectId', adminAuth, async (req, res) => {
  try {
    const { subjectId } = req.params;
    const chapters = await Chapter.find({ subjectId });
    res.json({ success: true, chapters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new chapter
app.post('/api/chapters', adminAuth, async (req, res) => {
  try {
    const { subjectId, courseId, name, description } = req.body;
    const chapter = new Chapter({
      subjectId,
      courseId,
      name,
      description
    });
    await chapter.save();
    res.json({ success: true, chapter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update chapter
app.put('/api/chapters/:id', adminAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const chapter = await Chapter.findByIdAndUpdate(
      req.params.id,
      { name, description, updatedAt: Date.now() },
      { new: true }
    );
    res.json({ success: true, chapter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete chapter
app.delete('/api/chapters/:id', adminAuth, async (req, res) => {
  try {
    await Chapter.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Chapter deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Topic Management Routes ============

// Get topics for a chapter
app.get('/api/topics/:chapterId', adminAuth, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const topics = await Topic.find({ chapterId });
    res.json({ success: true, topics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new topic
app.post('/api/topics', adminAuth, async (req, res) => {
  try {
    const { chapter, subject, course, name, description, isFullTestSection } = req.body;
    const topic = new Topic({
      chapterId: chapter,
      subjectId: subject,
      courseId: course,
      name,
      description,
      isFullTestSection
    });
    await topic.save();
    res.json({ success: true, topic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update topic
app.put('/api/topics/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, isFullTestSection } = req.body;
    const topic = await Topic.findByIdAndUpdate(
      req.params.id,
      { name, description, isFullTestSection, updatedAt: Date.now() },
      { new: true }
    );
    res.json({ success: true, topic });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete topic
app.delete('/api/topics/:id', adminAuth, async (req, res) => {
  try {
    await Topic.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Topic deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Test Management Routes ============

// Get tests for a topic
app.get('/api/tests/:topicId', adminAuth, async (req, res) => {
  try {
    const { topicId } = req.params;
    const tests = await Test.find({ topic: topicId });
    res.json({ success: true, tests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new test
app.post('/api/tests', adminAuth, async (req, res) => {
  try {
    const { course, subject, chapter, topic, title, description, instructions, duration, totalMarks } = req.body;
    const test = new Test({
      course,
      subject,
      chapter,
      topic,
      title,
      description,
      instructions,
      duration,
      totalMarks
    });
    await test.save();
    res.json({ success: true, test });
  } catch (error) {
    console.error('Error creating test:', error.message, error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update test
app.put('/api/tests/:id', adminAuth, async (req, res) => {
  try {
    const { course, subject, chapter, topic, title, description, instructions, duration, totalMarks } = req.body;
    const test = await Test.findByIdAndUpdate(
      req.params.id,
      { course, subject, chapter, topic, title, description, instructions, duration, totalMarks, updatedAt: Date.now() },
      { new: true }
    );
    res.json({ success: true, test });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete test
app.delete('/api/tests/:id', adminAuth, async (req, res) => {
  try {
    await Test.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Test deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Mock Tests Routes ============

app.get('/api/admin/mock-tests', adminAuth, async (req, res) => {
  try {
    const { category, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (category) query.category = category;

    const mockTests = await MockTest.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await MockTest.countDocuments(query);

    res.json({
      success: true,
      mockTests,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Announcements Routes ============

app.get('/api/admin/announcements', adminAuth, async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (type) query.type = type;

    const announcements = await Announcement.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Announcement.countDocuments(query);

    res.json({
      success: true,
      announcements,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/announcements', adminAuth, async (req, res) => {
  try {
    const announcement = new Announcement({ ...req.body, createdBy: req.user._id });
    await announcement.save();
    res.json({ success: true, announcement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Study Materials Routes ============

app.get('/api/admin/study-materials', adminAuth, async (req, res) => {
  try {
    const { subject, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (subject) query.subject = subject;

    const materials = await StudyMaterial.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await StudyMaterial.countDocuments(query);

    res.json({
      success: true,
      materials,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Discussions Routes ============

app.get('/api/admin/discussions', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;

    const discussions = await Discussion.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Discussion.countDocuments(query);

    res.json({
      success: true,
      discussions,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Payments Routes ============

app.get('/api/admin/payments', adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;

    const payments = await Payment.find(query)
      .populate('studentId', 'name email')
      .populate('courseId', 'name')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      payments,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ Start Server ============

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;
