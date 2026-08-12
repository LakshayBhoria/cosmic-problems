const express = require('express');
const { db } = require('../config/firebase');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { attachCommentExtras } = require('../lib/serialize');

const router = express.Router();

// Top-level comments for a post (the "discussion")
router.get('/post/:postId', optionalAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('comments')
      .where('post_id', '==', req.params.postId).where('parent_id', '==', null)
      .orderBy('created_at', 'asc').get();
    const comments = await Promise.all(snap.docs.map((d) => attachCommentExtras(d.id, d.data(), req.user && req.user.id)));
    res.json({ comments });
  } catch (err) { next(err); }
});

// Replies to a comment
router.get('/:id/replies', optionalAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('comments').where('parent_id', '==', req.params.id).orderBy('created_at', 'asc').get();
    const comments = await Promise.all(snap.docs.map((d) => attachCommentExtras(d.id, d.data(), req.user && req.user.id)));
    res.json({ comments });
  } catch (err) { next(err); }
});

router.post('/post/:postId', requireAuth, async (req, res, next) => {
  try {
    const { content, parent_id } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });
    const postDoc = await db.collection('posts').doc(req.params.postId).get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found.' });
    if (postDoc.data().comments_disabled) return res.status(403).json({ error: 'Commenting is turned off for this post.' });

    const now = new Date().toISOString();
    const data = { post_id: req.params.postId, user_id: req.user.id, parent_id: parent_id || null, content: content.trim(), created_at: now };
    const docRef = await db.collection('comments').add(data);

    const postData = postDoc.data();
    if (postData.user_id !== req.user.id) {
      await db.collection('notifications').add({
        user_id: postData.user_id, actor_id: req.user.id, type: 'comment',
        post_id: req.params.postId, comment_id: docRef.id, is_read: false, created_at: now,
      });
    }

    const comment = await attachCommentExtras(docRef.id, data, req.user.id);
    res.status(201).json({ comment });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('comments').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Comment not found.' });
    const data = doc.data();
    const postDoc = await db.collection('posts').doc(data.post_id).get();
    const postOwnerId = postDoc.exists ? postDoc.data().user_id : null;
    if (data.user_id !== req.user.id && postOwnerId !== req.user.id) {
      return res.status(403).json({ error: 'You cannot delete this comment.' });
    }
    await doc.ref.delete();
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const likeRef = db.collection('comment_likes').doc(`${req.params.id}_${req.user.id}`);
    const existing = await likeRef.get();
    if (!existing.exists) {
      await likeRef.set({ user_id: req.user.id, comment_id: req.params.id, created_at: new Date().toISOString() });
    }
    const countSnap = await db.collection('comment_likes').where('comment_id', '==', req.params.id).count().get();
    res.json({ likeCount: countSnap.data().count, liked: true });
  } catch (err) { next(err); }
});

router.delete('/:id/like', requireAuth, async (req, res, next) => {
  try {
    await db.collection('comment_likes').doc(`${req.params.id}_${req.user.id}`).delete();
    const countSnap = await db.collection('comment_likes').where('comment_id', '==', req.params.id).count().get();
    res.json({ likeCount: countSnap.data().count, liked: false });
  } catch (err) { next(err); }
});

module.exports = router;
