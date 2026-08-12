const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  if (!u) return null;
  const { password_hash, email_notifications, push_notifications, ...rest } = u;
  return rest;
}

function makeToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
}

const USERNAME_RE = /^[a-zA-Z0-9._]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Bootstrap mechanism for the very first admin(s): list trusted emails in
// ADMIN_EMAILS (comma-separated) and they're auto-promoted to admin on
// register/login. Manage further admins from the admin panel afterwards.
function isBootstrapAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required.' });
    }
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-30 characters: letters, numbers, dots or underscores.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const [byUsername, byEmail] = await Promise.all([
      db.collection('users').where('username', '==', username).limit(1).get(),
      db.collection('users').where('email', '==', email).limit(1).get(),
    ]);
    if (!byUsername.empty || !byEmail.empty) {
      return res.status(409).json({ error: 'Username or email is already taken.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    const data = {
      username, email, password_hash: hash,
      username_lower: username.toLowerCase(),
      full_name: full_name || username,
      full_name_lower: (full_name || username).toLowerCase(),
      bio: '', field_of_interest: '', website: '', avatar_url: '',
      is_private: false, is_verified: false, is_admin: isBootstrapAdminEmail(email),
      email_notifications: true, push_notifications: true, theme: 'dark',
      created_at: now,
    };
    const docRef = await db.collection('users').add(data);
    const user = { id: docRef.id, ...data };
    const token = makeToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body; // identifier = username or email
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    let snap = await db.collection('users').where('username', '==', identifier).limit(1).get();
    if (snap.empty) {
      snap = await db.collection('users').where('email', '==', identifier).limit(1).get();
    }
    if (snap.empty) {
      return res.status(401).json({ error: 'Incorrect username/email or password.' });
    }

    const doc = snap.docs[0];
    const user = { id: doc.id, ...doc.data() };
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect username/email or password.' });
    }
    // Re-check bootstrap admin status on every login in case ADMIN_EMAILS changed after signup.
    if (isBootstrapAdminEmail(user.email) && !user.is_admin) {
      await db.collection('users').doc(user.id).update({ is_admin: true });
      user.is_admin = true;
    }
    const token = makeToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('users').doc(req.user.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: publicUser({ id: doc.id, ...doc.data() }) });
  } catch (err) { next(err); }
});

module.exports = router;
