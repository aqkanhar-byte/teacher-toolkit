require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, WidthType, ShadingType, Table, TableRow, TableCell, ImageRun } = require('docx');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1); /* Render/proxy ke pichhe sahi client IP (rate limiting ke liye) */
app.use(require('compression')());
app.use(require('cors')());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
/* ── HTTPS enforcement (Render handles www↔apex redirect at infra level) ── */
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return next();
  const proto = ((req.headers['x-forwarded-proto'] || req.protocol) + '').split(',')[0].trim();
  if (proto !== 'https') return res.redirect(301, `https://${host}${req.originalUrl}`);
  next();
});
app.use(express.static('public'));

/* ── Lightweight in-memory rate limiter (no extra deps) ── */
const rlBuckets = new Map();
function rlBlocked(key, max, windowMs) {
  const b = rlBuckets.get(key);
  return !!(b && Date.now() - b.start <= windowMs && b.n >= max);
}
function rlHit(key, windowMs) {
  const now = Date.now();
  const b = rlBuckets.get(key);
  if (!b || now - b.start > windowMs) rlBuckets.set(key, { start: now, n: 1 });
  else b.n++;
}
function rateLimit(key, max, windowMs) {
  if (rlBlocked(key, max, windowMs)) return false;
  rlHit(key, windowMs);
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of rlBuckets) if (now - b.start > 3600000) rlBuckets.delete(k); }, 600000).unref();
function tooMany(res) { return res.status(429).json({ success: false, error: 'Too many attempts — please wait a few minutes and try again.' }); }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/* ═══════════════ SUPABASE + AUTH + WALLET (Phase 1 Paid System) ═══════════════ */
const sb = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;
if (!sb) console.log('⚠️  Supabase not configured — FREE MODE (login/credits off). Add SUPABASE_URL + SUPABASE_SERVICE_KEY to .env.');

function hashPin(pin) {
  const salt = crypto.randomBytes(8).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex');
}
function checkPin(pin, stored) {
  try { const [salt, h] = stored.split(':'); return crypto.scryptSync(String(pin), salt, 32).toString('hex') === h; }
  catch (e) { return false; }
}
async function userFromReq(req) {
  if (!sb) return null;
  /* NOTE: custom domain's edge proxy strips the standard "Authorization" header —
     verified via /debug/echo-auth (present on *.onrender.com, missing on the custom
     domain). Using a custom header name avoids that entirely. */
  const t = (req.headers['x-auth-token'] || (req.headers.authorization || '').replace('Bearer ', '')).trim();
  if (!t) return null;
  const { data } = await sb.from('tt_users').select('*').eq('token', t).maybeSingle();
  return data || null;
}
/* AI generation se PEHLE credit kaato (reserve); fail ho to refund */
function planActive(u) {
  return u && u.plan && u.plan_expires && new Date(u.plan_expires) > new Date() && (u.plan_used || 0) < (u.plan_quota || 0);
}
async function takeCredit(req, res) {
  if (!sb) return { user: null, free: true };  // free mode when Supabase not configured
  const user = await userFromReq(req);
  if (!user) { res.json({ success: false, error: 'LOGIN_REQUIRED' }); return null; }
  /* 1) Active monthly plan? Use plan quota first */
  if (planActive(user)) {
    const { data } = await sb.from('tt_users')
      .update({ plan_used: (user.plan_used || 0) + 1 })
      .eq('id', user.id).eq('plan_used', user.plan_used || 0)
      .select().maybeSingle();
    if (data) return { user: data, viaPlan: true };
  }
  /* 2) Otherwise pay-per-doc credits */
  const { data } = await sb.from('tt_users')
    .update({ credits: user.credits - 1 }).eq('id', user.id).eq('credits', user.credits).gt('credits', 0)
    .select().maybeSingle();
  if (!data) {
    const { data: fresh } = await sb.from('tt_users').select('*').eq('id', user.id).maybeSingle();
    if (fresh && planActive(fresh)) {
      const { data: retryP } = await sb.from('tt_users').update({ plan_used: fresh.plan_used + 1 }).eq('id', user.id).eq('plan_used', fresh.plan_used).select().maybeSingle();
      if (retryP) return { user: retryP, viaPlan: true };
    }
    if (fresh && fresh.credits > 0) {
      const { data: retry } = await sb.from('tt_users').update({ credits: fresh.credits - 1 }).eq('id', user.id).eq('credits', fresh.credits).select().maybeSingle();
      if (retry) return { user: retry };
    }
    res.json({ success: false, error: 'NO_CREDITS' }); return null;
  }
  return { user: data };
}
async function refundCredit(gateUser, viaPlan) {
  if (!sb || !gateUser) return;
  /* takeCredit ki tarah optimistic locking — stale read se balance clobber nahi hoga */
  try {
    for (let i = 0; i < 3; i++) {
      const { data: u } = await sb.from('tt_users').select('id,credits,plan_used').eq('id', gateUser.id).maybeSingle();
      if (!u) return;
      const q = viaPlan
        ? sb.from('tt_users').update({ plan_used: Math.max(0, (u.plan_used || 1) - 1) }).eq('id', u.id).eq('plan_used', u.plan_used || 0)
        : sb.from('tt_users').update({ credits: u.credits + 1 }).eq('id', u.id).eq('credits', u.credits);
      const { data } = await q.select().maybeSingle();
      if (data) return;
    }
  } catch (e) {}
}
async function saveDoc(user, docType, title, content) {
  if (!sb || !user) return;
  try { await sb.from('tt_documents').insert({ user_id: user.id, doc_type: docType, title: (title || docType).slice(0, 120), content }); } catch (e) {}
  maybeRewardReferral(user).catch(() => {});
}
const REFERRAL_CREDITS = 2; /* both referrer + referred get this many free credits, once, on the referred teacher's FIRST successful AI document */
async function maybeRewardReferral(user) {
  if (!sb || !user || !user.referred_by || user.referral_rewarded) return;
  const { count } = await sb.from('tt_documents').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if (count !== 1) return; /* only fire on the very first document */
  const { data: referrer } = await sb.from('tt_users').select('id,credits').eq('phone', user.referred_by).maybeSingle();
  if (!referrer) return;
  await sb.from('tt_users').update({ credits: referrer.credits + REFERRAL_CREDITS }).eq('id', referrer.id);
  await sb.from('tt_users').update({ credits: user.credits + REFERRAL_CREDITS, referral_rewarded: true }).eq('id', user.id);
  await sb.from('tt_transactions').insert([
    { user_id: referrer.id, credits: REFERRAL_CREDITS, amount_rs: 0, note: 'Referral bonus (invited a teacher)' },
    { user_id: user.id, credits: REFERRAL_CREDITS, amount_rs: 0, note: 'Referral bonus (signed up via invite)' }
  ]);
}
function cleanPhone(p) { return String(p || '').replace(/[^0-9]/g, '').replace(/^0/, '92').slice(0, 12); }

/* ── Auth routes ── */
app.post('/auth/register', async (req, res) => {
  if (!sb) return res.json({ success: false, error: 'Database is not configured on the server.' });
  if (!rateLimit('reg:' + req.ip, 15, 60 * 60 * 1000)) return tooMany(res); /* max 15 accounts/hour/IP */
  const phone = cleanPhone(req.body.phone);
  const { pin, name, school } = req.body;
  if (!phone || phone.length < 11) return res.json({ success: false, error: 'Enter a valid mobile number (03xx-xxxxxxx).' });
  if (!pin || String(pin).length < 4) return res.json({ success: false, error: 'PIN must be at least 4 digits.' });
  if (!name) return res.json({ success: false, error: 'Name is required.' });
  /* Referral — only accepted if it's a real registered teacher and not a self-referral */
  let referredBy = cleanPhone(req.body.referredBy || '');
  if (referredBy === phone) referredBy = '';
  if (referredBy) {
    const { data: refUser } = await sb.from('tt_users').select('id').eq('phone', referredBy).maybeSingle();
    if (!refUser) referredBy = '';
  }
  const token = crypto.randomUUID();
  const { data, error } = await sb.from('tt_users')
    .insert({ phone, name, school: school || '', pin_hash: hashPin(pin), token, referred_by: referredBy || null })
    .select().maybeSingle();
  if (error) {
    if (String(error.message).includes('duplicate')) return res.json({ success: false, error: 'This number is already registered — please Login.' });
    return res.json({ success: false, error: error.message });
  }
  res.json({ success: true, token, user: { name: data.name, phone: data.phone, credits: data.credits } });
});
app.post('/auth/login', async (req, res) => {
  if (!sb) return res.json({ success: false, error: 'Database is not configured on the server.' });
  const phone = cleanPhone(req.body.phone);
  /* PIN brute-force protection: 15 failed tries per IP+phone per 15 min */
  const rk = 'login:' + req.ip + ':' + phone;
  if (rlBlocked(rk, 15, 15 * 60 * 1000)) return tooMany(res);
  const { data: user } = await sb.from('tt_users').select('*').eq('phone', phone).maybeSingle();
  if (!user || !checkPin(req.body.pin, user.pin_hash)) { rlHit(rk, 15 * 60 * 1000); return res.json({ success: false, error: 'Wrong phone number or PIN.' }); }
  const token = crypto.randomUUID();
  await sb.from('tt_users').update({ token }).eq('id', user.id);
  res.json({ success: true, token, user: { name: user.name, phone: user.phone, credits: user.credits } });
});
app.get('/wallet', async (req, res) => {
  const user = await userFromReq(req);
  if (!user) return res.json({ success: false, error: 'LOGIN_REQUIRED' });
  res.json({
    success: true, credits: user.credits, name: user.name, phone: user.phone, school: user.school || '',
    plan: planActive(user) ? user.plan : null,
    planLeft: planActive(user) ? (user.plan_quota - (user.plan_used || 0)) : 0,
    planExpires: user.plan_expires || null
  });
});
app.get('/config', (req, res) => {
  res.json({
    paidMode: !!sb,
    easypaisa: process.env.EASYPAISA_NUMBER || '03XX-XXXXXXX',
    easypaisaName: process.env.EASYPAISA_NAME || 'Account Holder',
    whatsapp: cleanPhone(process.env.WHATSAPP_NUMBER || process.env.EASYPAISA_NUMBER || ''),
    plans: [
      { name: 'Monthly Pro', rs: 1500, docs: 40, days: 30, tag: 'Best for regular use' }
    ],
    /* 5 packages, small → big. Per-credit price drops with volume but never below cost+margin
       (real AI cost ~Rs 15-45/doc depending on book attachments) — every tier stays profitable. */
    prices: [
      { name: 'Starter', rs: 200, credits: 4, tag: '' },
      { name: 'Basic', rs: 450, credits: 10, tag: '' },
      { name: 'Popular', rs: 850, credits: 20, tag: 'Most Popular' },
      { name: 'Pro', rs: 1600, credits: 40, tag: 'Best Value' },
      { name: 'School', rs: 3600, credits: 100, tag: 'For whole staff' }
    ]
  });
});

/* ── Students backup/sync ── */
app.get('/students-sync', async (req, res) => {
  const user = await userFromReq(req);
  if (!user) return res.json({ success: false, error: 'LOGIN_REQUIRED' });
  const { data } = await sb.from('tt_students').select('data').eq('user_id', user.id).maybeSingle();
  res.json({ success: true, students: (data && data.data) || [] });
});
app.post('/students-sync', async (req, res) => {
  const user = await userFromReq(req);
  if (!user) return res.json({ success: false, error: 'LOGIN_REQUIRED' });
  const students = Array.isArray(req.body.students) ? req.body.students.slice(0, 2000) : [];
  await sb.from('tt_students').upsert({ user_id: user.id, data: students, updated_at: new Date().toISOString() });
  res.json({ success: true, count: students.length });
});

/* ── Admin (sirf tumhare liye — ADMIN_PASSWORD .env mein) ── */
function isAdmin(req) {
  const pw = process.env.ADMIN_PASSWORD, k = req.headers['x-admin-key'];
  if (!pw || typeof k !== 'string' || !k) return false;
  const a = Buffer.from(k), b = Buffer.from(pw);
  if (a.length !== b.length) return false; /* length leak is unavoidable; content compare is constant-time */
  return crypto.timingSafeEqual(a, b);
}
/* Har admin route ka common gate: brute-force lockout + password + Supabase check */
function adminGate(req, res) {
  const rk = 'adminfail:' + req.ip;
  if (rlBlocked(rk, 10, 10 * 60 * 1000)) { tooMany(res); return false; }
  if (!isAdmin(req)) { rlHit(rk, 10 * 60 * 1000); res.status(403).json({ success: false, error: 'Wrong admin password' }); return false; }
  if (!sb) { res.json({ success: false, error: 'Database is not configured on the server.' }); return false; }
  return true;
}
async function statsResetAt() {
  if (!sb) return null;
  const { data } = await sb.from('tt_settings').select('value').eq('key', 'stats_reset_at').maybeSingle();
  return data ? data.value : null;
}
app.get('/admin/users', async (req, res) => {
  if (!adminGate(req, res)) return;
  const resetAt = await statsResetAt();
  const { data: users } = await sb.from('tt_users').select('id,phone,name,school,credits,created_at,plan,plan_quota,plan_used,plan_expires').order('created_at', { ascending: false }).limit(500);
  let txQuery = sb.from('tt_transactions').select('amount_rs,credits,created_at');
  if (resetAt) txQuery = txQuery.gte('created_at', resetAt);
  const { data: tx } = await txQuery;
  const revenue = (tx || []).reduce((s, t) => s + (t.amount_rs || 0), 0);
  const visibleUsers = resetAt ? (users || []).filter(u => u.created_at >= resetAt) : (users || []);
  res.json({ success: true, users: users || [], revenue, txCount: (tx || []).length, teacherCount: visibleUsers.length, statsResetAt: resetAt });
});
/* Resets the dashboard's Revenue/Payments/Teachers counters to zero (a fresh "since" baseline) —
   never deletes real data. Full history is always available via /admin/full-report. */
app.post('/admin/reset-stats', async (req, res) => {
  if (!adminGate(req, res)) return;
  await sb.from('tt_settings').upsert({ key: 'stats_reset_at', value: new Date().toISOString() });
  res.json({ success: true });
});
/* Permanent, unfiltered, all-time report — ignores the reset baseline entirely */
app.get('/admin/full-report', async (req, res) => {
  if (!adminGate(req, res)) return;
  const { data: users } = await sb.from('tt_users').select('id,created_at');
  const { data: tx } = await sb.from('tt_transactions').select('amount_rs,credits,note,created_at');
  const totalRevenue = (tx || []).reduce((s, t) => s + (t.amount_rs || 0), 0);
  const byPackage = {};
  (tx || []).forEach(t => {
    const key = (t.note || 'Other').split(' (Rs')[0];
    if (!byPackage[key]) byPackage[key] = { count: 0, revenue: 0, credits: 0 };
    byPackage[key].count++; byPackage[key].revenue += (t.amount_rs || 0); byPackage[key].credits += (t.credits || 0);
  });
  res.json({
    success: true,
    totalTeachers: (users || []).length,
    totalRevenue,
    totalTransactions: (tx || []).length,
    byPackage,
    firstRegistration: (users || []).length ? (users || []).map(u => u.created_at).sort()[0] : null,
    resetAt: await statsResetAt()
  });
});
app.post('/admin/reset-pin', async (req, res) => {
  if (!adminGate(req, res)) return;
  const phone = cleanPhone(req.body.phone);
  const newPin = String(req.body.newPin || '');
  if (!phone) return res.json({ success: false, error: 'Enter a valid phone' });
  if (newPin.length < 4 || !/^\d+$/.test(newPin)) return res.json({ success: false, error: 'New PIN must be at least 4 digits' });
  const { data: user } = await sb.from('tt_users').select('id,name').eq('phone', phone).maybeSingle();
  if (!user) return res.json({ success: false, error: 'This number is not registered: ' + phone });
  await sb.from('tt_users').update({ pin_hash: hashPin(newPin), token: crypto.randomUUID() }).eq('id', user.id);
  res.json({ success: true, name: user.name });
});
app.post('/admin/add-subscription', async (req, res) => {
  if (!adminGate(req, res)) return;
  const phone = cleanPhone(req.body.phone);
  const days = parseInt(req.body.days) || 30;
  const quota = parseInt(req.body.quota) || 60;
  const amount = parseInt(req.body.amount_rs) || 0;
  if (!phone) return res.json({ success: false, error: 'Enter a valid phone' });
  const { data: user } = await sb.from('tt_users').select('*').eq('phone', phone).maybeSingle();
  if (!user) return res.json({ success: false, error: 'This number is not registered: ' + phone });
  const expires = new Date(Date.now() + days * 86400000).toISOString();
  await sb.from('tt_users').update({ plan: 'Monthly Pro', plan_quota: quota, plan_used: 0, plan_expires: expires }).eq('id', user.id);
  await sb.from('tt_transactions').insert({ user_id: user.id, credits: quota, amount_rs: amount, note: 'Monthly Pro ' + days + 'd (' + (req.body.note || 'Easypaisa') + ')' });
  res.json({ success: true, name: user.name, expires });
});
app.post('/admin/add-credits', async (req, res) => {
  if (!adminGate(req, res)) return;
  const phone = cleanPhone(req.body.phone);
  const credits = parseInt(req.body.credits) || 0;
  const amount = parseInt(req.body.amount_rs) || 0;
  if (!phone || credits <= 0) return res.json({ success: false, error: 'Enter a valid phone and credits' });
  const { data: user } = await sb.from('tt_users').select('*').eq('phone', phone).maybeSingle();
  if (!user) return res.json({ success: false, error: 'This number is not registered: ' + phone });
  await sb.from('tt_users').update({ credits: user.credits + credits }).eq('id', user.id);
  await sb.from('tt_transactions').insert({ user_id: user.id, credits, amount_rs: amount, note: req.body.note || 'Easypaisa manual' });
  res.json({ success: true, name: user.name, newBalance: user.credits + credits });
});
/* Undo/correct an accidental Add Credits — subtracts, clamped at 0, logged as a negative transaction */
app.post('/admin/remove-credits', async (req, res) => {
  if (!adminGate(req, res)) return;
  const phone = cleanPhone(req.body.phone);
  const credits = parseInt(req.body.credits) || 0;
  if (!phone || credits <= 0) return res.json({ success: false, error: 'Enter a valid phone and credits' });
  const { data: user } = await sb.from('tt_users').select('*').eq('phone', phone).maybeSingle();
  if (!user) return res.json({ success: false, error: 'This number is not registered: ' + phone });
  const newBalance = Math.max(0, user.credits - credits);
  await sb.from('tt_users').update({ credits: newBalance }).eq('id', user.id);
  await sb.from('tt_transactions').insert({ user_id: user.id, credits: -(user.credits - newBalance), amount_rs: 0, note: req.body.note || 'Manual correction' });
  res.json({ success: true, name: user.name, newBalance });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // AI reading capacity ke mutabiq (PDF ~20MB / 100 pages)
  fileFilter: (req, file, cb) => {
    const ok = /\.(pdf|png|jpe?g|webp|gif)$/i.test(file.originalname || '');
    cb(ok ? null : new Error('Only PDF or image files (JPG, PNG, WEBP, GIF) are allowed.'), ok);
  }
});

/* ═══════════════ BOOK BANK (Supabase Storage — curated STB books) ═══════════════ */
app.get('/books', async (req, res) => {
  if (!sb) return res.json({ success: true, books: [] });
  let q = sb.from('tt_books').select('id,class_name,subject,title,unit_label,size_mb').order('created_at', { ascending: false });
  /* ilike (bina wildcard) = case-insensitive exact match — "ENGLISH" bhi "English" se mil jayega */
  if (req.query.className) q = q.ilike('class_name', String(req.query.className).trim());
  if (req.query.subject) q = q.ilike('subject', String(req.query.subject).trim());
  const { data, error } = await q;
  if (error) return res.json({ success: false, error: error.message, books: [] });
  res.json({ success: true, books: data || [] });
});
app.post('/admin/upload-book', upload.single('file'), async (req, res) => {
  if (!adminGate(req, res)) { if (req.file) { try { fs.unlinkSync(req.file.path); } catch(e) {} } return; }
  if (!req.file) return res.json({ success: false, error: 'No file' });
  /* Trim + normalize — teacher UI dropdown se exact match zaroori hai */
  const className = String(req.body.className || '').trim();
  const subject = String(req.body.subject || '').trim();
  const title = String(req.body.title || '').trim();
  const unitLabel = String(req.body.unitLabel || '').trim();
  if (!className || !subject || !title) { try { fs.unlinkSync(req.file.path); } catch(e) {} return res.json({ success: false, error: 'Class, subject and title are required' }); }
  try {
    const ext = path.extname(req.file.originalname).toLowerCase() || '.pdf';
    const storagePath = (className + '/' + subject + '/' + Date.now() + ext).replace(/[^A-Za-z0-9/._-]+/g, '_');
    const buf = fs.readFileSync(req.file.path);
    const { error: upErr } = await sb.storage.from('books').upload(storagePath, buf, { contentType: ext === '.pdf' ? 'application/pdf' : 'image/jpeg', upsert: false });
    if (upErr) throw new Error('Storage upload failed: ' + upErr.message);
    const { data, error: dbErr } = await sb.from('tt_books').insert({ class_name: className, subject, title, unit_label: unitLabel, storage_path: storagePath, size_mb: +(req.file.size / 1048576).toFixed(2) }).select().maybeSingle();
    if (dbErr) {
      /* DB row nahi bana to storage ki file bhi hatao — warna orphan file reh jati hai aur admin ko jhoota "Uploaded" milta hai */
      try { await sb.storage.from('books').remove([storagePath]); } catch(e) {}
      throw new Error('Database insert failed: ' + dbErr.message);
    }
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.json({ success: true, book: data });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch(err) {}
    res.json({ success: false, error: e.message });
  }
});
app.post('/admin/delete-book', async (req, res) => {
  if (!adminGate(req, res)) return;
  const { data: book } = await sb.from('tt_books').select('*').eq('id', req.body.id).maybeSingle();
  if (book) {
    try { await sb.storage.from('books').remove([book.storage_path]); } catch(e) {}
    await sb.from('tt_books').delete().eq('id', book.id);
  }
  res.json({ success: true });
});
/* Book Bank se file utha kar temp par lao (generate ke liye) */
async function fetchBookToTemp(bookId) {
  const { data: book } = await sb.from('tt_books').select('*').eq('id', bookId).maybeSingle();
  if (!book) throw new Error('Book not found in Book Bank');
  const { data: blob, error } = await sb.storage.from('books').download(book.storage_path);
  if (error) throw new Error('Could not download book: ' + error.message);
  const buf = Buffer.from(await blob.arrayBuffer());
  if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
  const tmp = 'uploads/bank_' + Date.now() + path.extname(book.storage_path);
  fs.writeFileSync(tmp, buf);
  return { path: tmp, originalname: book.title + path.extname(book.storage_path), book };
}

/* ═══════════════ SLO BANK — official curriculum SLOs, prompts mein inject ═══════════════ */
app.post('/admin/add-slos', async (req, res) => {
  if (!adminGate(req, res)) return;
  const { className, subject, lines } = req.body;
  if (!className || !subject || !lines) return res.json({ success: false, error: 'Class, subject and SLO lines are required' });
  const rows = [];
  for (const raw of String(lines).split('\n')) {
    const p = raw.split('|').map(s => s.trim());
    if (p.length < 4 || !p[3]) continue;
    rows.push({ class_name: className, subject, unit_no: parseInt(p[0]) || null, unit_name: p[1] || '', slo_code: p[2] || '', slo_text: p[3], bloom_level: p[4] || '' });
  }
  if (!rows.length) return res.json({ success: false, error: 'No valid lines. Format per line: UnitNo | Unit Name | SLO-Code | SLO text | Bloom level' });
  const { error } = await sb.from('tt_slos').insert(rows);
  if (error) return res.json({ success: false, error: error.message });
  res.json({ success: true, added: rows.length });
});
app.get('/admin/slos', async (req, res) => {
  if (!adminGate(req, res)) return;
  const { data } = await sb.from('tt_slos').select('class_name,subject,unit_no').limit(2000);
  const summary = {};
  (data || []).forEach(s => { const k = s.class_name + ' — ' + s.subject; summary[k] = (summary[k] || 0) + 1; });
  res.json({ success: true, summary });
});
/* Prompt ke liye SLOs nikaalo */
async function slosFor(className, subject, unitInfo) {
  if (!sb || !className || !subject) return '';
  let q = sb.from('tt_slos').select('unit_no,unit_name,slo_code,slo_text,bloom_level').eq('class_name', className).eq('subject', subject).order('unit_no');
  const m = /^Unit (\d+)/.exec(unitInfo || '');
  if (m) q = q.eq('unit_no', parseInt(m[1]));
  const { data } = await q.limit(200);
  if (!data || !data.length) return '';
  const lines = data.map(s => `- [Unit ${s.unit_no || '-'}${s.unit_name ? ': ' + s.unit_name : ''}] ${s.slo_code ? s.slo_code + ' — ' : ''}${s.slo_text}${s.bloom_level ? ' (' + s.bloom_level + ')' : ''}`).join('\n');
  return `\nOFFICIAL CURRICULUM SLOs (from the Sindh SLO Bank — this is the authoritative list. Base ALL objectives, activities and questions on these EXACT SLOs; cover EVERY one in scope; do not invent or substitute SLOs):\n${lines}\n`;
}

/* ═══════════════ QUALITY VERIFICATION — doosra AI pass, document ko rubric par janchta hai ═══════════════ */
const SLO_DOC_TYPES = ['Lesson Plan', 'Worksheet', 'Exam Paper', 'Assessment Rubric', 'CRQ Paper', 'Annual Teaching Plan', 'Monthly Teaching Plan', 'Homework Sheet'];
app.post('/verify', async (req, res) => {
  const user = await userFromReq(req);
  if (sb && !user) return res.json({ success: false, error: 'LOGIN_REQUIRED' });
  /* Verify credit nahi kaat-ta, lekin API paisa kharch karta hai — abuse rokne ke liye cap */
  if (!rateLimit('verify:' + (user ? user.id : req.ip), 10, 10 * 60 * 1000)) return tooMany(res);
  const { content, documentType, className, subject, unitInfo } = req.body;
  if (!content) return res.json({ success: false, error: 'Nothing to verify' });
  try {
    const sloBlock = SLO_DOC_TYPES.includes(documentType) ? await slosFor(className, subject, unitInfo) : '';
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 1200,
      messages: [{ role: 'user', content: `You are a strict educational quality reviewer for Government of Sindh school materials.
${sloBlock ? sloBlock + '\nCheck SLO coverage against the official list above.' : ''}
Review this ${documentType || 'document'}${className ? ' (' + className + (subject ? ', ' + subject : '') + ')' : ''} against: (1) curriculum/SLO alignment, (2) factual accuracy, (3) age-appropriateness, (4) language quality (including Urdu/Sindhi if present), (5) completeness and formatting, (6) pedagogical soundness.

DOCUMENT:
${String(content).slice(0, 24000)}

Respond ONLY with JSON, no markdown fences:
{"score": <0-100>, "verdict": "<one line>", "issues": ["<specific issue>", ...max 6], "strengths": ["<specific strength>", ...max 4]}` }]
    });
    let txt = response.content[0].text.replace(/```json|```/g, '').trim();
    const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    res.json({ success: true, report: j });
  } catch (e) {
    res.json({ success: false, error: friendlyError(e.message) });
  }
});

/* ─── NO-AI document types — instant, offline, zero API cost ─────────────── */
const NO_AI_TYPES = [
  'Result Card','Attendance Sheet','Student Profile','Enrollment Form',
  'Character Certificate','Bonafide Certificate','Transfer Certificate',
  'School Leaving Certificate','NOC Letter','Experience Certificate',
  'Salary Certificate','Prize Certificate','Affidavit','Scholarship Form'
];

/* ─── Field labels for AI prompt building ────────────────────────────────── */
const LABELS = {
  schoolName:'School', teacherName:'Prepared by', className:'Class', group:'Group',
  subject:'Subject', unitInfo:'Unit/Lessons', duration:'Duration', examTerm:'Exam term',
  totalMarks:'Total marks', timeAllowed:'Time allowed', academicYear:'Session/Year',
  month:'Month', term:'Term', studentName:'Student name', childName:"Child's name",
  fatherName:"Father's name", grNumber:'G.R number', rollNumber:'Roll/Seat no',
  dob:'Date of birth', age:'Current age', address:'Address', guardianContact:'Guardian contact',
  fatherCnic:'Father CNIC', purpose:'Purpose', reason:'Reason', conduct:'Conduct',
  periodFrom:'Period from', periodTo:'Period to', admissionClass:'Class of admission',
  leavingClass:'Class at leaving', leavingDate:'Date of leaving', personName:'Name',
  designation:'Designation', cnic:'CNIC', fromDate:'From', toDate:'To',
  leaveType:'Leave type', refNumber:'Inward/Outward no', recipientDesignation:'Addressed to',
  subjectLine:'Letter subject', bodyPoints:'Main points', prizeTitle:'Prize/Position',
  eventName:'Event', eventDate:'Date', meetingDate:'Meeting date', agenda:'Agenda',
  bps:'BPS/Grade', basicPay:'Monthly salary', costCentre:'Cost centre',
  section:'Section', workingDays:'Working days', attDuration:'Duration',
  sessionYear:'Session', noticeReason:'Notice detail', extraData:'Additional information',
  hwScope:'Homework scope', includeKey:'Include answer key'
};

/* ─── Per-document AI guidance ───────────────────────────────────────────── */
const DOC_GUIDE = {
  'Lesson Plan':'Use the PPP teaching model (Presentation, Practice, Production) with TPR activities. Align every objective with Bloom\'s Taxonomy (Remember/Understand/Apply). Include SLOs, warm-up, phase-wise time allocation, differentiation for struggling and advanced students, homework, and a 3-level assessment rubric (Beginning/Developing/Achieved). If "Full Book" or a lesson range is given, cover every unit/lesson in that range.',
  'Worksheet':'Create a printable student worksheet with varied activity types (trace/write, circle/match, fill-in-the-blank, short answer). Include a student info header (Name, Class, Date, Roll No as blank lines to fill) and a self-check box. Cover the given unit(s)/lesson range completely.',
  'Assessment Rubric':'Create a 3-level rubric (Beginning / Developing / Achieved) for each SLO of the given unit/topic, in a clear table.',
  'Exam Paper':'Create a complete exam paper with sections (MCQs, short questions, long questions), marks distribution per section, clear instructions, and space indications. Match difficulty to the class level. Cover the given unit(s)/lesson range.',
  'Annual Teaching Plan':'Create a month-by-month annual teaching plan table covering the full academic session for the given class and subject, following the Sindh Textbook Board sequence.',
  'Monthly Teaching Plan':'Create a week-by-week plan for the given month, listing units/lessons, SLOs, activities, and assessment for each week.',
  'Progress Report':'Create a student progress report with subject-wise performance table (subjects auto-selected for the class level), teacher remarks, strengths, areas of improvement, and signature blocks for Class Teacher and Head Master.',
  'School Improvement Plan':'Create a structured SIP with priority areas, objectives, activities, timeline, responsible persons, and success indicators, suitable for a Sindh government school.',
  'Leave Application':'Write a formal leave application to the concerned authority with proper official format: reference number line, date, subject line, respectful body, and signature block with designation. Include Inward/Outward register number lines.',
  'Official Letter':'Write a formal government-style official letter with reference number line, date, recipient designation, subject line, respectful formal body covering the given main points, and signature block. Do NOT include any student details.',
  'Meeting Minutes':'Create formal meeting minutes with attendees section, agenda items, discussion summary, decisions taken, action items with responsible persons, and signature block.',
  'Budget Statement':'Create a school budget statement with income/expenditure table, item-wise breakdown, totals, and certification/signature block.',
  'Inspection Report':'Create a school inspection/visit report with sections: general information, enrollment, attendance, cleanliness, teaching quality observations, facilities, recommendations, and signature blocks.',
  'Stock Register':'Create a stock register format table with columns: S.No, Item name, Quantity received, Date, Quantity issued, Balance, Remarks. Include 15 blank numbered rows.',
  'Library Register':'Create a library register format table with columns: S.No, Book title, Author, Book number, Issue date, Issued to, Return date, Remarks. Include 15 blank numbered rows.',
  'Parent Complaint Letter':'Write a respectful notice/letter to the parent about the given matter, mentioning the child\'s name, class, roll number and G.R number in the header block only. Keep the tone constructive and invite the parent for a meeting.',
  'Age Calculator Sheet':'Create an age eligibility record sheet table with columns: S.No, Student name, Father name, Date of birth, Age on cutoff date, Eligible (Yes/No). Include 15 blank numbered rows.',
  'Event Banner Content':'Create event announcement content: main heading, tagline, key details (date, time, venue), and 3 short promotional lines.',
  'Complaint Letter':'Write a formal complaint letter with reference line, date, recipient, subject, factual respectful body covering the main points, requested action, and signature block.',
  'Homework Sheet':'Create a printable homework/assignment sheet for the given lesson scope with THREE differentiated levels clearly separated: "⭐ SUPPORT" (easier tasks for struggling learners), "⭐⭐ CORE" (whole-class tasks), "⭐⭐⭐ CHALLENGE" (extension tasks for advanced learners). Use varied task types appropriate to the class level, a student info header (Name, Class, Roll No, Date as blank lines), estimated time per section, a short instruction line for parents, and a parent signature line at the end. If "Include answer key: Yes" is specified in the details, add a complete ANSWER KEY section at the very end starting with the line [[PAGEBREAK]] so it prints on its own page.',
  'Learning Gap Analysis':'You are given real class assessment data (subject-wise marks of every student) in the details below. Write a professional Learning Gap Analysis & Remedial Plan: (1) overall class performance summary with key numbers, (2) subject-wise gap analysis in a table — average, weakest areas, likely root causes, (3) a "Students Needing Extra Support" table listing each at-risk student with weak subjects and 2-3 specific remedial activities each, (4) a practical 4-week whole-class improvement plan (week-by-week table), (5) a re-assessment strategy, (6) 3 practical tips teachers can share with parents. Use ONLY the exact data provided — never invent students or marks.'
};

/* ─── Helpers: file → Claude content block, language instructions ─────────── */
function fileToBlock(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();
  const data = fs.readFileSync(filePath).toString('base64');
  if (ext === '.pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
  }
  const mt = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : (ext === '.gif' ? 'image/gif' : 'image/jpeg'));
  return { type: 'image', source: { type: 'base64', media_type: mt, data } };
}

const LANG_INSTRUCTIONS = {
  english: 'Write ONLY in English.',
  urdu: 'Write ONLY in formal Urdu (Nastaliq script). Proofread carefully — grammar, spelling and idiom must be 100% correct. No English words unless unavoidable (names, numbers).',
  sindhi: 'Write ONLY in formal Sindhi (Arabic-Sindhi script, 52-letter alphabet). Proofread carefully — grammar and spelling must be 100% correct standard Sindhi.',
  roman_urdu: 'Write ONLY in Roman Urdu (Urdu words in Latin/English letters).',
  bilingual_en_ur: 'Write in BOTH English AND Urdu — every heading, label, and content in both languages side by side.',
  bilingual_en_sd: 'Write in BOTH English AND Sindhi — every part bilingual.',
  trilingual: 'Write in English, Urdu, AND Sindhi — all three languages throughout.',
  en_ur_roman: 'Write in English, Urdu script, AND Roman Urdu — all three throughout.'
};
/* Per-document language override (Parent Notice, Official Letter, Leave Application etc.) */
function resolveLangInstruction(language, fields) {
  if (fields && fields.docLang) {
    const map = { English: 'english', Urdu: 'urdu', Sindhi: 'sindhi' };
    const key = map[fields.docLang];
    if (key) return LANG_INSTRUCTIONS[key];
  }
  return LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.bilingual_en_ur;
}
function buildDetailLines(fields) {
  return Object.entries(fields)
    .filter(([k, v]) => v && !k.startsWith('_') && k !== 'docLang')
    .map(([k, v]) => `${LABELS[k] || k}: ${v}`)
    .join('\n');
}

/* ─── My Documents — har AI document save hota hai, yahan se wapas milta hai ── */
app.get('/documents', async (req, res) => {
  const user = await userFromReq(req);
  if (!user) return res.json({ success: false, error: 'LOGIN_REQUIRED' });
  const { data, error } = await sb.from('tt_documents')
    .select('id,doc_type,title,created_at')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
  if (error) return res.json({ success: false, error: error.message });
  res.json({ success: true, documents: data || [] });
});
app.get('/documents/:id', async (req, res) => {
  const user = await userFromReq(req);
  if (!user) return res.json({ success: false, error: 'LOGIN_REQUIRED' });
  const { data } = await sb.from('tt_documents').select('*').eq('id', req.params.id).eq('user_id', user.id).maybeSingle();
  if (!data) return res.json({ success: false, error: 'Document not found.' });
  res.json({ success: true, document: data });
});
app.post('/documents/delete', async (req, res) => {
  const user = await userFromReq(req);
  if (!user) return res.json({ success: false, error: 'LOGIN_REQUIRED' });
  await sb.from('tt_documents').delete().eq('id', req.body.id).eq('user_id', user.id);
  res.json({ success: true });
});

/* ─── Version (frontend isse check karta hai ke server nayi hai ya nahi) ── */
app.get('/version', (req, res) => res.json({ v: '3.4', features: ['generate-with-file', 'streaming', 'pdf-books', 'paid-system', 'book-bank', 'slo-bank', 'verify', 'documents', 'assistant', 'premium-tools', 'seo-pwa'] }));

/* ─── SITEMAP — dynamic (lastmod hamesha aaj ki date, deploy hote hi taaza signal) ─────────── */
const SITE_URL = 'https://teachertoolkitsindh.com';
app.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: '/', changefreq: 'weekly', priority: '1.0' }];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${SITE_URL}${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.send(xml);
});

/* ─── Streaming: AI jo likhta jaye foran bhejo — Render ki 100s timeout kabhi nahi lagegi ─── */
function friendlyError(msg) {
  msg = msg || 'Unknown error';
  if (/request_too_large|exceeds|too large|maximum/i.test(msg)) return 'File exceeds the AI limit — use the Resizer tool to extract only the relevant unit/chapter pages.';
  if (/overloaded/i.test(msg)) return 'AI is busy right now — please try again in 30 seconds.';
  if (/authentication|invalid.*key|401/i.test(msg)) return 'API key is wrong or missing — check ANTHROPIC_API_KEY in Render Environment.';
  if (/credit|billing|insufficient/i.test(msg)) return 'API credits exhausted — check balance at console.anthropic.com.';
  return msg;
}
async function streamToRes(res, params, onDone, onFail) {
  let started = false, full = '';
  try {
    const s = client.messages.stream(params);
    s.on('text', (t) => {
      if (!started) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('X-Content-Stream', '1');
        res.setHeader('Cache-Control', 'no-cache');
        started = true;
      }
      full += t;
      res.write(t);
    });
    await s.finalMessage();
    if (!started) { res.json({ success: false, error: 'AI returned an empty response — please try again.' }); if (onFail) onFail(); return; }
    res.end();
    if (onDone) onDone(full);
  } catch (error) {
    const msg = friendlyError(error.message);
    if (!started) res.json({ success: false, error: msg });
    else res.end('\n[[GENERATION-ERROR]] ' + msg);
    if (onFail) onFail();
  }
}

/* ─── 11-Part Canonical Lesson Plan Book Pattern (Pro) ─────────────────── */
const LP_BOOK_PATTERN = `
PREMIUM BOOK MODE — For EVERY unit, follow this exact 11-part structure (do not skip any part):
1. COVER/TITLE BLOCK: unit number + title with Bismillah line.
2. BASIC INFO TABLE: school, class, subject, unit, duration, teacher.
3. SLO TABLE: every Student Learning Outcome of the unit with its Bloom's level, in English AND Urdu.
4. WEEKLY SCHEDULE TABLE: day-by-day breakdown of the unit's lessons.
5. INDIVIDUAL LESSON BLOCKS: for each lesson — PPP model (Presentation/Practice/Production) with TPR activities, time allocation per phase, and Urdu translations of key instructions.
6. NURSERY RHYME / TEXT BOX: where the unit contains one.
7. DIFFERENTIATION TABLE: two columns — Struggling learners vs Advanced learners strategies.
8. HOMEWORK TABLE: per lesson, with Urdu instructions.
9. ASSESSMENT RUBRIC: per SLO, three levels — Beginning / Developing / Achieved.
10. PREPARED BY + SUPERVISOR REMARKS block with signature lines.
11. PRINTABLE WORKSHEET: trace/write, circle/match, fill-in, speak-aloud items + a Self-Check box.
Cover the units sequentially and completely. Bilingual throughout (English + Urdu). This is a professional publishable book — maintain consistent formatting across all units.`;

/* ─── GENERATE ───────────────────────────────────────────────────────────── */
app.post('/generate', async (req, res) => {
  const { documentType, language } = req.body;
  const fields = req.body.fields || {};
  const marks = req.body.marks || [];
  const studentsList = req.body.studentsList || [];

  /* Full-Class Result Cards — poori class ek file mein, har card apne page par */
  if (documentType === 'Result Card' && req.body.fullClass && Array.isArray(req.body.studentsMarks)) {
    try {
      const cards = req.body.studentsMarks.map(sm =>
        OFFLINE_BUILDERS['Result Card']({ ...fields, ...sm.student }, sm.marks || [])
      );
      return res.json({ success: true, content: cards.join('\n\n[[PAGEBREAK]]\n\n'), offline: true });
    } catch (e) { return res.json({ success: false, error: e.message }); }
  }

  /* Instant offline documents — no API call */
  if (NO_AI_TYPES.includes(documentType)) {
    try {
      const content = buildOfflineDocument(documentType, fields, marks, studentsList);
      return res.json({ success: true, content, offline: true });
    } catch (e) {
      return res.json({ success: false, error: e.message });
    }
  }

  const detailLines = buildDetailLines(fields);
  const sloBlock = SLO_DOC_TYPES.includes(documentType) ? await slosFor(fields.className, fields.subject, fields.unitInfo) : '';

  const prompt = `You are a professional educator creating a ${documentType} for a Government of Sindh school in Pakistan.

DETAILS:
${detailLines || '(none provided)'}

DOCUMENT INSTRUCTIONS: ${DOC_GUIDE[documentType] || 'Create a complete, professional, classroom-ready document.'}
${documentType === 'Lesson Plan' && /Full Book/i.test(fields.unitInfo || '') ? LP_BOOK_PATTERN : ''}${sloBlock}
LANGUAGE INSTRUCTION: ${resolveLangInstruction(language, fields)}

RULES:
- Follow Sindh Textbook Board (STB) curriculum standards and Sindh Education & Literacy Department conventions.
- Use ONLY the details provided above. Do NOT invent or include any student names, school names, or personal details that were not provided.
- Use markdown headings (#, ##, ###) and pipe tables (| col | col |) where a table improves clarity.
- Generate COMPLETE content — no placeholders like [insert here].`;

  const gate = await takeCredit(req, res);
  if (!gate) return;
  await streamToRes(res, {
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  },
  (text) => saveDoc(gate.user, documentType, (fields.subject || '') + ' ' + (fields.unitInfo || fields.className || ''), text),
  () => refundCredit(gate.user, gate.viaPlan));
});

/* ─── GENERATE WITH UPLOADED BOOK/DOCUMENT ─────────────────────────────────
   Lesson Plan, Worksheet, Exam Paper, Rubric, Annual/Monthly Plan —
   AI uploaded book/PDF/image ko deeply parh kar EXACTLY usi se banata hai */
app.post('/generate-with-file', upload.single('file'), async (req, res) => {
  const { documentType, language, bookId } = req.body;
  let fields = {};
  try { fields = JSON.parse(req.body.fieldsJson || '{}'); } catch (e) {}
  /* File ya Book Bank — dono mein se ek */
  if (!req.file && bookId && sb) {
    try { req.file = await fetchBookToTemp(bookId); } catch (e) { return res.json({ success: false, error: e.message }); }
  }
  if (!req.file) return res.json({ success: false, error: 'No file uploaded' });

  try {
    const block = fileToBlock(req.file.path, req.file.originalname);
    const detailLines = buildDetailLines(fields);
    const sloBlock = SLO_DOC_TYPES.includes(documentType) ? await slosFor(fields.className, fields.subject, fields.unitInfo) : '';
    const prompt = `You are a professional educator creating a ${documentType} for a Government of Sindh school in Pakistan.

DETAILS:
${detailLines || '(none provided)'}

SOURCE MATERIAL: A book/syllabus/document is attached. READ IT DEEPLY, word by word, page by page. The ${documentType} must be based EXACTLY and COMPLETELY on this attached content — its actual topics, vocabulary, exercises, and sequence. Do NOT invent content that is not in the source. If a unit/lesson range is specified in DETAILS, cover that range from the source; if "Full Book" is specified, cover the entire attached content.

DOCUMENT INSTRUCTIONS: ${DOC_GUIDE[documentType] || 'Create a complete, professional, classroom-ready document.'}
${documentType === 'Lesson Plan' && /Full Book/i.test(fields.unitInfo || '') ? LP_BOOK_PATTERN : ''}${sloBlock}
LANGUAGE INSTRUCTION: ${resolveLangInstruction(language, fields)}

RULES:
- Follow Sindh Textbook Board (STB) curriculum standards.
- Use ONLY the details provided. Do NOT include any student personal details unless provided.
- Use markdown headings (#, ##, ###) and pipe tables (| col | col |) where a table improves clarity.
- Generate COMPLETE content — no placeholders.`;

    const gate = await takeCredit(req, res);
    if (!gate) { try { fs.unlinkSync(req.file.path); } catch (e) {} return; }
    await streamToRes(res, {
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: [block, { type: 'text', text: prompt }] }]
    },
    (text) => saveDoc(gate.user, documentType, (fields.subject || '') + ' ' + (fields.unitInfo || ''), text),
    () => refundCredit(gate.user, gate.viaPlan));
    try { fs.unlinkSync(req.file.path); } catch (e) {}
  } catch (error) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    res.json({ success: false, error: friendlyError(error.message) });
  }
});

/* ─── GENERATE CRQ ───────────────────────────────────────────────────────── */
app.post('/generate-crq', upload.single('file'), async (req, res) => {
  const { schoolName, teacherName, className, subject, unitName, difficulty, bloomLevels, mcqCount, shortCount, longCount, includeAnswerKey, language } = req.body;
  let bl; try { bl = JSON.parse(bloomLevels || '[]'); } catch (e) { bl = []; }
  if (!Array.isArray(bl) || !bl.length) bl = ['Remember', 'Understand', 'Apply'];

  let srcBlock = null;
  if (req.file) {
    try { srcBlock = fileToBlock(req.file.path, req.file.originalname); } catch(e) {}
    try { fs.unlinkSync(req.file.path); } catch(e) {}
  }

  const prompt = `You are a professional exam paper creator for Government of Sindh schools in Pakistan.
Create a complete CRQ paper for:
${schoolName ? 'School: ' + schoolName : ''} ${teacherName ? '| Teacher: ' + teacherName : ''}
Class: ${className} | Subject: ${subject}
Unit/Lessons: ${unitName} (if a range like "Lessons 3-7" or "Full Book" is given, cover all of it)
Difficulty: ${difficulty} | Bloom's Levels: ${bl.join(', ')}
MCQs: ${mcqCount} | Short Questions: ${shortCount} | Long Questions: ${longCount}
Include Answer Key: ${includeAnswerKey}
${srcBlock ? 'SOURCE MATERIAL: A book/document is attached. READ IT DEEPLY, word by word. Base every question EXACTLY on its content — its topics, concepts, facts and exercises. Cover the specified unit/lesson range from it; do NOT invent content not present in the source.' : ''}
Language: ${language === 'bilingual_en_ur' ? 'Bilingual English + Urdu' : language}
${await slosFor(className, subject, unitName)}Follow the Sindh Textbook Board curriculum. Do NOT include any student personal details.
Generate a complete, professional exam paper with all sections and marks distribution.`;

  try {
    const content = srcBlock ? [srcBlock, { type: 'text', text: prompt }] : prompt;
    const gate = await takeCredit(req, res);
    if (!gate) return;
    await streamToRes(res, {
      model: 'claude-sonnet-4-6', max_tokens: 8000,
      messages: [{ role: 'user', content }]
    },
    (text) => saveDoc(gate.user, 'CRQ Paper', subject + ' ' + unitName, text),
    () => refundCredit(gate.user, gate.viaPlan));
  } catch (error) {
    res.json({ success: false, error: friendlyError(error.message) });
  }
});

/* ─── UPLOAD & GENERATE ──────────────────────────────────────────────────── */
app.post('/upload-generate', upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ success: false, error: 'No file uploaded' });
  const { documentType, schoolName, teacherName, className, subject, language } = req.body;
  try {
    const block = fileToBlock(req.file.path, req.file.originalname);
    const gate = await takeCredit(req, res);
    if (!gate) { try { fs.unlinkSync(req.file.path); } catch (e) {} return; }
    await streamToRes(res, {
      model: 'claude-sonnet-4-6', max_tokens: 8000,
      messages: [{ role: 'user', content: [
        block,
        { type: 'text', text: `Create a ${documentType}${schoolName ? ' for ' + schoolName : ''}${className ? ', ' + className : ''}${subject ? ', Subject: ' + subject : ''}${teacherName ? ', Prepared by: ' + teacherName : ''}. LANGUAGE INSTRUCTION: ${LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.bilingual_en_ur} ${DOC_GUIDE[documentType] || ''} READ the attached book/document DEEPLY, word by word, and base the document EXACTLY and completely on its content. Do NOT include any student personal details. Use markdown headings and pipe tables where helpful.` }
      ]}]
    },
    (text) => saveDoc(gate.user, documentType, subject || '', text),
    () => refundCredit(gate.user, gate.viaPlan));
    try { fs.unlinkSync(req.file.path); } catch(e) {}
  } catch (error) {
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.json({ success: false, error: friendlyError(error.message) });
  }
});

/* ═══════════════ OFFLINE DOCUMENT BUILDERS ═══════════════
   14 instant documents — proper built-in content, zero API cost.
   Uses ONLY the fields provided by the form (no hardcoded school/SEMIS). */

const BISMILLAH = 'بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ';

function fmt(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch(e) { return d; }
}
function today() { return fmt(new Date()); }
function blank(v, len) { return v && String(v).trim() ? String(v).trim() : '_'.repeat(len || 15); }
function sd(name) { return name ? `son/daughter of ${name}` : 'son/daughter of ' + '_'.repeat(20); }

function headerBlock(f, title) {
  return `[[LOGO]]\n${BISMILLAH}\n\n# ${blank(f.schoolName, 40)}\n## ${title}\n\nDate: ${today()}${f.refNumber ? '\nRef / Inward-Outward No: ' + f.refNumber : ''}\n`;
}
function signBlock3() {
  return `\n\n| Class Teacher | Head Master / Principal | Beat Officer / Supervisor |\n|---|---|---|\n| \u00A0 | \u00A0 | \u00A0 |\n| \u00A0 | \u00A0 | \u00A0 |\n| Signature & Stamp | Signature & Stamp | Signature & Stamp |`;
}
function signBlock2() {
  return `\n\n| Class Teacher | Head Master / Principal |\n|---|---|\n| \u00A0 | \u00A0 |\n| \u00A0 | \u00A0 |\n| Signature & Stamp | Signature & Stamp |`;
}
function signBlockHM(f) {
  return `\n\n\n_______________________\n**Head Master / Principal**\n${blank(f.teacherName, 25)}\n${blank(f.schoolName, 35)}\nSignature & Official Stamp`;
}
function gradeOf(pct) {
  if (pct >= 80) return 'A-1 (Outstanding)';
  if (pct >= 70) return 'A (Excellent)';
  if (pct >= 60) return 'B (Very Good)';
  if (pct >= 50) return 'C (Good)';
  if (pct >= 40) return 'D (Fair)';
  if (pct >= 33) return 'E (Pass)';
  return 'F (Fail)';
}

const OFFLINE_BUILDERS = {

  'Character Certificate': (f) => {
    const conduct = (f.conduct || 'Good').toUpperCase();
    return headerBlock(f, 'CHARACTER CERTIFICATE') +
`\nThis is to certify that **${blank(f.studentName, 25)}**, ${sd(f.fatherName)}, bearing G.R No. **${blank(f.grNumber, 8)}**, ${f.className ? 'is/was a student of **' + f.className + '**' : 'is/was a student'} at this institution${f.periodFrom || f.periodTo ? ` from **${fmt(f.periodFrom) || '________'}** to **${fmt(f.periodTo) || '________'}**` : ''}.${f.dob ? `\n\nDate of Birth (as per school record): **${fmt(f.dob)}**${f.age ? ' — Current age: ' + f.age : ''}` : ''}

During his/her stay at this institution, his/her character and conduct were found **${conduct}**. He/She bears a good moral character, remained regular and disciplined, and was never involved in any activity against the rules and discipline of the school.

This certificate is issued on his/her request${f.purpose ? ` for the purpose of **${f.purpose}**` : ''}. The institution wishes him/her success in all future endeavors.` +
signBlockHM(f);
  },

  'Bonafide Certificate': (f) =>
    headerBlock(f, 'BONAFIDE CERTIFICATE') +
`\nThis is to certify that **${blank(f.studentName, 25)}**, ${sd(f.fatherName)}, bearing G.R No. **${blank(f.grNumber, 8)}**, is a **BONAFIDE student of ${blank(f.className, 10)}** at this institution for the academic session **${blank(f.sessionYear, 10)}**.

This certificate is issued on the request of the student/guardian${f.purpose ? ` for the purpose of **${f.purpose}**` : ''}.` +
    signBlockHM(f),

  'Transfer Certificate': (f) =>
    headerBlock(f, 'TRANSFER CERTIFICATE') +
`
| Field | Detail |
|---|---|
| Student Name | ${blank(f.studentName, 25)} |
| Father's Name | ${blank(f.fatherName, 25)} |
| G.R Number | ${blank(f.grNumber, 8)} |
| Date of Birth | ${fmt(f.dob) || '____________'} |${f.age ? `\n| Current Age | ${f.age} |` : ''}
| Class of Admission | ${blank(f.admissionClass, 10)} |
| Class at the Time of Leaving | ${blank(f.leavingClass, 10)} |
| Date of Leaving | ${fmt(f.leavingDate) || today()} |
| Reason for Leaving | ${blank(f.reason, 20)} |
| Conduct | ${f.conduct || 'Good'} |
| Progress | Satisfactory |
| Dues | Nil |

Certified that the above information is in accordance with the school General Register.` +
    signBlockHM(f),

  'School Leaving Certificate': (f) =>
    headerBlock(f, 'SCHOOL LEAVING CERTIFICATE') +
`\nThis is to certify that **${blank(f.studentName, 25)}**, ${sd(f.fatherName)}, bearing G.R No. **${blank(f.grNumber, 8)}**, was a student of this institution and left the school from **${blank(f.leavingClass, 10)}** on **${fmt(f.leavingDate) || today()}**.

| Field | Detail |
|---|---|
| Date of Birth (in words & figures) | ${fmt(f.dob) || '____________'} |${f.age ? `\n| Age at Leaving | ${f.age} |` : ''}
| Conduct | ${f.conduct || 'Good'} |
| Dues | Nil |

He/She is granted this School Leaving Certificate on the request of his/her parent/guardian.` +
    signBlockHM(f),

  'NOC Letter': (f) =>
    headerBlock(f, 'NO OBJECTION CERTIFICATE (NOC)') +
`\n**To Whom It May Concern**

This is to certify that **${blank(f.personName, 25)}**${f.fatherName ? ', ' + sd(f.fatherName) : ''}${f.designation ? ', serving as **' + f.designation + '**' : ''} at this institution${f.cnic ? ', CNIC / Personal ID No. **' + f.cnic + '**' : ''}, is a regular employee/member of this institution.

This institution has **NO OBJECTION** ${f.purpose ? 'to the above-named person **' + f.purpose + '**' : 'to the above-named person applying for the stated purpose'}.

This certificate is issued on his/her request and does not confer any legal right or claim.` +
    signBlockHM(f),

  'Experience Certificate': (f) =>
    headerBlock(f, 'EXPERIENCE CERTIFICATE') +
`\nThis is to certify that **${blank(f.personName, 25)}**${f.fatherName ? ', ' + sd(f.fatherName) : ''}${f.cnic ? ', CNIC / Personal ID No. **' + f.cnic + '**' : ''}, has served at this institution as **${blank(f.designation, 18)}**${f.fromDate || f.toDate ? ` from **${fmt(f.fromDate) || '________'}** to **${fmt(f.toDate) || 'to date'}**` : ''}.

During the period of his/her service, his/her performance, conduct, and dedication towards duty were found **highly satisfactory**. He/She performed all assigned duties with responsibility and professionalism.

We wish him/her success in future professional endeavors.` +
    signBlockHM(f),

  'Salary Certificate': (f) =>
    headerBlock(f, 'SALARY CERTIFICATE') +
`\nThis is to certify that **${blank(f.personName, 25)}**${f.cnic ? ', CNIC / Personal ID No. **' + f.cnic + '**' : ''}, is serving at this institution on the post of **${blank(f.designation, 18)}**${f.bps ? ' (**' + f.bps + '**)' : ''}.

| Field | Detail |
|---|---|
| Designation | ${blank(f.designation, 18)} |${f.bps ? `\n| BPS / Grade | ${f.bps} |` : ''}${f.basicPay ? `\n| Monthly Salary | Rs. ${f.basicPay}/- |` : '\n| Monthly Salary | As per Government pay scale |'}${f.costCentre ? `\n| Cost Centre / DDO Code | ${f.costCentre} |` : ''}

This certificate is issued on his/her request for official use.` +
    signBlockHM(f),

  'Prize Certificate': (f) =>
    `${BISMILLAH}\n\n# ${blank(f.schoolName, 40)}\n## 🏆 CERTIFICATE OF ACHIEVEMENT 🏆\n\nThis certificate is proudly presented to\n\n# ★ ${blank(f.childName || f.studentName, 25)} ★\n\n${f.fatherName ? sd(f.fatherName).replace('son/daughter', 'Son/Daughter') + '\n' : ''}${f.className ? 'Class: **' + f.className + '**' : ''}${f.grNumber ? ' | G.R No: **' + f.grNumber + '**' : ''}${f.rollNumber ? ' | Roll No: **' + f.rollNumber + '**' : ''}

In recognition of securing **${blank(f.prizeTitle, 18)}**${f.eventName ? ' in **' + f.eventName + '**' : ''}${f.eventDate ? ' held on **' + fmt(f.eventDate) + '**' : ''}.

His/Her hard work, dedication, and outstanding performance make the whole school proud. Keep up the excellent work!

Awarded on: ${today()}` +
    signBlockHM(f),

  'Enrollment Form': (f) =>
    headerBlock(f, 'STUDENT ENROLLMENT / ADMISSION FORM') +
`
| Field | Detail |
|---|---|
| G.R Number | ${blank(f.grNumber, 8)} |
| Student Name | ${blank(f.studentName, 30)} |
| Father's Name | ${blank(f.fatherName, 30)} |
| Father's CNIC | ${blank(f.fatherCnic, 18)} |
| Date of Birth | ${fmt(f.dob) || '____________'} |
| Current Age | ${f.age || '____________'} |
| Class of Admission | ${blank(f.className, 12)} |
| Address | ${blank(f.address, 40)} |

### FATHER'S / GUARDIAN'S AFFIDAVIT

I, **${blank(f.fatherName, 25)}**, hereby solemnly declare that **${blank(f.studentName, 25)}** is my child, and that all the information provided above is true and correct to the best of my knowledge. The date of birth stated above is accurate as per record.

Father/Guardian Signature & Thumb Impression: ____________________  Date: ____________` +
    signBlock3(),

  'Student Profile': (f) =>
    headerBlock(f, 'STUDENT PROFILE') +
`
[[PHOTO]]

| Field | Detail |
|---|---|
| Student Name | ${blank(f.studentName, 30)} |
| Father's Name | ${blank(f.fatherName, 30)} |
| G.R Number | ${blank(f.grNumber, 8)} |
| Roll / Seat No | ${blank(f.rollNumber, 8)} |
| Class | ${blank(f.className, 12)} |
| Date of Birth | ${fmt(f.dob) || '____________'} |
| Current Age | ${f.age || '____________'} |
| Address | ${blank(f.address, 40)} |
| Guardian Contact | ${blank(f.guardianContact, 15)} |

### Academic & General Record

| Area | Remarks |
|---|---|
| Attendance | \u00A0 |
| Academic Performance | \u00A0 |
| Behavior & Discipline | \u00A0 |
| Co-curricular Activities | \u00A0 |
| Health Notes | \u00A0 |` +
    signBlockHM(f),

  'Result Card': (f, marks) => {
    let rows = '', totMax = 0, totObt = 0, allFilled = marks.length > 0;
    marks.forEach(m => {
      const t = parseFloat(m.total) || 0;
      const o = m.obtained === '' || m.obtained === undefined ? null : parseFloat(m.obtained);
      totMax += t;
      if (o === null) allFilled = false; else totObt += o;
      const pct = (o !== null && t) ? Math.round((o / t) * 100) : null;
      rows += `| ${m.subject} | ${m.total} | ${o === null ? '\u00A0' : m.obtained} | ${pct === null ? '\u00A0' : gradeOf(pct)} |\n`;
    });
    const overallPct = (allFilled && totMax) ? Math.round((totObt / totMax) * 100) : null;
    return headerBlock(f, 'STUDENT RESULT CARD') +
`
[[PHOTO]]

| Field | Detail | Field | Detail |
|---|---|---|---|
| Student Name | ${blank(f.studentName, 22)} | G.R Number | ${blank(f.grNumber, 8)} |
| Father's Name | ${blank(f.fatherName, 22)} | Seat / Roll No | ${blank(f.rollNumber, 8)} |
| Class | ${blank(f.className, 10)} | Session | ${blank(f.sessionYear, 10)} |
| Examination | ${f.term || 'Annual'} | Result Date | ${today()} |

### Subject-wise Marks

| Subject | Total Marks | Marks Obtained | Grade |
|---|---|---|---|
${rows}| **TOTAL** | **${totMax}** | **${allFilled ? totObt : '\u00A0'}** | **${overallPct === null ? '\u00A0' : overallPct + '% — ' + gradeOf(overallPct)}** |

**Result:** ${overallPct === null ? '________________' : (overallPct >= 33 ? 'PASS — Promoted to next class' : 'FAIL')}
**Position in Class:** ________________
**Remarks:** ________________________________________` +
    signBlock2();
  },

  'Attendance Sheet': (f, marks, students) => {
    const label = f._attMode === 'custom'
      ? `Duration: **${f.attDuration || '____________'}**`
      : `Month: **${f.attDuration || '____________'}**`;
    let rows = '';
    const list = (students && students.length) ? students : [];
    const n = Math.max(list.length, 15);
    for (let i = 0; i < n; i++) {
      const s = list[i] || {};
      rows += `| ${i + 1} | ${s.grNumber || '\u00A0'} | ${s.rollNumber || '\u00A0'} | ${s.name || '\u00A0'} | \u00A0 | \u00A0 | \u00A0 | \u00A0 |\n`;
    }
    return headerBlock(f, 'STUDENT ATTENDANCE SHEET') +
`
**Class:** ${blank(f.className, 12)}${f.section ? ' — Section: **' + f.section + '**' : ''}
${label}${f.workingDays ? '\n**Total Working Days:** ' + f.workingDays : ''}
${list.length ? '\n*(Student list auto-filled from Student Database — ' + list.length + ' students)*' : ''}

| S.No | G.R No | Roll No | Student Name | Days Present | Days Absent | Leave | % |
|---|---|---|---|---|---|---|---|
${rows}
**Summary:** Total Students: ${list.length || '______'} | Average Attendance: ______%` +
    signBlockHM(f);
  },

  'Affidavit': (f) =>
    `${BISMILLAH}\n\n# AFFIDAVIT / UNDERTAKING\n\nDate: ${today()}\n
I, **${blank(f.personName, 25)}**${f.fatherName ? ', ' + sd(f.fatherName) : ''}${f.cnic ? ', CNIC No. **' + f.cnic + '**' : ''}, do hereby solemnly affirm and declare on oath that:

1. The information and documents provided by me${f.purpose ? ' regarding **' + f.purpose + '**' : ''} are true and correct to the best of my knowledge and belief.
2. Nothing has been concealed or misstated therein.
3. I fully understand that in case any information is found false or forged at any stage, I shall be liable to legal action under the relevant laws.

**Deponent**

Signature / Thumb Impression: ____________________
Name: ${blank(f.personName, 25)}${f.cnic ? '\nCNIC: ' + f.cnic : ''}
Date: ${today()}

**Attestation**

_______________________
Attesting Officer — Signature & Stamp`,

  'Scholarship Form': (f) =>
    headerBlock(f, 'SCHOLARSHIP / WAZIFA APPLICATION FORM') +
`
| Field | Detail |
|---|---|
| Student Name | ${blank(f.studentName, 30)} |
| Father's Name | ${blank(f.fatherName, 30)} |
| G.R Number | ${blank(f.grNumber, 8)} |
| Roll / Seat No | ${blank(f.rollNumber, 8)} |
| Class | ${blank(f.className, 12)} |
| Date of Birth | ${fmt(f.dob) || '____________'} |
| Current Age | ${f.age || '____________'} |

I hereby apply for the scholarship/wazifa for the current academic session. I declare that the above information is correct as per school record.

Student / Father Signature: ____________________  Date: ____________` +
    signBlockHM(f)
};

function buildOfflineDocument(documentType, fields, marks, studentsList) {
  const builder = OFFLINE_BUILDERS[documentType];
  if (!builder) {
    return `# ${documentType}\n\nDate: ${today()}\n\n${Object.entries(fields).filter(([k,v])=>v&&!k.startsWith('_')).map(([k,v])=>`${LABELS[k]||k}: ${v}`).join('\n')}\n\nGenerated by Teacher Toolkit`;
  }
  return builder(fields, marks || [], studentsList || []);
}

/* ─── DOWNLOAD DOCX (with real table support) ────────────────────────────── */
function isTableLine(l) { return /^\s*\|.*\|\s*$/.test(l); }
function isSeparatorLine(l) { return /^\s*\|[\s\-:|]+\|\s*$/.test(l); }
function splitCells(l) {
  return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}
const AR_RE = /[\u0600-\u06FF]/;
function isArabicLine(t) {
  const ar = (t.match(/[\u0600-\u06FF]/g) || []).length;
  const lat = (t.match(/[A-Za-z]/g) || []).length;
  return ar > 0 && ar >= lat;  /* Urdu/Sindhi ghalib ho to RTL */
}
function runFromText(text, opts) {
  const parts = [];
  const rtl = isArabicLine(text);
  if (rtl) opts = { ...opts, font: 'Jameel Noori Nastaleeq', rightToLeft: true, size: Math.round((opts.size || 22) * 1.15) };
  const re = /\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(new TextRun({ text: text.slice(last, m.index), ...opts }));
    parts.push(new TextRun({ text: m[1], ...opts, bold: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(new TextRun({ text: text.slice(last), ...opts }));
  if (!parts.length) parts.push(new TextRun({ text: '', ...opts }));
  return parts;
}

app.post('/download-docx', async (req, res) => {
  const { content, fileName, photo, logo, documentType } = req.body;
  let photoBuf = null, photoType = 'jpg', logoBuf = null, logoType = 'png';
  if (photo && /^data:image\/(png|jpe?g);base64,/.test(photo)) {
    photoType = photo.includes('image/png') ? 'png' : 'jpg';
    try { photoBuf = Buffer.from(photo.split(',')[1], 'base64'); } catch(e) {}
  }
  if (logo && /^data:image\/(png|jpe?g);base64,/.test(logo)) {
    logoType = logo.includes('image/png') ? 'png' : 'jpg';
    try { logoBuf = Buffer.from(logo.split(',')[1], 'base64'); } catch(e) {}
  }
  try {
    const lines = content.split('\n');
    const children = [];
    const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'c8d3e8' };
    const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      /* Page break (full-class result cards) */
      if (line.trim() === '[[PAGEBREAK]]') {
        children.push(new Paragraph({ pageBreakBefore: true }));
        i++; continue;
      }
      /* School logo — center top */
      if (line.trim() === '[[LOGO]]') {
        if (logoBuf) children.push(new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [new ImageRun({ data: logoBuf, transformation: { width: 84, height: 84 }, type: logoType })]
        }));
        i++; continue;
      }
      /* Student photo placeholder */
      if (line.trim() === '[[PHOTO]]') {
        if (photoBuf) {
          children.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 120 },
            children: [new ImageRun({ data: photoBuf, transformation: { width: 110, height: 130 }, type: photoType })]
          }));
        } else {
          children.push(new Paragraph({
            alignment: AlignmentType.RIGHT, spacing: { after: 120 },
            children: [new TextRun({ text: '  Affix recent photograph  ', size: 16, font: 'Arial', color: '8898b8', border: { style: BorderStyle.SINGLE, size: 6, color: 'c8d3e8' } })]
          }));
        }
        i++; continue;
      }

      /* Markdown pipe table → real DOCX table */
      if (isTableLine(line)) {
        const tblLines = [];
        while (i < lines.length && isTableLine(lines[i])) { tblLines.push(lines[i]); i++; }
        const dataLines = tblLines.filter(l => !isSeparatorLine(l));
        if (dataLines.length) {
          const rows = dataLines.map((l, ri) => {
            const cells = splitCells(l);
            const isHead = ri === 0 && tblLines.length > 1 && isSeparatorLine(tblLines[1]);
            return new TableRow({
              children: cells.map(c => new TableCell({
                borders,
                shading: isHead ? { type: ShadingType.CLEAR, fill: '1a2744' } : undefined,
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [new Paragraph({
                  bidirectional: isArabicLine(c),
                  alignment: isArabicLine(c) ? AlignmentType.RIGHT : undefined,
                  children: runFromText(c, { size: 20, font: 'Calibri', bold: isHead, color: isHead ? 'FFFFFF' : '1e2d4a' })
                })]
              }))
            });
          });
          children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
          children.push(new Paragraph({ spacing: { after: 100 } }));
        }
        continue;
      }

      if (!line.trim()) { children.push(new Paragraph({ spacing: { after: 60 } })); i++; continue; }
      const isH1 = line.startsWith('# ');
      const isH2 = line.startsWith('## ');
      const isH3 = line.startsWith('### ');
      const isBullet = line.startsWith('- ') || line.startsWith('• ');
      const isBis = line.includes('بِسْمِ');
      const text = line.replace(/^#{1,3} /, '').replace(/^[-•] /, '');

      if (isBis) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: text.replace(/\*\*/g, ''), size: 28, bold: true, color: 'C8960C', font: 'Amiri' })] }));
      } else if (isH1) {
        children.push(new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'C8960C', space: 6 } },
          children: runFromText(text, { size: 34, bold: true, color: '1a2744', font: 'Cambria' })
        }));
      } else if (isH2) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 140 }, children: runFromText(text, { size: 26, bold: true, color: '243257', font: 'Cambria', characterSpacing: 20 }) }));
      } else if (isH3) {
        children.push(new Paragraph({
          spacing: { before: 160, after: 70 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'C8960C', space: 4 } },
          indent: { left: 120 },
          children: runFromText(text, { size: 23, bold: true, color: '1a2744', font: 'Cambria' })
        }));
      } else if (isBullet) {
        const rtlB = isArabicLine(text);
        children.push(new Paragraph({ spacing: { after: 70, line: 300 }, indent: { left: 360 }, bidirectional: rtlB, alignment: rtlB ? AlignmentType.RIGHT : undefined, children: runFromText('• ' + text, { size: 22, font: 'Calibri' }) }));
      } else {
        const rtlP = isArabicLine(text);
        children.push(new Paragraph({ spacing: { after: 70, line: 300 }, bidirectional: rtlP, alignment: rtlP ? AlignmentType.RIGHT : undefined, children: runFromText(text, { size: 22, font: 'Calibri' }) }));
      }
      i++;
    }

    const isAchievement = documentType === 'Prize Certificate';
    const pageProps = { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } };
    if (isAchievement) {
      const goldBorder = { style: BorderStyle.DOUBLE, size: 18, color: 'C8960C', space: 20 };
      pageProps.page.borders = {
        pageBorders: { display: 'allPages', offsetFrom: 'page', zOrder: 'front' },
        pageBorderTop: goldBorder, pageBorderBottom: goldBorder, pageBorderLeft: goldBorder, pageBorderRight: goldBorder
      };
    }
    const doc = new Document({
      sections: [{
        properties: pageProps,
        children
      }]
    });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'document'}.docx"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ─── DOWNLOAD PDF (HTML-based, with table support) ──────────────────────── */
app.post('/download-pdf', async (req, res) => {
  const { content, fileName, photo, logo } = req.body;
  const photoOk = photo && /^data:image\/(png|jpe?g);base64,/.test(photo);
  const logoOk = logo && /^data:image\/(png|jpe?g);base64,/.test(logo);
  try {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    const lines = content.split('\n');
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (isTableLine(line)) {
        const tblLines = [];
        while (i < lines.length && isTableLine(lines[i])) { tblLines.push(lines[i]); i++; }
        const dataLines = tblLines.filter(l => !isSeparatorLine(l));
        const hasHead = tblLines.length > 1 && isSeparatorLine(tblLines[1]);
        html += '<table>';
        dataLines.forEach((l, ri) => {
          const tag = (hasHead && ri === 0) ? 'th' : 'td';
          html += '<tr>' + splitCells(l).map(c => `<${tag}>${inline(c) || '&nbsp;'}</${tag}>`).join('') + '</tr>';
        });
        html += '</table>';
        continue;
      }
      if (line.trim() === '[[PAGEBREAK]]') { html += '<div style="page-break-before:always"></div>'; i++; continue; }
      if (line.trim() === '[[LOGO]]') {
        if (logoOk) html += `<div style="text-align:center;margin-bottom:6px"><img src="${logo}" style="width:74px;height:74px;object-fit:contain"></div>`;
        i++; continue;
      }
      if (line.trim() === '[[PHOTO]]') {
        html += photoOk
          ? `<div style="text-align:right"><img src="${photo}" style="width:110px;height:130px;object-fit:cover;border:1.5px solid #c8d3e8;border-radius:4px"></div>`
          : `<div style="text-align:right"><span style="display:inline-block;width:110px;height:130px;border:1.5px dashed #c8d3e8;border-radius:4px;font-size:8pt;color:#8898b8;text-align:center;line-height:130px">Affix Photo</span></div>`;
        i++; continue;
      }
      if (!line.trim()) { html += '<div class="sp"></div>'; i++; continue; }
      if (line.includes('بِسْمِ')) html += `<div class="bismillah">${esc(line.replace(/\*\*/g, ''))}</div>`;
      else if (line.startsWith('# ')) html += `<h1>${inline(line.slice(2))}</h1>`;
      else if (line.startsWith('## ')) html += `<h2>${inline(line.slice(3))}</h2>`;
      else if (line.startsWith('### ')) html += `<h3>${inline(line.slice(4))}</h3>`;
      else if (line.startsWith('- ') || line.startsWith('• ')) html += `<li${isArabicLine(line) ? ' dir="rtl" class="ur"' : ''}>${inline(line.slice(2))}</li>`;
      else html += `<p${isArabicLine(line) ? ' dir="rtl" class="ur"' : ''}>${inline(line)}</p>`;
      i++;
    }

    const page = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&display=swap');
  body { font-family: Arial, sans-serif; font-size: 11.5pt; margin: 2cm; line-height: 1.7; color: #1e2d4a; }
  h1 { color: #1a2744; font-size: 17pt; text-align: center; border-bottom: 2px solid #c8960c; padding-bottom: 6px; margin: 10px 0; }
  h2 { color: #243257; font-size: 13.5pt; text-align: center; margin: 8px 0; }
  h3 { color: #c8960c; font-size: 12pt; margin: 10px 0 4px; }
  p { margin: 4px 0; }
  .sp { height: 8px; }
  .bismillah { text-align: center; font-size: 16pt; color: #c8960c; font-family: 'Noto Nastaliq Urdu', serif; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  td, th { border: 1px solid #c8d3e8; padding: 6px 10px; font-size: 10.5pt; }
  .ur { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; font-size: 12.5pt; line-height: 2.1; text-align: right; }
  th { background: #1a2744; color: white; }
  li { margin: 4px 0 4px 18px; }
  @media print { body { margin: 1.5cm; } }
</style>
</head>
<body>
${html}
<script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'document'}.html"`);
    res.send(page);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ─── DOWNLOAD EXCEL (Student Database export) ───────────────────────────── */
app.post('/download-excel', async (req, res) => {
  const { students, className, fileName } = req.body;
  try {
    const headers = ['G.R Number','Roll/Seat No','Student Name','Father Name','Class','Date of Birth','Age','Address','Phone'];
    const rows = [headers];
    if (students && students.length > 0) {
      for (const s of students) {
        rows.push([
          s.grNumber || '', s.rollNumber || '', s.name || '', s.fatherName || '',
          s.className || className || '', s.dob || '', s.age || '', s.address || '', s.phone || ''
        ]);
      }
    }
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const BOM = '\uFEFF';
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'students'}.csv"`);
    res.send(BOM + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ─── 404 — koi bhi na-mili route/file yahan aati hai (sab routes/static ke baad) ───────────
   Asal 404 status code deta hai (SEO ke liye zaroori — Google "soft 404" ko pasand nahi karta) */
app.use((req, res) => {
  res.status(404);
  if (req.accepts('html')) return res.sendFile(path.join(__dirname, 'public', '404.html'));
  if (req.accepts('json')) return res.json({ success: false, error: 'Not found' });
  res.type('txt').send('Not found');
});

/* ─── GLOBAL ERROR HANDLER — HTML 500 ki jagah hamesha friendly JSON ─────── */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Unhandled route error:', err.message);
  res.status(err.status || 500).json({ success: false, error: friendlyError(err.message) });
});

/* ─── START SERVER ───────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Teacher Toolkit running on port ${PORT} — Sindh Education Edition`));
