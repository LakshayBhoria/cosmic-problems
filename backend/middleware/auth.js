const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const doc = await db.collection('users').doc(payload.id).get();
    if (!doc.exists) return res.status(401).json({ error: 'User no longer exists' });
    const d = doc.data();
    req.user = { id: doc.id, username: d.username, email: d.email, is_private: !!d.is_private };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Attaches req.user if a valid token is present, but does not block the request otherwise
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const doc = await db.collection('users').doc(payload.id).get();
    if (doc.exists) {
      const d = doc.data();
      req.user = { id: doc.id, username: d.username, email: d.email, is_private: !!d.is_private };
    }
  } catch (err) {
    // ignore invalid token for optional auth
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
