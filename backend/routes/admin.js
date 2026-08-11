const express = require('express');
const { db } = require('../config/firebase');

const router = express.Router();

// Mounted at /api/admin behind requireAuth + requireAdmin in server.js —
// every handler below can assume req.user.is_admin === true.

router.get('/verification-requests', async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const snap = await db.collection('verification_requests')
      .where('status', '==', status).orderBy('created_at', 'desc').limit(100).get();
    const requests = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const u = await db.collection('users').doc(data.user_id).get();
      const ud = u.exists ? u.data() : { username: '[deleted]' };
      return {
        id: d.id, ...data,
        applicant: { id: data.user_id, username: ud.username, full_name: ud.full_name, avatar_url: ud.avatar_url, bio: ud.bio },
      };
    }));
    res.json({ requests });
  } catch (err) { next(err); }
});

router.post('/verification-requests/:id/approve', async (req, res, next) => {
  try {
    const ref = db.collection('verification_requests').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Request not found.' });
    const now = new Date().toISOString();
    await Promise.all([
      ref.update({ status: 'approved', reviewed_at: now, reviewed_by: req.user.id, review_note: null }),
      db.collection('users').doc(doc.data().user_id).update({ is_verified: true }),
      db.collection('notifications').add({
        user_id: doc.data().user_id, actor_id: req.user.id, type: 'verification_approved',
        post_id: null, comment_id: null, is_read: false, created_at: now,
      }),
    ]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/verification-requests/:id/reject', async (req, res, next) => {
  try {
    const ref = db.collection('verification_requests').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Request not found.' });
    const now = new Date().toISOString();
    const note = (req.body.note || '').trim().slice(0, 500);
    await Promise.all([
      ref.update({ status: 'rejected', reviewed_at: now, reviewed_by: req.user.id, review_note: note || null }),
      db.collection('notifications').add({
        user_id: doc.data().user_id, actor_id: req.user.id, type: 'verification_rejected',
        post_id: null, comment_id: null, is_read: false, created_at: now,
      }),
    ]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Revoke a badge directly (e.g. impersonation report), independent of the request flow.
router.delete('/verified/:userId', async (req, res, next) => {
  try {
    await db.collection('users').doc(req.params.userId).update({ is_verified: false });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/admins', async (req, res, next) => {
  try {
    const snap = await db.collection('users').where('is_admin', '==', true).get();
    res.json({ admins: snap.docs.map((d) => ({ id: d.id, username: d.data().username, full_name: d.data().full_name })) });
  } catch (err) { next(err); }
});

router.post('/admins/:userId', async (req, res, next) => {
  try {
    await db.collection('users').doc(req.params.userId).update({ is_admin: true });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/admins/:userId', async (req, res, next) => {
  try {
    if (req.params.userId === req.user.id) return res.status(400).json({ error: 'You cannot remove your own admin access.' });
    await db.collection('users').doc(req.params.userId).update({ is_admin: false });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
