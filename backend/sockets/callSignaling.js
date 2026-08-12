// Signaling only — no media ever passes through this server. Two peers
// exchange SDP offers/answers and ICE candidates over the socket, then talk
// directly to each other (WebRTC, STUN-assisted). We just relay envelopes
// between `user:<id>` rooms and keep a tiny in-memory map of active calls so
// we can validate that "answer"/"ice"/"end" messages belong to a real call.
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

const activeCalls = new Map(); // callId -> { callerId, calleeId, conversationId, status }

function socketsForUser(io, userId) {
  return io.sockets.adapter.rooms.get(`user:${userId}`);
}

function isUserOnline(io, userId) {
  const room = socketsForUser(io, userId);
  return !!room && room.size > 0;
}

async function usersShareConversation(conversationId, aId, bId) {
  const doc = await db.collection('conversations').doc(conversationId).get();
  if (!doc.exists) return false;
  const d = doc.data();
  if (d.is_group) return false; // calls are 1:1 only for now
  return (d.participant_ids || []).includes(aId) && (d.participant_ids || []).includes(bId);
}

function initCallSignaling(io) {
  // Auth handshake: same JWT the REST API uses, passed via `auth.token`.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Not authenticated'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const doc = await db.collection('users').doc(payload.id).get();
      if (!doc.exists) return next(new Error('Not authenticated'));
      const d = doc.data();
      socket.userId = doc.id;
      socket.userInfo = { id: doc.id, username: d.username, full_name: d.full_name, avatar_url: d.avatar_url, is_verified: !!d.is_verified };
      next();
    } catch (err) {
      next(new Error('Not authenticated'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);

    // ---- call:invite — caller starts a call --------------------------
    socket.on('call:invite', async (payload = {}, ack) => {
      try {
        const { toUserId, conversationId, callType, offer } = payload;
        if (!toUserId || !conversationId || !offer || !['audio', 'video'].includes(callType)) {
          return ack?.({ ok: false, error: 'Malformed call request.' });
        }
        if (toUserId === socket.userId) return ack?.({ ok: false, error: 'Cannot call yourself.' });

        const allowed = await usersShareConversation(conversationId, socket.userId, toUserId);
        if (!allowed) return ack?.({ ok: false, error: 'You can only call someone you have a conversation with.' });

        if (!isUserOnline(io, toUserId)) return ack?.({ ok: false, error: 'offline' });

        // Only one active call per pair of users at a time.
        for (const [, call] of activeCalls) {
          if ((call.callerId === socket.userId || call.calleeId === socket.userId) && call.status !== 'ended') {
            return ack?.({ ok: false, error: 'You are already on a call.' });
          }
        }

        const callId = `${conversationId}_${Date.now()}`;
        activeCalls.set(callId, { callerId: socket.userId, calleeId: toUserId, conversationId, status: 'ringing' });

        io.to(`user:${toUserId}`).emit('call:incoming', {
          callId,
          conversationId,
          callType,
          offer,
          from: socket.userInfo,
        });

        ack?.({ ok: true, callId });

        // Auto-expire an unanswered call after 45s.
        setTimeout(() => {
          const call = activeCalls.get(callId);
          if (call && call.status === 'ringing') {
            activeCalls.delete(callId);
            io.to(`user:${call.callerId}`).emit('call:unavailable', { callId, reason: 'no-answer' });
            io.to(`user:${call.calleeId}`).emit('call:ended', { callId, reason: 'no-answer' });
          }
        }, 45000);
      } catch (err) {
        ack?.({ ok: false, error: 'Could not place the call.' });
      }
    });

    // ---- call:answer — callee accepts, sends back an SDP answer -------
    socket.on('call:answer', ({ callId, answer } = {}) => {
      const call = activeCalls.get(callId);
      if (!call || call.calleeId !== socket.userId) return;
      call.status = 'active';
      io.to(`user:${call.callerId}`).emit('call:answered', { callId, answer });
    });

    // ---- call:ice-candidate — relayed both directions -----------------
    socket.on('call:ice-candidate', ({ callId, candidate } = {}) => {
      const call = activeCalls.get(callId);
      if (!call) return;
      const otherId = call.callerId === socket.userId ? call.calleeId : call.callerId;
      if (![call.callerId, call.calleeId].includes(socket.userId)) return;
      io.to(`user:${otherId}`).emit('call:ice-candidate', { callId, candidate });
    });

    // ---- call:decline — callee rejects before answering ----------------
    socket.on('call:decline', ({ callId } = {}) => {
      const call = activeCalls.get(callId);
      if (!call || call.calleeId !== socket.userId) return;
      activeCalls.delete(callId);
      io.to(`user:${call.callerId}`).emit('call:declined', { callId });
    });

    // ---- call:end — either side hangs up -------------------------------
    socket.on('call:end', ({ callId } = {}) => {
      const call = activeCalls.get(callId);
      if (!call || ![call.callerId, call.calleeId].includes(socket.userId)) return;
      const otherId = call.callerId === socket.userId ? call.calleeId : call.callerId;
      activeCalls.delete(callId);
      io.to(`user:${otherId}`).emit('call:ended', { callId, reason: 'hangup' });
    });

    socket.on('disconnect', () => {
      // If this user was mid-call, tell the other side it dropped.
      for (const [callId, call] of activeCalls) {
        if (call.callerId === socket.userId || call.calleeId === socket.userId) {
          const otherId = call.callerId === socket.userId ? call.calleeId : call.callerId;
          activeCalls.delete(callId);
          io.to(`user:${otherId}`).emit('call:ended', { callId, reason: 'disconnected' });
        }
      }
    });
  });
}

module.exports = { initCallSignaling };
