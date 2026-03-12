// ============ models/Doctor.js ============
const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  regNo: { type: String, required: true, unique: true },
  spec: { type: String, required: true },
  qual: { type: String, required: true },
  exp: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  onlineEnabled: { type: Boolean, default: false },
  slots: {
    morning:   { type: [String], default: ['8:00 AM','8:20 AM','8:40 AM','9:00 AM','9:20 AM','9:40 AM','10:00 AM','10:20 AM','10:40 AM','11:00 AM'] },
    afternoon: { type: [String], default: ['2:00 PM','2:20 PM','2:40 PM','3:00 PM','3:20 PM','3:40 PM','4:00 PM','4:20 PM','4:40 PM','5:00 PM'] },
    evening:   { type: [String], default: [] }
  },
  consultFee: { type: Number, default: 0 },
  avatar: { type: String, default: '' },
  gender: { type: String, default: 'Male' },
  schedule: { type: String, default: '9AM TO 12PM' },
  maxAppts: { type: Number, default: 20 }
}, { timestamps: true });

// ============ models/Patient.js ============
const patientSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  phone:   { type: String, required: true },
  email:   { type: String, required: true },
  age:     { type: Number },
  gender:  { type: String, enum: ['Male','Female','Other'] },
  otp:     { type: String },
  otpExpiry: { type: Date },
  verified: { type: Boolean, default: false },
  lastLogin: { type: Date }
}, { timestamps: true });

// ============ models/Booking.js ============
const bookingSchema = new mongoose.Schema({
  token:      { type: String, required: true, unique: true },
  patientId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  doctorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  doctorName: { type: String, required: true },
  doctorSpec: { type: String, required: true },
  date:       { type: String, required: true },        // YYYY-MM-DD
  time:       { type: String, required: true },
  name:       { type: String, required: true },
  age:        { type: Number },
  gender:     { type: String },
  phone:      { type: String, required: true },
  email:      { type: String },
  complaint:  { type: String },
  history:    { type: String },
  type:       { type: String, enum: ['inperson','online'], default: 'inperson' },
  status:     { type: String, enum: ['pending','confirmed','completed','cancelled'], default: 'confirmed' },
  meetLink:   { type: String },
  notifEmail: { type: Boolean, default: true },
  notifSMS:   { type: Boolean, default: false },
  notifWhatsapp: { type: Boolean, default: false }
}, { timestamps: true });

// ============ models/Notification.js ============
const notificationSchema = new mongoose.Schema({
  type:       { type: String, enum: ['broadcast','appointment','online','cancel','reschedule','holiday','custom'], default: 'broadcast' },
  message:    { type: String, required: true },
  meetLink:   { type: String },
  doctorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  targetPhone:{ type: String },
  targetEmail:{ type: String },
  sentBy:     { type: String, default: 'Admin' },
  sentTo:     { type: String, default: 'all' },  // 'all' | 'specific'
  emailStatus:{ type: String, enum: ['pending','sent','failed'], default: 'pending' }
}, { timestamps: true });

// ============ models/Admin.js ============
const adminSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name:     { type: String, default: 'Admin' },
  role:     { type: String, default: 'admin' }
}, { timestamps: true });

module.exports = {
  Doctor:       mongoose.model('Doctor', doctorSchema),
  Patient:      mongoose.model('Patient', patientSchema),
  Booking:      mongoose.model('Booking', bookingSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  Admin:        mongoose.model('Admin', adminSchema)
};
