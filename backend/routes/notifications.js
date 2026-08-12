const express = require('express');
const { db } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('notifications')
      .where('user_id', '==', req.user.id).orderBy('created_at', 'desc').limit(50).get();
    const notifications = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const actorDoc = await db.collection('users').doc(data.actor_id).get();
      const actor = actorDoc.exists ? actorDoc.data() : { username: '[deleted]', avatar_url: '' };
      return { id: d.id, ...data, actor_username: actor.username, actor_avatar: actor.avatar_url };
    }));
    res.json({ notifications });
  } catch (err) { next(err); }
});

router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('notifications')
      .where('user_id', '==', req.user.id).where('is_read', '==', false).count().get();
    res.json({ count: snap.data().count });
  } catch (err) { next(err); }
});

router.put('/read-all', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('notifications')
      .where('user_id', '==', req.user.id).where('is_read', '==', false).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { is_read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('notifications').doc(req.params.id).get();
    if (doc.exists && doc.data().user_id === req.user.id) {
      await doc.ref.update({ is_read: true });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
