// Shared helpers for turning raw Firestore documents into the shape the
// frontend expects (embedding author info, computed counts, viewer state).
const { db } = require('../config/firebase');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function authorFor(userId) {
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) return { id: userId, username: '[deleted]', full_name: '', avatar_url: '', is_verified: false };
  const d = doc.data();
  return { id: doc.id, username: d.username, full_name: d.full_name, avatar_url: d.avatar_url, is_verified: !!d.is_verified };
}

async function attachPostExtras(id, data, viewerId) {
  const [author, likeCountSnap, commentCountSnap, shareCountSnap, likedDoc, savedDoc] = await Promise.all([
    authorFor(data.user_id),
    db.collection('likes').where('post_id', '==', id).count().get(),
    db.collection('comments').where('post_id', '==', id).count().get(),
    db.collection('shares').where('post_id', '==', id).count().get(),
    viewerId ? db.collection('likes').doc(`${id}_${viewerId}`).get() : Promise.resolve(null),
    viewerId ? db.collection('saved_posts').doc(`${viewerId}_${id}`).get() : Promise.resolve(null),
  ]);
  return {
    id,
    user_id: data.user_id,
    type: data.type,
    caption: data.caption || '',
    category: data.category || 'General',
    status: data.status || 'open',
    location: data.location || '',
    created_at: data.created_at,
    media: data.media || [],
    author,
    likeCount: likeCountSnap.data().count,
    commentCount: commentCountSnap.data().count,
    shareCount: shareCountSnap.data().count,
    likedByViewer: likedDoc ? likedDoc.exists : false,
    savedByViewer: savedDoc ? savedDoc.exists : false,
    // Owner-controlled post settings (see PostCard's "..." menu)
    hide_like_count: !!data.hide_like_count,
    hide_share_count: !!data.hide_share_count,
    comments_disabled: !!data.comments_disabled,
    is_archived: !!data.is_archived,
    is_pinned: !!data.is_pinned,
    allow_reuse: data.allow_reuse !== false,
    cover_index: Number.isInteger(data.cover_index) ? data.cover_index : 0,
  };
}

async function attachCommentExtras(id, data, viewerId) {
  const [author, likeCountSnap, replyCountSnap, likedDoc] = await Promise.all([
    authorFor(data.user_id),
    db.collection('comment_likes').where('comment_id', '==', id).count().get(),
    db.collection('comments').where('parent_id', '==', id).count().get(),
    viewerId ? db.collection('comment_likes').doc(`${id}_${viewerId}`).get() : Promise.resolve(null),
  ]);
  return {
    id,
    post_id: data.post_id,
    user_id: data.user_id,
    parent_id: data.parent_id || null,
    content: data.content,
    created_at: data.created_at,
    author,
    likeCount: likeCountSnap.data().count,
    replyCount: replyCountSnap.data().count,
    likedByViewer: likedDoc ? likedDoc.exists : false,
  };
}

// Fetches posts of a given type authored by any of the given user ids.
// Firestore 'in' filters cap at 30 values, so this chunks and merges.
// Note: this loads all matches into memory before paginating — fine at
// hobby-project scale, but a real-scale version would use cursor-based
// pagination per shard instead.
async function postsByUserIds(userIds, type) {
  if (userIds.length === 0) return [];
  const chunks = chunk(userIds, 10);
  const results = await Promise.all(
    chunks.map((c) => db.collection('posts').where('type', '==', type).where('user_id', 'in', c).get())
  );
  const docs = results.flatMap((snap) => snap.docs);
  docs.sort((a, b) => (b.data().created_at || '').localeCompare(a.data().created_at || ''));
  return docs;
}

module.exports = { authorFor, attachPostExtras, attachCommentExtras, postsByUserIds, chunk };
