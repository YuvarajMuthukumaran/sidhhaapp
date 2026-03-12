const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const HOSPITAL = process.env.HOSPITAL_NAME || 'Sri Sairam Siddha Hospital';
const FROM = process.env.EMAIL_FROM || `"${HOSPITAL}" <${process.env.EMAIL_USER}>`;

// ─── OTP Email ──────────────────────────────────────────────────────────────
async function sendOTPEmail(to, name, otp) {
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; background:#0A1628; font-family:'Segoe UI',sans-serif; }
  .wrap { max-width:560px; margin:32px auto; background:#0F2040; border-radius:16px; overflow:hidden; border:1px solid rgba(201,168,76,0.3); }
  .header { background:linear-gradient(135deg,#0C1830,#101F3A); padding:32px; text-align:center; border-bottom:1px solid rgba(201,168,76,0.2); }
  .emblem { font-size:48px; margin-bottom:8px; }
  .title { font-size:20px; color:#C9A84C; font-weight:700; letter-spacing:1px; margin:0; }
  .subtitle { font-size:12px; color:#8A96B0; letter-spacing:3px; margin-top:4px; }
  .body { padding:32px; }
  .greeting { color:#E8EDF5; font-size:16px; margin-bottom:16px; }
  .otp-box { background:rgba(0,180,160,0.1); border:2px solid rgba(0,180,160,0.4); border-radius:12px; padding:24px; text-align:center; margin:24px 0; }
  .otp-label { color:#8A96B0; font-size:13px; letter-spacing:2px; text-transform:uppercase; margin-bottom:8px; }
  .otp-code { font-size:42px; font-weight:900; color:#00D4BC; letter-spacing:8px; font-family:monospace; }
  .otp-expiry { color:#8A96B0; font-size:12px; margin-top:8px; }
  .info { color:#A8B4C8; font-size:14px; line-height:1.7; }
  .footer { padding:20px 32px; background:#080F1E; text-align:center; color:#5A6480; font-size:12px; border-top:1px solid rgba(255,255,255,0.05); }
  .warn { color:#E05050; font-size:12px; margin-top:12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="emblem">🌿</div>
    <p class="title">${HOSPITAL}</p>
    <p class="subtitle">PATIENT PORTAL · SECURE LOGIN</p>
  </div>
  <div class="body">
    <p class="greeting">Vanakkam, <strong>${name}</strong>!</p>
    <p class="info">Use the OTP below to verify your identity and access your appointment portal.</p>
    <div class="otp-box">
      <div class="otp-label">Your One-Time Password</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-expiry">⏱ Expires in 10 minutes</div>
    </div>
    <p class="info">If you did not request this, please ignore this email. Do not share this OTP with anyone.</p>
    <p class="warn">⚠️ Our staff will never ask for your OTP over phone or email.</p>
  </div>
  <div class="footer">
    ${HOSPITAL} · ${process.env.HOSPITAL_ADDRESS || ''}<br>
    ${process.env.HOSPITAL_PHONE || ''}
  </div>
</div>
</body>
</html>`;

  return transporter.sendMail({
    from: FROM, to,
    subject: `${otp} — Your OTP for ${HOSPITAL}`,
    html
  });
}

// ─── Booking Confirmation Email ─────────────────────────────────────────────
async function sendBookingConfirmation(booking) {
  const dateStr = new Date(booking.date).toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const typeIcon = booking.type === 'online' ? '💻' : '🏥';
  const typeLabel = booking.type === 'online' ? 'Online Consultation' : 'In-Person Visit';

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; background:#0A1628; font-family:'Segoe UI',sans-serif; }
  .wrap { max-width:560px; margin:32px auto; background:#0F2040; border-radius:16px; overflow:hidden; border:1px solid rgba(201,168,76,0.3); }
  .header { background:linear-gradient(135deg,#0C1830,#101F3A); padding:32px; text-align:center; border-bottom:1px solid rgba(201,168,76,0.2); }
  .emblem { font-size:48px; margin-bottom:8px; }
  .title { font-size:20px; color:#C9A84C; font-weight:700; margin:0; }
  .confirmed-badge { display:inline-block; background:rgba(76,175,80,0.2); border:1px solid rgba(76,175,80,0.5); color:#4CAF50; border-radius:20px; padding:6px 20px; font-size:13px; margin-top:12px; font-weight:700; letter-spacing:1px; }
  .body { padding:32px; }
  .token-box { background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05)); border:2px solid rgba(201,168,76,0.4); border-radius:12px; padding:20px; text-align:center; margin:20px 0; }
  .token-label { color:#8A96B0; font-size:12px; letter-spacing:2px; text-transform:uppercase; }
  .token-num { font-size:36px; font-weight:900; color:#C9A84C; letter-spacing:4px; font-family:monospace; margin:4px 0; }
  .details-table { width:100%; border-collapse:collapse; margin:20px 0; }
  .details-table tr { border-bottom:1px solid rgba(255,255,255,0.06); }
  .details-table td { padding:10px 4px; font-size:14px; }
  .details-table td:first-child { color:#8A96B0; width:140px; }
  .details-table td:last-child { color:#E8EDF5; font-weight:600; }
  .tip { background:rgba(0,180,160,0.1); border-left:3px solid #00B4A0; border-radius:0 8px 8px 0; padding:12px 16px; color:#A8B4C8; font-size:13px; line-height:1.6; margin-top:20px; }
  .footer { padding:20px 32px; background:#080F1E; text-align:center; color:#5A6480; font-size:12px; border-top:1px solid rgba(255,255,255,0.05); }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="emblem">✅</div>
    <p class="title">Appointment Confirmed!</p>
    <div class="confirmed-badge">BOOKING SUCCESSFUL</div>
  </div>
  <div class="body">
    <p style="color:#E8EDF5;font-size:15px;">Dear <strong>${booking.name}</strong>,</p>
    <p style="color:#A8B4C8;font-size:14px;margin-top:8px;">Your appointment at <strong style="color:#C9A84C;">${HOSPITAL}</strong> has been confirmed. Please save your token number.</p>
    <div class="token-box">
      <div class="token-label">Your Token Number</div>
      <div class="token-num">${booking.token}</div>
      <div style="color:#8A96B0;font-size:12px;">Show this token at reception</div>
    </div>
    <table class="details-table">
      <tr><td>Patient</td><td>${booking.name} (${booking.age}y, ${booking.gender})</td></tr>
      <tr><td>Doctor</td><td>${booking.doctorName}</td></tr>
      <tr><td>Specialization</td><td>${booking.doctorSpec}</td></tr>
      <tr><td>Date</td><td>${dateStr}</td></tr>
      <tr><td>Time</td><td>${booking.time}</td></tr>
      <tr><td>Type</td><td>${typeIcon} ${typeLabel}</td></tr>
      <tr><td>Consultation Fee</td><td style="color:#00D4BC;">FREE</td></tr>
    </table>
    ${booking.type === 'online' && booking.meetLink ? `<div style="background:rgba(0,180,160,0.1);border:1px solid rgba(0,180,160,0.3);border-radius:8px;padding:12px 16px;margin:16px 0;"><span style="color:#8A96B0;font-size:13px;">Meeting Link:</span><br><a href="${booking.meetLink}" style="color:#00D4BC;">${booking.meetLink}</a></div>` : ''}
    <div class="tip">
      💡 <strong>Tips:</strong> Please arrive 10 minutes early · Bring any previous medical records · Fasting not required unless specifically told
    </div>
  </div>
  <div class="footer">
    ${HOSPITAL} · ${process.env.HOSPITAL_ADDRESS || ''}<br>
    📞 ${process.env.HOSPITAL_PHONE || ''}<br><br>
    To cancel, visit our patient portal or call us.
  </div>
</div>
</body>
</html>`;

  return transporter.sendMail({
    from: FROM, to: booking.email,
    subject: `✅ Appointment Confirmed — Token ${booking.token} | ${HOSPITAL}`,
    html
  });
}

// ─── Cancellation Email ─────────────────────────────────────────────────────
async function sendCancellationEmail(booking) {
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; background:#0A1628; font-family:'Segoe UI',sans-serif; }
  .wrap { max-width:560px; margin:32px auto; background:#0F2040; border-radius:16px; overflow:hidden; border:1px solid rgba(224,80,80,0.3); }
  .header { background:linear-gradient(135deg,#1A0C0C,#2A1010); padding:32px; text-align:center; border-bottom:1px solid rgba(224,80,80,0.2); }
  .title { font-size:20px; color:#E05050; font-weight:700; margin:8px 0 0; }
  .body { padding:32px; color:#A8B4C8; font-size:14px; line-height:1.7; }
  .info-box { background:rgba(224,80,80,0.08); border:1px solid rgba(224,80,80,0.25); border-radius:10px; padding:16px; margin:16px 0; }
  .footer { padding:20px 32px; background:#080F1E; text-align:center; color:#5A6480; font-size:12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div style="font-size:48px;">❌</div>
    <p class="title">Appointment Cancelled</p>
  </div>
  <div class="body">
    <p>Dear <strong style="color:#E8EDF5;">${booking.name}</strong>,</p>
    <p>Your appointment has been cancelled as requested.</p>
    <div class="info-box">
      <strong style="color:#E8EDF5;">Cancelled Booking Details</strong><br><br>
      Doctor: ${booking.doctorName}<br>
      Date: ${new Date(booking.date).toDateString()} at ${booking.time}<br>
      Token: <strong style="color:#E05050;">${booking.token}</strong>
    </div>
    <p>To rebook, please visit our patient portal. We hope to see you soon! 🙏</p>
  </div>
  <div class="footer">${HOSPITAL} · ${process.env.HOSPITAL_PHONE || ''}</div>
</div>
</body>
</html>`;

  return transporter.sendMail({
    from: FROM, to: booking.email,
    subject: `Appointment Cancelled — ${booking.token} | ${HOSPITAL}`,
    html
  });
}

// ─── Admin Notification Broadcast ───────────────────────────────────────────
async function sendBroadcastEmail(toList, notification) {
  const icons = { broadcast:'📢', appointment:'📅', online:'💻', cancel:'⚠️', reschedule:'🔄', holiday:'🏖️', custom:'🔔' };
  const icon = icons[notification.type] || '🔔';
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body { margin:0; padding:0; background:#0A1628; font-family:'Segoe UI',sans-serif; }
  .wrap { max-width:560px; margin:32px auto; background:#0F2040; border-radius:16px; overflow:hidden; border:1px solid rgba(201,168,76,0.3); }
  .header { background:linear-gradient(135deg,#0C1830,#101F3A); padding:28px; text-align:center; }
  .body { padding:28px; color:#A8B4C8; font-size:15px; line-height:1.8; }
  .msg-box { background:rgba(201,168,76,0.08); border-left:4px solid #C9A84C; border-radius:0 10px 10px 0; padding:16px 20px; margin:16px 0; color:#E8EDF5; font-size:15px; }
  .footer { padding:16px; background:#080F1E; text-align:center; color:#5A6480; font-size:12px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div style="font-size:40px;">${icon}</div>
    <p style="color:#C9A84C;font-size:18px;font-weight:700;margin:8px 0 0;">Notice from ${HOSPITAL}</p>
  </div>
  <div class="body">
    <div class="msg-box">${notification.message}</div>
    ${notification.meetLink ? `<p>🔗 <a href="${notification.meetLink}" style="color:#00D4BC;">${notification.meetLink}</a></p>` : ''}
  </div>
  <div class="footer">${HOSPITAL}</div>
</div>
</body>
</html>`;

  const results = [];
  for (const email of toList) {
    try {
      await transporter.sendMail({ from: FROM, to: email, subject: `${icon} Notice from ${HOSPITAL}`, html });
      results.push({ email, status: 'sent' });
    } catch (e) {
      results.push({ email, status: 'failed', error: e.message });
    }
  }
  return results;
}

async function sendReminderEmail(booking) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#0A1628;font-family:'Segoe UI',sans-serif;}
  .wrap{max-width:560px;margin:32px auto;background:#0F2040;border-radius:16px;overflow:hidden;border:1px solid rgba(0,180,160,0.3);}
  .header{background:linear-gradient(135deg,#0C1830,#101F3A);padding:28px;text-align:center;}
  .body{padding:28px;color:#A8B4C8;font-size:14px;line-height:1.7;}
  .token{font-size:28px;font-weight:900;color:#C9A84C;font-family:monospace;letter-spacing:4px;}
  .footer{padding:16px;background:#080F1E;text-align:center;color:#5A6480;font-size:12px;}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div style="font-size:40px;">⏰</div>
    <p style="color:#00D4BC;font-size:18px;font-weight:700;margin:8px 0 0;">Appointment Reminder</p>
  </div>
  <div class="body">
    <p>Dear <strong style="color:#E8EDF5;">${booking.name}</strong>,</p>
    <p>This is a reminder that your appointment is <strong style="color:#E8EDF5;">tomorrow</strong>.</p>
    <p>Doctor: <strong style="color:#E8EDF5;">${booking.doctorName}</strong></p>
    <p>Time: <strong style="color:#E8EDF5;">${booking.time}</strong></p>
    <p>Your Token: <span class="token">${booking.token}</span></p>
    ${booking.meetLink ? `<p>📹 Join: <a href="${booking.meetLink}" style="color:#00D4BC;">${booking.meetLink}</a></p>` : ''}
    <p style="margin-top:16px;">Please arrive 10 minutes early. 🙏</p>
  </div>
  <div class="footer">${HOSPITAL} · ${process.env.HOSPITAL_PHONE || ''}</div>
</div>
</body>
</html>`;

  return transporter.sendMail({
    from: FROM, to: booking.email,
    subject: `⏰ Reminder: Appointment Tomorrow at ${booking.time} | ${HOSPITAL}`,
    html
  });
}

module.exports = { sendOTPEmail, sendBookingConfirmation, sendCancellationEmail, sendBroadcastEmail, sendReminderEmail };
