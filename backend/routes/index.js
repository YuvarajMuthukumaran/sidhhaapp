// ============================================================
//   routes/index.js — All API routes for Sairam Siddha
// ============================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Doctor, Patient, Booking, Notification, Admin } = require('../models');
const { adminOnly, authMiddleware } = require('../middleware/auth');
const { sendOTPEmail, sendBookingConfirmation, sendCancellationEmail, sendBroadcastEmail } = require('../utils/email');

// ──────────────────────────────────────────────────────────────
//  ADMIN AUTH
// ──────────────────────────────────────────────────────────────
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, role: 'admin', name: admin.name }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, admin: { name: admin.name, email: admin.email } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────
//  PATIENT OTP AUTH
// ──────────────────────────────────────────────────────────────
router.post('/patient/request-otp', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!email || !phone || !name) return res.status(400).json({ error: 'Name, email and phone required' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    let patient = await Patient.findOne({ email });
    if (patient) {
      patient.otp = otp; patient.otpExpiry = otpExpiry;
      patient.name = name; patient.phone = phone;
      await patient.save();
    } else {
      patient = await Patient.create({ name, email, phone, otp, otpExpiry });
    }

    await sendOTPEmail(email, name, otp);
    res.json({ message: 'OTP sent to ' + email, patientId: patient._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/patient/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const patient = await Patient.findOne({ email });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (patient.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });
    if (new Date() > patient.otpExpiry) return res.status(400).json({ error: 'OTP expired. Please request again.' });

    patient.verified = true; patient.otp = null; patient.lastLogin = new Date();
    await patient.save();

    const token = jwt.sign({ id: patient._id, role: 'patient', name: patient.name, email: patient.email }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, patient: { id: patient._id, name: patient.name, email: patient.email, phone: patient.phone } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────
//  DOCTORS
// ──────────────────────────────────────────────────────────────
router.get('/doctors', async (req, res) => {
  try {
    const filter = {};
    if (req.query.available === 'true') filter.available = true;
    const doctors = await Doctor.find(filter).sort({ name: 1 });
    res.json(doctors);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/doctors', adminOnly, async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);
    res.status(201).json(doctor);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/doctors/:id', adminOnly, async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/doctors/:id', adminOnly, async (req, res) => {
  try {
    await Doctor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Doctor removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────
//  BOOKINGS
// ──────────────────────────────────────────────────────────────
// Get booked slots for a doctor on a date
router.get('/bookings/slots', async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: 'doctorId and date required' });
    const bookings = await Booking.find({ doctorId, date, status: { $in: ['confirmed', 'pending'] } }).select('time');
    res.json(bookings.map(b => b.time));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create booking
router.post('/bookings', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.body.doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    if (!doctor.available) return res.status(400).json({ error: 'Doctor not available today' });

    // Check slot not already taken
    const existing = await Booking.findOne({ doctorId: req.body.doctorId, date: req.body.date, time: req.body.time, status: { $in: ['confirmed', 'pending'] } });
    if (existing) return res.status(409).json({ error: 'This slot is already booked. Please choose another.' });

    // Generate token
    const dateStr = req.body.date.replace(/-/g, '').slice(4); // MMDD
    const count = await Booking.countDocuments({ doctorId: req.body.doctorId, date: req.body.date }) + 1;
    const token = `T${dateStr}${String(count).padStart(3, '0')}`;

    const booking = await Booking.create({ ...req.body, token, doctorName: doctor.name, doctorSpec: doctor.spec });

    // Send confirmation email
    if (booking.email) {
      try { await sendBookingConfirmation(booking); } catch (emailErr) { console.error('Email failed:', emailErr.message); }
    }

    res.status(201).json(booking);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all bookings (admin)
router.get('/bookings', adminOnly, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) filter.date = req.query.date;
    if (req.query.doctorId) filter.doctorId = req.query.doctorId;
    if (req.query.type) filter.type = req.query.type;

    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json(bookings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get patient's own bookings — public, no login required
// Search by phone, email, or booking token
router.get('/bookings/my', async (req, res) => {
  try {
    const { phone, email, token } = req.query;

    if (!phone && !email && !token) {
      return res.status(400).json({ error: 'Please provide a phone number, email, or booking token to search.' });
    }

    const filter = {};
    if (token) filter.token = token.trim().toUpperCase();
    else if (phone) filter.phone = phone.trim();
    else if (email) filter.email = email.trim().toLowerCase();

    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).limit(20);
    res.json(bookings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update booking status (admin)
router.put('/bookings/:id', adminOnly, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Send cancellation email if cancelled
    if (req.body.status === 'cancelled' && booking.email) {
      try { await sendCancellationEmail(booking); } catch (e) { console.error('Email failed:', e.message); }
    }
    res.json(booking);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Patient cancel own booking
router.put('/bookings/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    // Verify ownership
    if (booking.email !== req.user.email && booking.phone !== req.query.phone)
      return res.status(403).json({ error: 'Not authorized' });

    booking.status = 'cancelled';
    await booking.save();
    if (booking.email) {
      try { await sendCancellationEmail(booking); } catch (e) { console.error('Email:', e.message); }
    }
    res.json(booking);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────
//  NOTIFICATIONS (Admin)
// ──────────────────────────────────────────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const notifs = await Notification.find().sort({ createdAt: -1 }).limit(100);
    res.json(notifs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/notifications/broadcast', adminOnly, async (req, res) => {
  try {
    const { type, message, meetLink, doctorId, sentTo } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const notif = await Notification.create({ type, message, meetLink, doctorId: doctorId || null, sentBy: 'Admin', sentTo: sentTo || 'all' });

    // Get patient emails to broadcast
    let emails = [];
    if (sentTo === 'all') {
      const patients = await Patient.find({ verified: true }).select('email');
      emails = patients.map(p => p.email).filter(Boolean);
    } else if (req.body.targetEmail) {
      emails = [req.body.targetEmail];
    }

    let emailResults = [];
    if (emails.length > 0) {
      emailResults = await sendBroadcastEmail(emails, { type, message, meetLink });
      const sent = emailResults.filter(r => r.status === 'sent').length;
      notif.emailStatus = sent > 0 ? 'sent' : 'failed';
      await notif.save();
    }

    res.json({ notification: notif, emailsSent: emailResults.filter(r => r.status === 'sent').length, emailsFailed: emailResults.filter(r => r.status === 'failed').length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Send meeting link for online consult
router.post('/notifications/send-link', adminOnly, async (req, res) => {
  try {
    const { bookingId, meetLink } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.meetLink = meetLink;
    await booking.save();

    const notif = await Notification.create({ type: 'online', message: `Your online consultation with ${booking.doctorName} is confirmed. Join: ${meetLink} on ${new Date(booking.date).toDateString()} at ${booking.time}. Token: ${booking.token}`, meetLink, sentBy: 'Admin', sentTo: 'specific', targetEmail: booking.email });

    if (booking.email) {
      await sendBookingConfirmation(booking);
      notif.emailStatus = 'sent';
      await notif.save();
    }
    res.json({ message: 'Link sent successfully', booking });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ──────────────────────────────────────────────────────────────
//  DASHBOARD STATS (Admin)
// ──────────────────────────────────────────────────────────────
router.get('/admin/stats', adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [totalBookings, todayBookings, totalPatients, pendingBookings, onlineBookings, cancelledBookings] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ date: today, status: { $ne: 'cancelled' } }),
      Patient.countDocuments({ verified: true }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ type: 'online' }),
      Booking.countDocuments({ status: 'cancelled' }),
    ]);

    // Top doctors by bookings
    const topDocs = await Booking.aggregate([
      { $group: { _id: '$doctorName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }, { $limit: 5 }
    ]);

    // Bookings by spec
    const bySpec = await Booking.aggregate([
      { $group: { _id: '$doctorSpec', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({ totalBookings, todayBookings, totalPatients, pendingBookings, onlineBookings, cancelledBookings, topDocs, bySpec });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;