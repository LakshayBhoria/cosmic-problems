const express = require('express');
const { db } = require('../config/firebase');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadPostMedia, mediaTypeFor, uploadBufferToStorage, deleteFromStorage } = require('../config/upload');
const { attachPostExtras, postsByUserIds } = require('../lib/serialize');

const router = express.Router();

// Create a post (type=post) with 1+ images/videos
router.post('/', requireAuth, uploadPostMedia.array('media', 10), async (req, res, next) => {
  try {
    const { caption, category, location } = req.body;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image or video is required.' });
    }
    const urls = await Promise.all(req.files.map((f) => uploadBufferToStorage(f, 'posts')));
    const media = req.files.map((f, i) => ({ media_url: urls[i], media_type: mediaTypeFor(f.originalname), position: i }));

    const data = {
      user_id: req.user.id, type: 'post',
      caption: caption || '', category: category || 'General', status: 'open',
      location: location || '', media, created_at: new Date().toISOString(),
    };
    const docRef = await db.collection('posts').add(data);
    const post = await attachPostExtras(docRef.id, data, req.user.id);
    res.status(201).json({ post });
  } catch (err) { next(err); }
});

// Home feed: posts from people the viewer follows (+ own), else discovery if not following anyone
router.get('/feed', requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '0', 10);
    const limit = 10;

    const followSnap = await db.collection('follows')
      .where('follower_id', '==', req.user.id).where('status', '==', 'accepted').get();
    const followingIds = followSnap.docs.map((d) => d.data().following_id);
    followingIds.push(req.user.id);

    let docs = await postsByUserIds(followingIds, 'post');

    if (docs.length === 0 && page === 0) {
      // Nothing to show yet (new account) -> fall back to trending/discovery
      const snap = await db.collection('posts').where('type', '==', 'post').orderBy('created_at', 'desc').limit(50).get();
      docs = snap.docs;
    }

    // Archived posts stay visible to their own author, but disappear from
    // everyone else's feed - matches the "Archive" menu option.
    docs = docs.filter((d) => !d.data().is_archived || d.data().user_id === req.user.id);

    const pageDocs = docs.slice(page * limit, page * limit + limit);
    const posts = await Promise.all(pageDocs.map((d) => attachPostExtras(d.id, d.data(), req.user.id)));
    res.json({ posts });
  } catch (err) { next(err); }
});

// Explore: trending posts, optionally filtered by category
router.get('/explore', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '0', 10);
    const limit = 21;
    const { category } = req.query;

    let q = db.collection('posts').where('type', '==', 'post');
    if (category && category !== 'All') q = q.where('category', '==', category);
    q = q.orderBy('created_at', 'desc').limit(limit).offset(page * limit);

    const snap = await q.get();
    const viewerId = req.user && req.user.id;
    const visibleDocs = snap.docs.filter((d) => !d.data().is_archived || d.data().user_id === viewerId);
    const posts = await Promise.all(visibleDocs.map((d) => attachPostExtras(d.id, d.data(), viewerId)));
    res.json({ posts });
  } catch (err) { next(err); }
});

router.get('/categories', (req, res) => {
  res.json({
    categories: [
      'General', 'Astrophysics', 'Cosmology', 'Quantum Physics', 'Mathematics',
      'Chemistry', 'Biology', 'Space Exploration', 'Engineering', 'Earth Science',
      'Computer Science', 'Philosophy of Science'
    ]
  });
});

router.get('/saved', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('saved_posts').where('user_id', '==', req.user.id).orderBy('created_at', 'desc').get();
    const posts = await Promise.all(snap.docs.map(async (d) => {
      const postId = d.data().post_id;
      const postDoc = await db.collection('posts').doc(postId).get();
      if (!postDoc.exists) return null;
      return attachPostExtras(postDoc.id, postDoc.data(), req.user.id);
    }));
    res.json({ posts: posts.filter(Boolean) });
  } catch (err) { next(err); }
});

router.get('/user/:userId', optionalAuth, async (req, res, next) => {
  try {
    const type = req.query.type === 'reel' ? 'reel' : 'post';
    // Filter by user_id only, then filter type + sort in JS (like postsByUserIds
    // does) instead of chaining a second where() + orderBy() in the query --
    // that combination needs a manual composite Firestore index that isn't
    // guaranteed to exist, and a missing index makes the query fail silently
    // from the frontend's point of view (profile shows the post count from a
    // count() aggregate, which doesn't need that index, while the actual post
    // list request errors out and is swallowed).
    const snap = await db.collection('posts').where('user_id', '==', req.params.userId).get();
    const viewerId = req.user && req.user.id;
    const isOwner = viewerId === req.params.userId;
    const docs = snap.docs
      .filter((d) => d.data().type === type)
      .filter((d) => !d.data().is_archived || isOwner) // archived posts only show on the owner's own grid
      .sort((a, b) => {
        // Pinned posts (up to 3) float to the top of the grid, most recent first within each group.
        const pinDiff = (b.data().is_pinned ? 1 : 0) - (a.data().is_pinned ? 1 : 0);
        if (pinDiff !== 0) return pinDiff;
        return (b.data().created_at || '').localeCompare(a.data().created_at || '');
      });
    const posts = await Promise.all(docs.map((d) => attachPostExtras(d.id, d.data(), viewerId)));
    res.json({ posts });
  } catch (err) { next(err); }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found.' });
    const post = await attachPostExtras(doc.id, doc.data(), req.user && req.user.id);
    res.json({ post });
  } catch (err) { next(err); }
});

// Edit caption/category/location - owner only (media itself can't be swapped after upload)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found.' });
    if (doc.data().user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own posts.' });

    const { caption, category, location } = req.body;
    const update = {};
    if (caption !== undefined) update.caption = String(caption).slice(0, 2200);
    if (category !== undefined) update.category = String(category);
    if (location !== undefined) update.location = String(location).slice(0, 100);

    await doc.ref.update(update);
    const post = await attachPostExtras(doc.id, { ...doc.data(), ...update }, req.user.id);
    res.json({ post });
  } catch (err) { next(err); }
});

// Toggle owner-only post settings: archive, pin, hide like/share count,
// turn off commenting, allow reuse, and which media item is the grid cover.
router.patch('/:id/settings', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found.' });
    const data = doc.data();
    if (data.user_id !== req.user.id) return res.status(403).json({ error: 'You can only change settings on your own posts.' });

    const update = {};
    ['hide_like_count', 'hide_share_count', 'comments_disabled', 'is_archived', 'allow_reuse'].forEach((f) => {
      if (typeof req.body[f] === 'boolean') update[f] = req.body[f];
    });

    if (typeof req.body.is_pinned === 'boolean') {
      if (req.body.is_pinned && !data.is_pinned) {
        const pinnedSnap = await db.collection('posts')
          .where('user_id', '==', req.user.id).where('type', '==', data.type).where('is_pinned', '==', true).get();
        if (pinnedSnap.size >= 3) return res.status(400).json({ error: 'You can only pin up to 3 posts to your grid.' });
      }
      update.is_pinned = req.body.is_pinned;
    }

    if (Number.isInteger(req.body.cover_index)) {
      const mediaLen = (data.media || []).length;
      if (req.body.cover_index >= 0 && req.body.cover_index < mediaLen) update.cover_index = req.body.cover_index;
    }

    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No valid settings provided.' });
    await doc.ref.update(update);
    const post = await attachPostExtras(doc.id, { ...data, ...update }, req.user.id);
    res.json({ post });
  } catch (err) { next(err); }
});

// Fire-and-forget share tracking, called from the "Send"/share action.
router.post('/:id/share', requireAuth, async (req, res, next) => {
  try {
    const postDoc = await db.collection('posts').doc(req.params.id).get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found.' });
    await db.collection('shares').add({ post_id: req.params.id, user_id: req.user.id, created_at: new Date().toISOString() });
    const countSnap = await db.collection('shares').where('post_id', '==', req.params.id).count().get();
    res.json({ shareCount: countSnap.data().count });
  } catch (err) { next(err); }
});

// Owner-only engagement breakdown for the "View insights" menu option.
router.get('/:id/insights', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found.' });
    if (doc.data().user_id !== req.user.id) return res.status(403).json({ error: 'Only the author can view insights.' });
    const [likeSnap, commentSnap, shareSnap, saveSnap] = await Promise.all([
      db.collection('likes').where('post_id', '==', req.params.id).count().get(),
      db.collection('comments').where('post_id', '==', req.params.id).count().get(),
      db.collection('shares').where('post_id', '==', req.params.id).count().get(),
      db.collection('saved_posts').where('post_id', '==', req.params.id).count().get(),
    ]);
    res.json({
      insights: {
        likes: likeSnap.data().count,
        comments: commentSnap.data().count,
        shares: shareSnap.data().count,
        saves: saveSnap.data().count,
      },
    });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found.' });
    const data = doc.data();
    if (data.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts.' });
    (data.media || []).forEach((m) => deleteFromStorage(m.media_url)); // fire-and-forget
    await doc.ref.delete();
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/:id/status', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found.' });
    if (doc.data().user_id !== req.user.id) return res.status(403).json({ error: 'Only the author can update the status.' });
    const { status } = req.body;
    if (!['open', 'discussing', 'solved'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    await doc.ref.update({ status });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    const postDoc = await db.collection('posts').doc(req.params.id).get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found.' });

    const likeRef = db.collection('likes').doc(`${req.params.id}_${req.user.id}`);
    const likeDoc = await likeRef.get();
    if (!likeDoc.exists) {
      const now = new Date().toISOString();
      await likeRef.set({ user_id: req.user.id, post_id: req.params.id, created_at: now });
      const postData = postDoc.data();
      if (postData.user_id !== req.user.id) {
        await db.collection('notifications').add({
          user_id: postData.user_id, actor_id: req.user.id, type: 'like',
          post_id: req.params.id, comment_id: null, is_read: false, created_at: now,
        });
      }
    }
    const countSnap = await db.collection('likes').where('post_id', '==', req.params.id).count().get();
    res.json({ likeCount: countSnap.data().count, liked: true });
  } catch (err) { next(err); }
});

router.delete('/:id/like', requireAuth, async (req, res, next) => {
  try {
    await db.collection('likes').doc(`${req.params.id}_${req.user.id}`).delete();
    const countSnap = await db.collection('likes').where('post_id', '==', req.params.id).count().get();
    res.json({ likeCount: countSnap.data().count, liked: false });
  } catch (err) { next(err); }
});

router.get('/:id/likes', async (req, res, next) => {
  try {
    const snap = await db.collection('likes').where('post_id', '==', req.params.id).orderBy('created_at', 'desc').get();
    const users = await Promise.all(snap.docs.map(async (d) => {
      const u = await db.collection('users').doc(d.data().user_id).get();
      if (!u.exists) return null;
      const ud = u.data();
      return { id: u.id, username: ud.username, full_name: ud.full_name, avatar_url: ud.avatar_url };
    }));
    res.json({ users: users.filter(Boolean) });
  } catch (err) { next(err); }
});

router.post('/:id/save', requireAuth, async (req, res, next) => {
  try {
    await db.collection('saved_posts').doc(`${req.user.id}_${req.params.id}`).set({
      user_id: req.user.id, post_id: req.params.id, created_at: new Date().toISOString(),
    });
    res.json({ saved: true });
  } catch (err) { next(err); }
});

router.delete('/:id/save', requireAuth, async (req, res, next) => {
  try {
    await db.collection('saved_posts').doc(`${req.user.id}_${req.params.id}`).delete();
    res.json({ saved: false });
  } catch (err) { next(err); }
});

module.exports = router;
