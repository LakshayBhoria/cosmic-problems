import React, { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, BadgeCheck, Settings, Sparkles, Wand2, RefreshCcw, ImagePlus, X } from 'lucide-react';
import { useCall } from '../context/CallContext.jsx';
import { mediaUrl } from '../api';

// In-call settings sheet — mirrors the "Audio Noise Suppression" / "Audio
// Touch Up" toggles from familiar calling apps. Applies live via
// track.applyConstraints, no need to restart the call.
function CallSettingsSheet({ onClose }) {
  const { noiseSuppression, voiceIsolation, setNoiseSuppression, setVoiceIsolation } = useCall();
  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-nebula-bg border border-nebula-border rounded-t-2xl sm:rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-nebula-border">
          <h3 className="font-display font-semibold text-sm">Call settings</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} className="text-nebula-muted" /></button>
        </div>
        <div className="p-4 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm">Audio Noise Suppression</p>
              <p className="text-xs text-nebula-muted">Filters background noise from your mic.</p>
            </div>
            <input type="checkbox" checked={noiseSuppression} onChange={(e) => setNoiseSuppression(e.target.checked)} className="w-5 h-5 accent-nebula-violet" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm">Audio Touch Up</p>
              <p className="text-xs text-nebula-muted">Extra cleanup for echo and low volume.</p>
            </div>
            <input type="checkbox" checked={voiceIsolation} onChange={(e) => setVoiceIsolation(e.target.checked)} className="w-5 h-5 accent-nebula-violet" />
          </label>
        </div>
      </div>
    </div>
  );
}

export default function CallOverlay() {
  const call = useCall();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);

  const { callStatus, callType, peer, error, muted, cameraOff, localStream, remoteStream, connState,
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
            {/* Effects rail — placeholders for filters/backgrounds; wire each
                up to real video-track processing (e.g. a canvas/WebGL or
                MediaPipe pipeline) when you're ready to build that out. */}
            <div className="absolute left-4 top-1/3 flex flex-col gap-4">
              {[Sparkles, Wand2, RefreshCcw, ImagePlus].map((Icon, i) => (
                <button key={i} className="text-white/90 drop-shadow" aria-label="Effect" onClick={(e) => { e.stopPropagation(); }}>
                  <Icon size={22} />
                </button>
              ))}
            </div>
            {callStatus === 'active' && (connState === 'connecting' || connState === 'checking' || connState === 'new') && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                Connecting…
              </div>
            )}
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
                {callStatus === 'active' && (connState === 'connecting' || connState === 'checking' || connState === 'new' ? 'Connecting…' : (isVideo ? 'Video call' : 'Audio call'))}
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
            <button onClick={() => setShowSettings(true)} className="w-12 h-12 rounded-full flex items-center justify-center border border-nebula-border text-nebula-text" aria-label="Call settings">
              <Settings size={20} />
            </button>
            <button onClick={endCall} className="w-14 h-14 rounded-full bg-nebula-pink flex items-center justify-center text-white shadow-lg" aria-label="End call">
              <PhoneOff size={24} />
            </button>
          </>
        )}
      </div>

      {showSettings && <CallSettingsSheet onClose={() => setShowSettings(false)} />}
    </div>
  );
}
