const express = require('express');
const { db, admin } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');
const { authorFor } = require('../lib/serialize');

const router = express.Router();

const MESSAGE_PAGE_SIZE = 30;

// ---- helpers ----------------------------------------------------------

async function isMutualFollow(aId, bId) {
  const [ab, ba] = await Promise.all([
    db.collection('follows').doc(`${aId}_${bId}`).get(),
    db.collection('follows').doc(`${bId}_${aId}`).get(),
  ]);
  return ab.exists && ab.data().status === 'accepted' && ba.exists && ba.data().status === 'accepted';
}

function directConvoId(aId, bId) {
  // Deterministic id so get-or-create is a single doc read, regardless of who dials first.
  return ['dm', ...[aId, bId].sort()].join('_');
}

async function loadConversation(id) {
  const doc = await db.collection('conversations').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

function assertParticipant(conv, userId) {
  if (!conv.participant_ids.includes(userId)) {
    const err = new Error('Not a participant in this conversation.');
    err.status = 403;
    throw err;
  }
}

async function serializeConversation(conv, viewerId) {
  const isRestrictedByViewer = (conv.restricted_by || []).includes(viewerId);
  const lastRead = (conv.last_read && conv.last_read[viewerId]) || null;
  const hasUnread = !isRestrictedByViewer
    && !!conv.last_message_at
    && (!lastRead || lastRead < conv.last_message_at)
    && conv.last_message
    && conv.last_message.sender_id !== viewerId;

  const base = {
    id: conv.id,
    is_group: !!conv.is_group,
    status: conv.status,
    initiator_id: conv.initiator_id,
    created_at: conv.created_at,
    last_message: conv.last_message || null,
    last_message_at: conv.last_message_at || null,
    unread: hasUnread,
    admin_ids: conv.admin_ids || [],
    isSelfAdmin: (conv.admin_ids || []).includes(viewerId),
    is_restricted: isRestrictedByViewer,
  };

  if (conv.is_group) {
    return { ...base, name: conv.name || 'Group chat', avatar_url: conv.avatar_url || null, participant_ids: conv.participant_ids };
  }

  const otherId = conv.participant_ids.find((id) => id !== viewerId);
  const other = otherId ? await authorFor(otherId) : null;
  return { ...base, other_user: other };
}

// ---- conversations list -------------------------------------------------

// Accepted conversations only (the primary inbox).
router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('conversations')
      .where('participant_ids', 'array-contains', req.user.id)
      .where('status', '==', 'accepted')
      .orderBy('last_message_at', 'desc')
      .limit(100)
      .get();
    const conversations = await Promise.all(snap.docs.map((d) => serializeConversation({ id: d.id, ...d.data() }, req.user.id)));
    res.json({ conversations });
  } catch (err) { next(err); }
});

// Pending message requests sent TO the current user (not by them).
router.get('/conversations/requests', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('conversations')
      .where('participant_ids', 'array-contains', req.user.id)
      .where('status', '==', 'pending')
      .orderBy('last_message_at', 'desc')
      .limit(100)
      .get();
    const all = await Promise.all(snap.docs.map((d) => serializeConversation({ id: d.id, ...d.data() }, req.user.id)));
    // Only show requests the viewer *received* — ones they sent stay out of their own request inbox.
    const incoming = all.filter((c) => c.initiator_id !== req.user.id);
    res.json({ conversations: incoming });
  } catch (err) { next(err); }
});

router.get('/conversations/unread-count', requireAuth, async (req, res, next) => {
  try {
    const snap = await db.collection('conversations')
      .where('participant_ids', 'array-contains', req.user.id)
      .where('status', '==', 'accepted')
      .get();
    let count = 0;
    snap.docs.forEach((d) => {
      const c = d.data();
      if ((c.restricted_by || []).includes(req.user.id)) return; // restricted convos don't badge
      const lastRead = (c.last_read && c.last_read[req.user.id]) || null;
      if (c.last_message_at && (!lastRead || lastRead < c.last_message_at) && c.last_message && c.last_message.sender_id !== req.user.id) {
        count += 1;
      }
    });
    const reqSnap = await db.collection('conversations')
      .where('participant_ids', 'array-contains', req.user.id)
      .where('status', '==', 'pending')
      .get();
    const requestCount = reqSnap.docs.filter((d) => d.data().initiator_id !== req.user.id).length;
    res.json({ count, requestCount });
  } catch (err) { next(err); }
});

// Get-or-create a direct conversation with another user.
router.post('/conversations', requireAuth, async (req, res, next) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required.' });
    if (user_id === req.user.id) return res.status(400).json({ error: 'You cannot message yourself.' });

    const blockedEitherWay = await Promise.all([
      db.collection('blocks').doc(`${req.user.id}_${user_id}`).get(),
      db.collection('blocks').doc(`${user_id}_${req.user.id}`).get(),
    ]);
    if (blockedEitherWay.some((d) => d.exists)) return res.status(403).json({ error: 'You cannot message this user.' });

    const targetDoc = await db.collection('users').doc(user_id).get();
    if (!targetDoc.exists) return res.status(404).json({ error: 'User not found.' });

    const id = directConvoId(req.user.id, user_id);
    const ref = db.collection('conversations').doc(id);
    const existing = await ref.get();
    if (existing.exists) {
      return res.json({ conversation: await serializeConversation({ id, ...existing.data() }, req.user.id) });
    }

    const mutual = await isMutualFollow(req.user.id, user_id);
    const now = new Date().toISOString();
    const data = {
      is_group: false,
      participant_ids: [req.user.id, user_id],
      status: mutual ? 'accepted' : 'pending',
      initiator_id: req.user.id,
      created_at: now,
      last_message: null,
      last_message_at: now,
      last_read: {},
    };
    await ref.set(data);
    res.status(201).json({ conversation: await serializeConversation({ id, ...data }, req.user.id) });
  } catch (err) { next(err); }
});

router.post('/conversations/group', requireAuth, async (req, res, next) => {
  try {
    const { name, participant_ids } = req.body;
    const others = Array.isArray(participant_ids) ? participant_ids.filter((id) => id && id !== req.user.id) : [];
    if (others.length < 2) return res.status(400).json({ error: 'Pick at least 2 other people for a group.' });

    const usersSnap = await Promise.all(others.map((id) => db.collection('users').doc(id).get()));
    if (usersSnap.some((d) => !d.exists)) return res.status(404).json({ error: 'One or more users were not found.' });

    const now = new Date().toISOString();
    const data = {
      is_group: true,
      name: (name || '').trim() || `${req.user.username}'s group`,
      avatar_url: null,
      participant_ids: [req.user.id, ...others],
      admin_ids: [req.user.id],
      status: 'accepted',
      initiator_id: req.user.id,
      created_at: now,
      last_message: { text: 'Group created', sender_id: req.user.id, created_at: now, system: true },
      last_message_at: now,
      last_read: { [req.user.id]: now },
    };
    const ref = await db.collection('conversations').add(data);
    res.status(201).json({ conversation: await serializeConversation({ id: ref.id, ...data }, req.user.id) });
  } catch (err) { next(err); }
});

router.get('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);
    res.json({ conversation: await serializeConversation(conv, req.user.id) });
  } catch (err) { next(err); }
});

router.put('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);
    if (!conv.is_group) return res.status(400).json({ error: 'Direct messages cannot be renamed.' });
    if (!(conv.admin_ids || []).includes(req.user.id)) return res.status(403).json({ error: 'Only group admins can do that.' });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required.' });
    await db.collection('conversations').doc(conv.id).update({ name: name.trim() });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/conversations/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);
    if (conv.initiator_id === req.user.id) return res.status(400).json({ error: 'You cannot accept your own request.' });
    await db.collection('conversations').doc(conv.id).update({ status: 'accepted' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/conversations/:id/decline', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);
    await db.collection('conversations').doc(conv.id).delete();
    const msgSnap = await db.collection('messages').where('conversation_id', '==', conv.id).get();
    const batch = db.batch();
    msgSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Leave (or, for a 1:1, hide/delete) a conversation.
router.delete('/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);

    const remaining = conv.participant_ids.filter((id) => id !== req.user.id);
    if (!conv.is_group || remaining.length === 0) {
      await db.collection('conversations').doc(conv.id).delete();
    } else {
      const admin_ids = (conv.admin_ids || []).filter((id) => id !== req.user.id);
      await db.collection('conversations').doc(conv.id).update({
        participant_ids: remaining,
        admin_ids: admin_ids.length ? admin_ids : [remaining[0]],
      });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/conversations/:id/participants', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    if (!conv.is_group) return res.status(400).json({ error: 'Cannot add people to a direct message.' });
    assertParticipant(conv, req.user.id);
    if (!(conv.admin_ids || []).includes(req.user.id)) return res.status(403).json({ error: 'Only group admins can add members.' });

    const { user_ids } = req.body;
    const toAdd = (Array.isArray(user_ids) ? user_ids : []).filter((id) => id && !conv.participant_ids.includes(id));
    if (toAdd.length === 0) return res.json({ success: true });
    await db.collection('conversations').doc(conv.id).update({
      participant_ids: admin.firestore.FieldValue.arrayUnion(...toAdd),
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/conversations/:id/participants/:userId', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    if (!conv.is_group) return res.status(400).json({ error: 'Cannot remove people from a direct message.' });
    assertParticipant(conv, req.user.id);
    const isSelfLeaving = req.params.userId === req.user.id;
    if (!isSelfLeaving && !(conv.admin_ids || []).includes(req.user.id)) {
      return res.status(403).json({ error: 'Only group admins can remove members.' });
    }
    const remaining = conv.participant_ids.filter((id) => id !== req.params.userId);
    const admin_ids = (conv.admin_ids || []).filter((id) => id !== req.params.userId);
    if (remaining.length === 0) {
      await db.collection('conversations').doc(conv.id).delete();
    } else {
      await db.collection('conversations').doc(conv.id).update({
        participant_ids: remaining,
        admin_ids: admin_ids.length ? admin_ids : [remaining[0]],
      });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ---- messages -----------------------------------------------------------

router.get('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);

    let q = db.collection('messages').where('conversation_id', '==', conv.id).orderBy('created_at', 'desc');
    if (req.query.before) q = q.where('created_at', '<', req.query.before);
    const snap = await q.limit(MESSAGE_PAGE_SIZE).get();

    const messages = await Promise.all(snap.docs.map(async (d) => {
      const m = d.data();
      const author = await authorFor(m.sender_id);
      return {
        id: d.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        text: m.deleted ? null : (m.text || ''),
        song: m.deleted ? null : (m.song || null),
        deleted: !!m.deleted,
        edited_at: m.edited_at || null,
        created_at: m.created_at,
        author,
      };
    }));
    messages.reverse(); // oldest first for the thread UI

    res.json({ messages, hasMore: snap.docs.length === MESSAGE_PAGE_SIZE });
  } catch (err) { next(err); }
});

router.post('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);

    const { text, song } = req.body;
    const trimmed = (text || '').trim();
    if (!trimmed && !song) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (trimmed.length > 4000) return res.status(400).json({ error: 'Message is too long.' });

    const now = new Date().toISOString();
    const messageData = {
      conversation_id: conv.id,
      sender_id: req.user.id,
      text: trimmed,
      // song: { id, title, artist, audio_url, jamendo_url } — attached via the Jamendo track picker.
      song: song && song.audio_url ? {
        id: String(song.id || ''), title: String(song.title || ''), artist: String(song.artist || ''),
        audio_url: String(song.audio_url), image: String(song.image || ''),
      } : null,
      created_at: now,
      edited_at: null,
      deleted: false,
    };
    const ref = await db.collection('messages').add(messageData);

    const preview = trimmed || (song ? `🎵 ${song.title || 'a song'}` : '');
    await db.collection('conversations').doc(conv.id).update({
      last_message: { text: preview, sender_id: req.user.id, created_at: now, system: false },
      last_message_at: now,
      [`last_read.${req.user.id}`]: now,
    });

    // Notify the other participant(s) — skip if the request is still pending and unread by them.
    const recipients = conv.participant_ids.filter((id) => id !== req.user.id);
    await Promise.all(recipients.map((uid) => db.collection('notifications').add({
      user_id: uid, actor_id: req.user.id, type: 'message', post_id: null, comment_id: null,
      is_read: false, created_at: now, conversation_id: conv.id,
    })));

    const author = await authorFor(req.user.id);
    res.status(201).json({ message: { id: ref.id, ...messageData, author } });
  } catch (err) { next(err); }
});

router.put('/conversations/:id/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);

    const msgRef = db.collection('messages').doc(req.params.messageId);
    const msgDoc = await msgRef.get();
    if (!msgDoc.exists || msgDoc.data().conversation_id !== conv.id) return res.status(404).json({ error: 'Message not found.' });
    if (msgDoc.data().sender_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own messages.' });
    if (msgDoc.data().deleted) return res.status(400).json({ error: 'This message was deleted.' });

    const trimmed = (req.body.text || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Message cannot be empty.' });
    const now = new Date().toISOString();
    await msgRef.update({ text: trimmed, edited_at: now });

    // Keep the inbox preview in sync if this was the most recent message.
    if (conv.last_message && conv.last_message.created_at === msgDoc.data().created_at && conv.last_message.sender_id === req.user.id) {
      await db.collection('conversations').doc(conv.id).update({ 'last_message.text': trimmed });
    }
    res.json({ success: true, edited_at: now });
  } catch (err) { next(err); }
});

router.delete('/conversations/:id/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);

    const msgRef = db.collection('messages').doc(req.params.messageId);
    const msgDoc = await msgRef.get();
    if (!msgDoc.exists || msgDoc.data().conversation_id !== conv.id) return res.status(404).json({ error: 'Message not found.' });
    if (msgDoc.data().sender_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own messages.' });

    await msgRef.update({ deleted: true, text: '', song: null });
    if (conv.last_message && conv.last_message.created_at === msgDoc.data().created_at) {
      await db.collection('conversations').doc(conv.id).update({ 'last_message.text': 'This message was deleted.' });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/conversations/:id/read', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);
    await db.collection('conversations').doc(conv.id).update({ [`last_read.${req.user.id}`]: new Date().toISOString() });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ---- restrict -------------------------------------------------------
// A softer alternative to blocking: the other person keeps messaging into
// this thread normally, but it stops badging/notifying the restrictor.
// Only affects the restrictor's own view — it's stored per-viewer on the
// conversation, not a global block.

router.post('/conversations/:id/restrict', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);
    if (conv.is_group) return res.status(400).json({ error: 'Groups cannot be restricted.' });
    await db.collection('conversations').doc(conv.id).update({
      restricted_by: admin.firestore.FieldValue.arrayUnion(req.user.id),
    });
    res.json({ success: true, is_restricted: true });
  } catch (err) { next(err); }
});

router.delete('/conversations/:id/restrict', requireAuth, async (req, res, next) => {
  try {
    const conv = await loadConversation(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
    assertParticipant(conv, req.user.id);
    await db.collection('conversations').doc(conv.id).update({
      restricted_by: admin.firestore.FieldValue.arrayRemove(req.user.id),
    });
    res.json({ success: true, is_restricted: false });
  } catch (err) { next(err); }
});

module.exports = router;
