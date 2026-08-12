const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/firebase');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadAvatar, uploadBufferToStorage, deleteFromStorage } = require('../config/upload');

const router = express.Router();

async function publicProfile(u, viewerId) {
  if (!u) return null;
  const [followerCountSnap, followingCountSnap, postCountSnap, reelCountSnap] = await Promise.all([
    db.collection('follows').where('following_id', '==', u.id).where('status', '==', 'accepted').count().get(),
    db.collection('follows').where('follower_id', '==', u.id).where('status', '==', 'accepted').count().get(),
    db.collection('posts').where('user_id', '==', u.id).where('type', '==', 'post').count().get(),
    db.collection('posts').where('user_id', '==', u.id).where('type', '==', 'reel').count().get(),
  ]);

  let isFollowing = false;
  let followStatus = null;
  if (viewerId) {
    const f = await db.collection('follows').doc(`${viewerId}_${u.id}`).get();
    if (f.exists) { followStatus = f.data().status; isFollowing = followStatus === 'accepted'; }
  }

  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    bio: u.bio,
    field_of_interest: u.field_of_interest,
    website: u.website,
    avatar_url: u.avatar_url,
    is_private: !!u.is_private,
    is_verified: !!u.is_verified,
    created_at: u.created_at,
    followerCount: followerCountSnap.data().count,
    followingCount: followingCountSnap.data().count,
    postCount: postCountSnap.data().count,
    reelCount: reelCountSnap.data().count,
    isFollowing, followStatus,
    isSelf: viewerId === u.id
  };
}

// Search users by username OR full name. Firestore has no substring search,
// so this matches on a prefix (the standard Firestore "range query" trick)
// rather than SQL's substring LIKE. It queries lowercased shadow fields
// (username_lower / full_name_lower, kept in sync on register/profile edits)
// so a search for "john" also finds "John Doe" or "JohnD" -- plus the raw
// fields too, so accounts created before those shadow fields existed are
// still searchable by exact-case prefix. For real full-text search, pair
// this with Algolia/Typesense later.
router.get('/search', optionalAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });
    const end = q + '\uf8ff';
    const qLower = q.toLowerCase();
    const endLower = qLower + '\uf8ff';

    const [byUsername, byName, byUsernameLower, byNameLower] = await Promise.all([
      db.collection('users').orderBy('username').startAt(q).endAt(end).limit(20).get(),
      db.collection('users').orderBy('full_name').startAt(q).endAt(end).limit(20).get(),
      db.collection('users').orderBy('username_lower').startAt(qLower).endAt(endLower).limit(20).get(),
      db.collection('users').orderBy('full_name_lower').startAt(qLower).endAt(endLower).limit(20).get(),
    ]);

    const seen = new Map();
    [...byUsername.docs, ...byName.docs, ...byUsernameLower.docs, ...byNameLower.docs].forEach((d) => {
      if (!seen.has(d.id)) {
        const data = d.data();
        seen.set(d.id, { id: d.id, username: data.username, full_name: data.full_name, avatar_url: data.avatar_url, is_verified: !!data.is_verified });
      }
    });
    res.json({ users: Array.from(seen.values()).slice(0, 20) });
  } catch (err) { next(err); }
});

router.get('/:username', optionalAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('users').where('username', '==', req.params.username).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'User not found.' });
    const doc = snap.docs[0];
    const profile = await publicProfile({ id: doc.id, ...doc.data() }, req.user && req.user.id);
    res.json({ user: profile });
  } catch (err) { next(err); }
});

router.put('/me/profile', requireAuth, async (req, res, next) => {
  try {
    const { full_name, bio, field_of_interest, website, is_private } = req.body;
    await db.collection('users').doc(req.user.id).update({
      full_name: full_name ?? '', full_name_lower: (full_name ?? '').toLowerCase(),
      bio: bio ?? '', field_of_interest: field_of_interest ?? '',
      website: website ?? '', is_private: !!is_private,
    });
    const doc = await db.collection('users').doc(req.user.id).get();
    const profile = await publicProfile({ id: doc.id, ...doc.data() }, req.user.id);
    res.json({ user: profile });
  } catch (err) { next(err); }
});

router.put('/me/avatar', requireAuth, uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const url = await uploadBufferToStorage(req.file, 'avatars');
    const doc = await db.collection('users').doc(req.user.id).get();
    const oldUrl = doc.exists ? doc.data().avatar_url : null;
    await db.collection('users').doc(req.user.id).update({ avatar_url: url });
    if (oldUrl) deleteFromStorage(oldUrl); // fire-and-forget
    res.json({ avatar_url: url });
  } catch (err) { next(err); }
});

router.put('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const doc = await db.collection('users').doc(req.user.id).get();
    if (!bcrypt.compareSync(current_password, doc.data().password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    await db.collection('users').doc(req.user.id).update({ password_hash: hash });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/me/settings', requireAuth, async (req, res, next) => {
  try {
    const { email_notifications, push_notifications, theme } = req.body;
    const patch = {};
    if (email_notifications !== undefined) patch.email_notifications = !!email_notifications;
    if (push_notifications !== undefined) patch.push_notifications = !!push_notifications;
    if (theme) patch.theme = theme;
    await db.collection('users').doc(req.user.id).update(patch);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Best-effort account deletion. Firestore has no cascading deletes like SQL's
// ON DELETE CASCADE, so this removes the user's own record and posts; likes,
// comments, and follow edges referencing them are left orphaned (they resolve
// to a "[deleted]" author — see lib/serialize.js). For a production app,
// move this to a Cloud Function that cascades fully in the background.
router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    const postsSnap = await db.collection('posts').where('user_id', '==', req.user.id).get();
    const batch = db.batch();
    postsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection('users').doc(req.user.id));
    await batch.commit();
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/follow', requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself.' });
    const targetDoc = await db.collection('users').doc(targetId).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found.' });

    const followId = `${req.user.id}_${targetId}`;
    const existing = await db.collection('follows').doc(followId).get();
    if (existing.exists) return res.json({ status: existing.data().status });

    const status = targetDoc.data().is_private ? 'pending' : 'accepted';
    const now = new Date().toISOString();
    await db.collection('follows').doc(followId).set({ follower_id: req.user.id, following_id: targetId, status, created_at: now });
    await db.collection('notifications').add({
      user_id: targetId, actor_id: req.user.id,
      type: status === 'accepted' ? 'follow' : 'follow_request',
      post_id: null, comment_id: null, is_read: false, created_at: now,
    });
    res.json({ status });
  } catch (err) { next(err); }
});

router.delete('/:id/follow', requireAuth, async (req, res, next) => {
  try {
    await db.collection('follows').doc(`${req.user.id}_${req.params.id}`).delete();
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/accept-follow', requireAuth, async (req, res, next) => {
  try {
    await db.collection('follows').doc(`${req.params.id}_${req.user.id}`).update({ status: 'accepted' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Shared guard: private accounts only show their followers/following to
// themselves or to accounts they've accepted a follow from -- otherwise this
// list is public, same rule as the posts grid on the profile page.
async function canViewConnections(targetId, viewerId) {
  const targetDoc = await db.collection('users').doc(targetId).get();
  if (!targetDoc.exists) return { ok: false, status: 404 };
  const target = targetDoc.data();
  if (!target.is_private) return { ok: true };
  if (viewerId === targetId) return { ok: true };
  if (viewerId) {
    const f = await db.collection('follows').doc(`${viewerId}_${targetId}`).get();
    if (f.exists && f.data().status === 'accepted') return { ok: true };
  }
  return { ok: false, status: 403 };
}

router.get('/:id/followers', optionalAuth, async (req, res, next) => {
  try {
    const gate = await canViewConnections(req.params.id, req.user && req.user.id);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.status === 404 ? 'User not found.' : 'This account is private.' });

    // Filter by following_id + status only, then sort in JS -- chaining a
    // third orderBy('created_at') onto two where() clauses needs a composite
    // index that may not exist, which silently breaks this list rather than
    // erroring visibly.
    const snap = await db.collection('follows')
      .where('following_id', '==', req.params.id).where('status', '==', 'accepted').get();
    const docs = snap.docs.sort((a, b) => (b.data().created_at || '').localeCompare(a.data().created_at || ''));
    const users = await Promise.all(docs.map(async (d) => {
      const u = await db.collection('users').doc(d.data().follower_id).get();
      if (!u.exists) return null;
      const ud = u.data();
      return { id: u.id, username: ud.username, full_name: ud.full_name, avatar_url: ud.avatar_url, is_verified: !!ud.is_verified };
    }));
    res.json({ users: users.filter(Boolean) });
  } catch (err) { next(err); }
});

router.get('/:id/following', optionalAuth, async (req, res, next) => {
  try {
    const gate = await canViewConnections(req.params.id, req.user && req.user.id);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.status === 404 ? 'User not found.' : 'This account is private.' });

    const snap = await db.collection('follows')
      .where('follower_id', '==', req.params.id).where('status', '==', 'accepted').get();
    const docs = snap.docs.sort((a, b) => (b.data().created_at || '').localeCompare(a.data().created_at || ''));
    const users = await Promise.all(docs.map(async (d) => {
      const u = await db.collection('users').doc(d.data().following_id).get();
      if (!u.exists) return null;
      const ud = u.data();
      return { id: u.id, username: ud.username, full_name: ud.full_name, avatar_url: ud.avatar_url, is_verified: !!ud.is_verified };
    }));
    res.json({ users: users.filter(Boolean) });
  } catch (err) { next(err); }
});

router.post('/:id/block', requireAuth, async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const now = new Date().toISOString();
    await db.collection('blocks').doc(`${req.user.id}_${targetId}`).set({ blocker_id: req.user.id, blocked_id: targetId, created_at: now });
    const batch = db.batch();
    batch.delete(db.collection('follows').doc(`${req.user.id}_${targetId}`));
    batch.delete(db.collection('follows').doc(`${targetId}_${req.user.id}`));
    await batch.commit();
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id/block', requireAuth, async (req, res, next) => {
  try {
    await db.collection('blocks').doc(`${req.user.id}_${req.params.id}`).delete();
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/me/blocked', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('blocks').where('blocker_id', '==', req.user.id).get();
    const users = await Promise.all(snap.docs.map(async (d) => {
      const u = await db.collection('users').doc(d.data().blocked_id).get();
      if (!u.exists) return null;
      const ud = u.data();
      return { id: u.id, username: ud.username, full_name: ud.full_name, avatar_url: ud.avatar_url };
    }));
    res.json({ users: users.filter(Boolean) });
  } catch (err) { next(err); }
});

module.exports = router;
