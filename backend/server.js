// ============================================================
//   server.js — Sri Sairam Siddha Hospital Backend
// ============================================================
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Serve shared doctor images from user folder (both portals access same images)
app.use('/img/doctors', express.static(path.join(__dirname, '../frontend/user/img/doctors')));

// Serve frontend static files
app.use('/admin', express.static(path.join(__dirname, '../frontend/admin')));
app.use('/', express.static(path.join(__dirname, '../frontend/user')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests, please slow down.' } });
const otpLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 5, message: { error: 'Too many OTP requests. Wait 5 minutes.' } });
app.use('/api', limiter);
app.use('/api/patient/request-otp', otpLimiter);

// ─── Public: Patient booking search (no auth required) ────────
// Must be registered BEFORE app.use('/api', require('./routes'))
// so it takes priority over any auth middleware in routes.js
async function publicBookingSearch(req, res) {
  try {
    const { Booking } = require('./models');
    const { phone, token } = req.query;

    if (!phone && !token) {
      return res.status(400).json({ error: 'Please provide a phone number or booking token to search.' });
    }

    const query = {};
    if (token) query.token = token.trim().toUpperCase();
    if (phone) query.phone = phone.trim();

    const bookings = await Booking.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(bookings);
  } catch (e) {
    console.error('Patient booking search error:', e.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

// Cover all common URL patterns the patient frontend might call
app.get('/api/patient/my-bookings',   publicBookingSearch);
app.get('/api/patient/bookings',      publicBookingSearch);
app.get('/api/patient/booking/search',publicBookingSearch);
app.get('/api/bookings/search',       publicBookingSearch);

// ─── Routes ───────────────────────────────────────────────────
app.use('/api', require('./routes'));

// ─── Serve frontend ───────────────────────────────────────────
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/admin/index.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/user/index.html')));

// ─── MongoDB + Seed ───────────────────────────────────────────
async function seedData() {
  const { Admin, Doctor } = require('./models');

  // Create admin
  const adminExists = await Admin.findOne({ email: process.env.ADMIN_EMAIL });
  if (!adminExists) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
    await Admin.create({ email: process.env.ADMIN_EMAIL || 'admin@saisiddha.in', password: hashed, name: 'Admin' });
    console.log('✅ Admin account created:', process.env.ADMIN_EMAIL);
  }

  // Seed real doctors from Sri Sairam Siddha Hospital
  const count = await Doctor.countDocuments();
  if (count === 0) {
    const doctors = [
      { name: 'Dr.N.R. Panneerselvam', regNo: 'SDKM00021', spec: 'Kuzhanthai Maruthuvam', qual: 'B.S.M.S – 2005, M.D.(S) 2010 Kuzhanthai Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 14, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_1.png', consultFee: 0 },
      { name: 'Dr.M.Latharani', regNo: 'SDMM00020', spec: 'Aruvai Thol Maruthuvam', qual: 'B.S.M.S 1990 Madurai Kamarajar University, M.D(S) 1997 Pothu Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 21, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_2.png', consultFee: 0 },
      { name: 'Dr.D.Amirtharaj', regNo: 'SDKM00023', spec: 'Varma Pura Sirappu Maruthuvam', qual: 'B.S.M.S 1996, M.D.(S) 2003 Kuzhanthai Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 20, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_3.png', consultFee: 0 },
      { name: 'Dr.R.Sathyaseela', regNo: 'SDKM00019', spec: 'Soolmagalir Maruthuvam', qual: 'B.S.M.S 2004, M.D.(S) 2009 Kuzhanthai Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 15, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_4.png', consultFee: 0 },
      { name: 'Dr.K.Kesavakumari', regNo: 'SDNN00018', spec: 'Pothu Maruthuvam', qual: 'B.S.M.S 2001, M.D.(S) 2005 Noi Nadal, The TN Dr. M.G.R. Medical University', exp: 15, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_5.png', consultFee: 0 },
      { name: 'Dr.V.Indumathy', regNo: 'SDMM00105', spec: 'Pothu Maruthuvam', qual: 'B.S.M.S 2014, M.D.(S) 2018 Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 6, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_6.png', consultFee: 0 },
      { name: 'Dr.S. Mary Princess Sulekha', regNo: 'SDKM00018', spec: 'Soolmagalir Maruthuvam', qual: 'B.S.M.S 1996, M.D.(S) 2009 Kuzhanthai Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 14, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_7.png', consultFee: 0 },
      { name: 'Dr.S.M.Kirubhakaran', regNo: 'SDNM00009', spec: 'Aruvai Thol Maruthuvam', qual: 'B.S.M.S 2010, M.D.(S) 2015 Nanju Noolum Maruthuva Neethi Noolum, The TN Dr. M.G.R. Medical University', exp: 9, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_8.png', consultFee: 0 },
      { name: 'Dr.P.Chakravarthi', regNo: 'SDKM00066', spec: 'Kuzhanthai Maruthuvam', qual: 'B.S.M.S 2014, M.D.(S) 2017 Kuzhanthai Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 7, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_9.png', consultFee: 0 },
      { name: 'Dr.S.Chithra', regNo: 'SDKM00045', spec: 'Soolmagalir Maruthuvam', qual: 'B.S.M.S 2001, M.D.(S) 2010 Kuzhanthai Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 13, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_10.png', consultFee: 0 },
      { name: 'Dr.S.Sonitha', regNo: 'SDKM00076', spec: 'Kuzhanthai Maruthuvam', qual: 'B.S.M.S 2007, M.D.(S) 2020 Kuzhanthai Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 4, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_11.png', consultFee: 0 },
      { name: 'Dr.E.Nandhini', regNo: 'SDSP00054', spec: 'Varma Pura Sirappu Maruthuvam', qual: 'B.S.M.S 2014, M.D.(S) 2018 Sirappu Maruthuvam, The TN Dr. M.G.R. Medical University', exp: 6, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_12.png', consultFee: 0 },
      { name: 'Dr.U. Nevis Anto', regNo: 'SID-DMS-013', spec: 'Pothu Maruthuvam', qual: 'B.S.M.S 2008, The TN Dr. M.G.R. Medical University', exp: 16, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_13.jpg', consultFee: 0 },
      { name: 'Dr.M.Harish', regNo: 'SID-EMO-014', spec: 'Pothu Maruthuvam', qual: 'B.S.M.S 2019, The TN Dr. M.G.R. Medical University', exp: 5, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_14.jpg', consultFee: 0 },
      { name: 'Dr.G. Selvavendhan', regNo: 'SID-EMO-015', spec: 'Avasara Maruthuvam', qual: 'B.S.M.S 2018, The TN Dr. M.G.R. Medical University', exp: 6, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_15.jpg', consultFee: 0 },
      { name: 'Dr.Nilavan PON', regNo: 'SID-RMO-016', spec: 'Pothu Maruthuvam', qual: 'B.S.M.S 2019, The TN Dr. M.G.R. Medical University', exp: 5, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_16.jpg', consultFee: 0 },
      { name: 'Dr.P. Vivekanandan', regNo: 'SID-RMO-017', spec: 'Aruvai Thol Maruthuvam', qual: 'B.S.M.S 2015, The TN Dr. M.G.R. Medical University', exp: 9, gender: 'Male', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_17.jpg', consultFee: 0 },
      { name: 'Dr.E.Harini', regNo: 'SID-RMO-018', spec: 'Soolmagalir & Kuzhanthai Maruthuvam', qual: 'B.S.M.S 2020, The TN Dr. M.G.R. Medical University', exp: 4, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_18.jpg', consultFee: 0 },
      { name: 'Dr.V. Srilekha', regNo: 'SID-RMO-019', spec: 'Pothu Maruthuvam', qual: 'B.S.M.S 2020, The TN Dr. M.G.R. Medical University', exp: 4, gender: 'Female', available: true, onlineEnabled: true, schedule: '9AM TO 12PM', maxAppts: 20, avatar: '/img/doctors/doctor_19.jpg', consultFee: 0 },
    ];
    await Doctor.insertMany(doctors);
    console.log('✅ All 19 Sairam Siddha doctors seeded with photos');
  }
}

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sairam_siddha')
  .then(async () => {
    console.log('✅ MongoDB connected');
    await seedData();
    app.listen(PORT, () => console.log(`\n🌿 Sri Sairam Siddha Server running on http://localhost:${PORT}\n   Admin: http://localhost:${PORT}/admin\n   Patient: http://localhost:${PORT}\n`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ─── Cron: Daily reminder emails at 8 AM ──────────────────────
cron.schedule('0 8 * * *', async () => {
  try {
    const { Booking } = require('./models');
    const { sendReminderEmail } = require('./utils/email');
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const bookings = await Booking.find({ date: tomorrowStr, status: 'confirmed', notifEmail: true, email: { $exists: true, $ne: '' } });
    for (const b of bookings) {
      try { await sendReminderEmail(b); } catch (e) { console.error('Reminder failed:', b.email, e.message); }
    }
    console.log(`📨 Sent ${bookings.length} reminder emails for ${tomorrowStr}`);
  } catch (e) { console.error('Cron error:', e.message); }
});

module.exports = app;