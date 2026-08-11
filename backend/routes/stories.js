const express = require('express');
const { db } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');
const { uploadPostMedia, mediaTypeFor, uploadBufferToStorage, deleteFromStorage } = require('../config/upload');
const { authorFor, chunk } = require('../lib/serialize');

const router = express.Router();

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

function isActive(data) {
  return new Date(data.expires_at).getTime() > Date.now();
}

// Create a story (single image or video, expires in 24h)
router.post('/', requireAuth, uploadPostMedia.single('media'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A photo or video is required.' });

    const url = await uploadBufferToStorage(req.file, 'stories');
    const now = new Date();
    const data = {
      user_id: req.user.id,
      media_url: url,
      media_type: mediaTypeFor(req.file.originalname),
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + STORY_LIFETIME_MS).toISOString(),
    };
    const docRef = await db.collection('stories').add(data);
    const author = await authorFor(req.user.id);
    res.status(201).json({ story: { id: docRef.id, ...data, author, viewers: [] } });
  } catch (err) { next(err); }
});

// Story rail for the home screen: one entry per user (self first, then
// people the viewer follows), each with their active stories and whether
// the viewer has seen all of them yet.
router.get('/feed', requireAuth, async (req, res, next) => {
  try {
    const followSnap = await db.collection('follows')
      .where('follower_id', '==', req.user.id).where('status', '==', 'accepted').get();
    const userIds = [req.user.id, ...followSnap.docs.map((d) => d.data().following_id)];

    const chunks = chunk(userIds, 10);
    const results = await Promise.all(
      chunks.map((c) => db.collection('stories').where('user_id', 'in', c).get())
    );
    const docs = results.flatMap((snap) => snap.docs).filter((d) => isActive(d.data()));

    const byUser = new Map();
    for (const d of docs) {
      const data = d.data();
      if (!byUser.has(data.user_id)) byUser.set(data.user_id, []);
      byUser.get(data.user_id).push({ id: d.id, ...data });
    }
    for (const arr of byUser.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));

    const orderedUserIds = userIds.filter((id) => byUser.has(id));
    const groups = await Promise.all(orderedUserIds.map(async (userId) => {
      const stories = byUser.get(userId);
      const author = await authorFor(userId);
      const allViewed = stories.every((s) => (s.viewers || []).includes(req.user.id));
      return { user: author, stories: stories.map(({ viewers, ...rest }) => ({ ...rest, viewedByViewer: (viewers || []).includes(req.user.id) })), hasUnseen: !allViewed };
    }));

    // Own stories first, then unseen, then seen — mirrors the familiar Instagram ordering.
    groups.sort((a, b) => {
      if (a.user.id === req.user.id) return -1;
      if (b.user.id === req.user.id) return 1;
      return (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0);
    });

    res.json({ groups });
  } catch (err) { next(err); }
});

// A single user's active stories (used when opening the viewer)
router.get('/user/:userId', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('stories').where('user_id', '==', req.params.userId).get();
    const stories = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isActive);
    stories.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const author = await authorFor(req.params.userId);
    res.json({
      author,
      stories: stories.map(({ viewers, ...rest }) => ({ ...rest, viewedByViewer: (viewers || []).includes(req.user.id), viewerCount: (viewers || []).length })),
    });
  } catch (err) { next(err); }
});

router.post('/:id/view', requireAuth, async (req, res, next) => {
  try {
    const ref = db.collection('stories').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Story not found.' });
    const data = doc.data();
    if (!(data.viewers || []).includes(req.user.id)) {
      await ref.update({ viewers: [...(data.viewers || []), req.user.id] });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Who has viewed one of your own stories (shown to the author only)
router.get('/:id/viewers', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('stories').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Story not found.' });
    const data = doc.data();
    if (data.user_id !== req.user.id) return res.status(403).json({ error: 'Only the author can see viewers.' });
    const users = await Promise.all((data.viewers || []).map((id) => authorFor(id)));
    res.json({ users });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('stories').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Story not found.' });
    const data = doc.data();
    if (data.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own stories.' });
    deleteFromStorage(data.media_url); // fire-and-forget
    await doc.ref.delete();
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
