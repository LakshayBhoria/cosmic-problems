import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Volume2, VolumeX, BadgeCheck } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

function ReelItem({ reel, muted, toggleMute }) {
  const videoRef = useRef(null);
  const [liked, setLiked] = useState(reel.likedByViewer);
  const [likeCount, setLikeCount] = useState(reel.likeCount);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) videoRef.current?.play().catch(() => {});
        else videoRef.current?.pause();
      },
      { threshold: 0.6 }
    );
    if (videoRef.current) obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, []);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await api.post(`/posts/${reel.id}/like`);
      else await api.delete(`/posts/${reel.id}/like`);
    } catch (e) {}
  };

  return (
    <div className="relative h-[calc(100dvh-7.5rem)] md:h-[calc(100vh-6rem)] snap-start flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={mediaUrl(reel.media[0]?.media_url)}
        className="h-full w-full max-w-[420px] object-cover md:rounded-2xl"
        loop
        muted={muted}
        playsInline
        onClick={() => (videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause())}
      />
      <button onClick={toggleMute} className="absolute top-4 right-4 md:right-[calc(50%-190px)] bg-black/50 rounded-full p-2">
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      <div className="absolute bottom-6 left-4 right-16 md:left-[calc(50%-190px+16px)] md:right-auto md:w-[300px] text-white">
        <Link to={`/${reel.author.username}`} className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-nebula-surface border border-white/30 overflow-hidden flex items-center justify-center">
            {reel.author.avatar_url ? <img src={mediaUrl(reel.author.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{reel.author.username[0].toUpperCase()}</span>}
          </div>
          <span className="text-sm font-medium flex items-center gap-1">{reel.author.username} {!!reel.author.is_verified && <BadgeCheck size={13} className="text-nebula-cyan" />}</span>
        </Link>
        {reel.caption && <p className="text-sm line-clamp-2">{reel.caption}</p>}
        <span className="eyebrow text-white/70 mt-1 inline-block">{reel.category}</span>
      </div>

      <div className="absolute bottom-24 right-4 md:right-[calc(50%-190px-56px)] flex flex-col items-center gap-5 text-white">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <Heart size={26} className={liked ? 'fill-nebula-pink text-nebula-pink' : ''} />
          <span className="text-xs font-mono">{likeCount}</span>
        </button>
        <Link to={`/post/${reel.id}`} className="flex flex-col items-center gap-1">
          <MessageCircle size={26} />
          <span className="text-xs font-mono">{reel.commentCount}</span>
        </Link>
      </div>
    </div>
  );
}

export default function Reels() {
  const [reels, setReels] = useState([]);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reels').then(({ data }) => { setReels(data.reels); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center pt-24"><div className="w-8 h-8 rounded-full border-2 border-nebula-violet border-t-transparent animate-spin" /></div>;

  if (reels.length === 0) {
    return (
      <div className="text-center pt-24">
        <p className="text-sm text-nebula-muted">No reels yet. Be the first to share a cosmic clip.</p>
        <Link to="/create" className="btn-primary inline-block px-4 py-2 mt-4 text-sm">Upload a reel</Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-7.5rem)] md:h-[calc(100vh-6rem)] overflow-y-scroll snap-y snap-mandatory">
      {reels.map((r) => <ReelItem key={r.id} reel={r} muted={muted} toggleMute={() => setMuted((m) => !m)} />)}
    </div>
  );
}
