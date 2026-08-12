const express = require('express');
const { db } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CATEGORIES = ['scientist', 'educator', 'organization', 'public_figure', 'other'];

// The current user's own request (if any) — used to show status in Settings.
router.get('/me/verification-request', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('verification_requests')
      .where('user_id', '==', req.user.id).orderBy('created_at', 'desc').limit(1).get();
    if (snap.empty) return res.json({ request: null });
    const d = snap.docs[0];
    res.json({ request: { id: d.id, ...d.data() } });
  } catch (err) { next(err); }
});

router.post('/me/verification-request', requireAuth, async (req, res, next) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();
    if (userDoc.data().is_verified) return res.status(400).json({ error: 'You are already verified.' });

    const existing = await db.collection('verification_requests')
      .where('user_id', '==', req.user.id).where('status', '==', 'pending').limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'You already have a pending request.' });

    const { category, reason, links } = req.body;
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose a valid category.' });
    if (!reason || reason.trim().length < 20) return res.status(400).json({ error: 'Explain your request in at least 20 characters.' });

    const now = new Date().toISOString();
    const data = {
      user_id: req.user.id,
      category,
      reason: reason.trim().slice(0, 1000),
      links: (links || '').trim().slice(0, 500),
      status: 'pending',
      review_note: null,
      created_at: now,
      reviewed_at: null,
      reviewed_by: null,
    };
    const ref = await db.collection('verification_requests').add(data);
    res.status(201).json({ request: { id: ref.id, ...data } });
  } catch (err) { next(err); }
});

module.exports = router;
