import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, BadgeCheck } from 'lucide-react';
import { useCall } from '../context/CallContext.jsx';
import { mediaUrl } from '../api';

export default function CallOverlay() {
  const call = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const { callStatus, callType, peer, error, muted, cameraOff, localStream, remoteStream,
    acceptCall, declineCall, endCall, toggleMute, toggleCamera, clearError } = call || {};

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream || null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  // Auto-dismiss transient errors (declined/offline/no-answer) after a beat.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 3500);
    return () => clearTimeout(t);
  }, [error, clearError]);

  if (!call) return null;

  if (callStatus === 'idle') {
    if (!error) return null;
    return (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-black/85 backdrop-blur text-xs text-white px-4 py-2 rounded-full">
        {error}
      </div>
    );
  }

  const isVideo = callType === 'video';
  const showVideoTiles = isVideo && (callStatus === 'active' || callStatus === 'outgoing');

  return (
    <div className="fixed inset-0 z-[100] bg-void flex flex-col">
      {/* Remote audio always plays, even in an audio-only call. */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: isVideo ? 'none' : undefined }} />

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {showVideoTiles ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-black" />
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-24 right-4 w-28 h-40 rounded-xl object-cover border border-nebula-border shadow-lg" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-28 h-28 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center">
              {peer?.avatar_url ? (
                <img src={mediaUrl(peer.avatar_url)} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-display">{peer?.username?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="text-center">
              <p className="font-display font-semibold text-lg flex items-center gap-1 justify-center">
                {peer?.username} {peer?.is_verified && <BadgeCheck size={16} className="text-nebula-cyan" />}
              </p>
              <p className="eyebrow mt-1">
                {callStatus === 'incoming' && `Incoming ${isVideo ? 'video' : 'audio'} call…`}
                {callStatus === 'outgoing' && 'Calling…'}
                {callStatus === 'active' && (isVideo ? 'Video call' : 'Audio call')}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 pb-10 pt-6 flex items-center justify-center gap-6">
        {callStatus === 'incoming' ? (
          <>
            <button onClick={declineCall} className="w-14 h-14 rounded-full bg-nebula-pink flex items-center justify-center text-white shadow-lg" aria-label="Decline">
              <PhoneOff size={24} />
            </button>
            <button onClick={acceptCall} className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg" aria-label="Accept">
              <Phone size={24} />
            </button>
          </>
        ) : (
          <>
            <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center border border-nebula-border ${muted ? 'bg-nebula-surface text-nebula-pink' : 'text-nebula-text'}`} aria-label="Mute">
              {muted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            {isVideo && (
              <button onClick={toggleCamera} className={`w-12 h-12 rounded-full flex items-center justify-center border border-nebula-border ${cameraOff ? 'bg-nebula-surface text-nebula-pink' : 'text-nebula-text'}`} aria-label="Toggle camera">
                {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}
            <button onClick={endCall} className="w-14 h-14 rounded-full bg-nebula-pink flex items-center justify-center text-white shadow-lg" aria-label="End call">
              <PhoneOff size={24} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
