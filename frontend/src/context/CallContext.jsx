import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { socketUrl } from '../api';
import { useAuth } from './AuthContext.jsx';

const CallContext = createContext(null);

// Free public STUN server — enough to traverse most home/office NATs. No
// TURN server is configured, so calls between two peers that both sit
// behind restrictive/symmetric NATs (common on some mobile carriers or
// corporate networks) may fail to connect; add a TURN server URL here if
// that turns out to matter for your users.
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export function CallProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callIdRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  // 'idle' | 'outgoing' | 'incoming' | 'active'
  const [callStatus, setCallStatus] = useState('idle');
  const [callType, setCallType] = useState(null); // 'audio' | 'video'
  const [peer, setPeer] = useState(null); // { id, username, avatar_url, is_verified }
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const resetCallState = useCallback(() => {
    // pcRef briefly holds a plain stashed { pendingOffer } object for an
    // incoming call that hasn't been accepted yet — only real
    // RTCPeerConnections need (and have) .close().
    if (pcRef.current) { if (typeof pcRef.current.close === 'function') pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null; }
    pendingCandidatesRef.current = [];
    callIdRef.current = null;
    setCallStatus('idle');
    setCallType(null);
    setPeer(null);
    setMuted(false);
    setCameraOff(false);
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  // ---- socket lifecycle -------------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem('cosmic_token');
    if (!user || !token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('call:incoming', ({ callId, conversationId, callType: type, offer, from }) => {
      // Only one call at a time — silently ignore a second incoming call.
      if (callIdRef.current) return;
      callIdRef.current = callId;
      pcRef.current = { pendingOffer: offer, conversationId }; // stashed until accept()
      setCallType(type);
      setPeer(from);
      setCallStatus('incoming');
    });

    socket.on('call:answered', async ({ callId, answer }) => {
      if (callId !== callIdRef.current || !pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      for (const c of pendingCandidatesRef.current) await pcRef.current.addIceCandidate(c).catch(() => {});
      pendingCandidatesRef.current = [];
      setCallStatus('active');
    });

    socket.on('call:ice-candidate', async ({ callId, candidate }) => {
      if (callId !== callIdRef.current || !candidate) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(candidate).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    });

    socket.on('call:declined', () => { setError('Call declined.'); resetCallState(); });
    socket.on('call:unavailable', ({ reason }) => {
      setError(reason === 'no-answer' ? 'No answer.' : 'They are not available right now.');
      resetCallState();
    });
    socket.on('call:ended', () => { resetCallState(); });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [user, resetCallState]);

  // ---- shared peer-connection setup -------------------------------------
  const buildPeerConnection = useCallback((remoteId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (e.candidate && callIdRef.current) {
        socketRef.current?.emit('call:ice-candidate', { callId: callIdRef.current, toUserId: remoteId, candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) resetCallState();
    };
    return pc;
  }, [resetCallState]);

  // ---- outgoing call ------------------------------------------------------
  const startCall = useCallback(async (conversationId, otherUser, type) => {
    if (!socketRef.current || callIdRef.current) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = buildPeerConnection(otherUser.id);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setPeer(otherUser);
      setCallType(type);
      setCallStatus('outgoing');

      socketRef.current.emit('call:invite', { toUserId: otherUser.id, conversationId, callType: type, offer }, (res) => {
        if (!res?.ok) {
          setError(res?.error === 'offline' ? `${otherUser.username} is offline right now.` : (res?.error || 'Could not start the call.'));
          resetCallState();
          return;
        }
        callIdRef.current = res.callId;
      });
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Camera/microphone permission was denied.' : 'Could not access camera/microphone.');
      resetCallState();
    }
  }, [buildPeerConnection, resetCallState]);

  // ---- incoming call: accept / decline ------------------------------------
  const acceptCall = useCallback(async () => {
    const stashed = pcRef.current; // { pendingOffer, conversationId }
    if (!stashed || !peer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = buildPeerConnection(peer.id);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(stashed.pendingOffer));
      for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c).catch(() => {});
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('call:answer', { callId: callIdRef.current, toUserId: peer.id, answer });
      setCallStatus('active');
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Camera/microphone permission was denied.' : 'Could not access camera/microphone.');
      socketRef.current?.emit('call:decline', { callId: callIdRef.current });
      resetCallState();
    }
  }, [peer, callType, buildPeerConnection, resetCallState]);

  const declineCall = useCallback(() => {
    socketRef.current?.emit('call:decline', { callId: callIdRef.current });
    resetCallState();
  }, [resetCallState]);

  const endCall = useCallback(() => {
    if (callIdRef.current && peer) {
      socketRef.current?.emit('call:end', { callId: callIdRef.current, toUserId: peer.id });
    }
    resetCallState();
  }, [peer, resetCallState]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOff;
    stream.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setCameraOff(next);
  }, [cameraOff]);

  return (
    <CallContext.Provider value={{
      callStatus, callType, peer, error, muted, cameraOff, localStream, remoteStream,
      startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera,
      clearError: () => setError(''),
    }}>
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);
