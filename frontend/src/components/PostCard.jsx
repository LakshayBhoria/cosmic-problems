import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Bookmark, ChevronLeft, ChevronRight, BadgeCheck, MoreHorizontal, Trash2 } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_LABEL = { open: 'Open question', discussing: 'Discussing', solved: 'Solved' };

export default function PostCard({ post, onChange, onDelete }) {
  const { user } = useAuth();
  const [idx, setIdx] = useState(0);
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [saved, setSaved] = useState(post.savedByViewer);
  const [menuOpen, setMenuOpen] = useState(false);
  const media = post.media || [];

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await api.post(`/posts/${post.id}/like`);
      else await api.delete(`/posts/${post.id}/like`);
    } catch (e) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  };

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      if (next) await api.post(`/posts/${post.id}/save`);
      else await api.delete(`/posts/${post.id}/save`);
    } catch (e) { setSaved(!next); }
  };

  const remove = async () => {
    if (!confirm('Delete this post permanently?')) return;
    await api.delete(`/posts/${post.id}`);
    onDelete && onDelete(post.id);
  };

  const timeAgo = formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: false });

  return (
    <article className="card overflow-hidden animate-rise">
      <div className="flex items-center justify-between px-4 py-3">
        <Link to={`/${post.author.username}`} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-nebula-bg border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
            {post.author.avatar_url ? <img src={mediaUrl(post.author.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{post.author.username[0].toUpperCase()}</span>}
          </div>
          <div className="leading-tight">
            <span className="text-sm font-medium flex items-center gap-1">
              {post.author.username}
              {!!post.author.is_verified && <BadgeCheck size={13} className="text-nebula-cyan" />}
            </span>
            <p className="eyebrow">{post.category} · {timeAgo} ago</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <span className={`status-pill status-${post.status}`}>
            <span className="status-dot" />{STATUS_LABEL[post.status]}
          </span>
          {post.author.id === user?.id && (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="p-1 text-nebula-muted hover:text-white">
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 card py-1 w-32 z-10">
                  <button onClick={remove} className="w-full text-left px-3 py-1.5 text-sm text-nebula-pink flex items-center gap-2 hover:bg-nebula-bg">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {media.length > 0 && (
        <div className="relative bg-black aspect-square w-full">
          {media[idx].media_type === 'video' ? (
            <video src={mediaUrl(media[idx].media_url)} className="w-full h-full object-contain" controls playsInline />
          ) : (
            <img src={mediaUrl(media[idx].media_url)} className="w-full h-full object-cover" loading="lazy" />
          )}
          {media.length > 1 && (
            <>
              {idx > 0 && (
                <button onClick={() => setIdx((i) => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1">
                  <ChevronLeft size={18} />
                </button>
              )}
              {idx < media.length - 1 && (
                <button onClick={() => setIdx((i) => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-1">
                  <ChevronRight size={18} />
                </button>
              )}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {media.map((_, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-nebula-violet' : 'bg-white/40'}`} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          <button onClick={toggleLike} className="flex items-center gap-1.5 group">
            <Heart size={22} className={liked ? 'fill-nebula-pink text-nebula-pink' : 'text-nebula-text group-hover:text-nebula-pink'} strokeWidth={1.8} />
          </button>
          <Link to={`/post/${post.id}`} className="flex items-center gap-1.5 group">
            <MessageCircle size={22} className="text-nebula-text group-hover:text-nebula-cyan" strokeWidth={1.8} />
          </Link>
          <button onClick={toggleSave} className="ml-auto">
            <Bookmark size={20} className={saved ? 'fill-nebula-star text-nebula-star' : 'text-nebula-text'} strokeWidth={1.8} />
          </button>
        </div>

        <p className="text-sm font-semibold mt-2">{likeCount} {likeCount === 1 ? 'like' : 'likes'}</p>

        {post.caption && (
          <p className="text-sm mt-1">
            <Link to={`/${post.author.username}`} className="font-medium mr-1.5">{post.author.username}</Link>
            {post.caption}
          </p>
        )}

        {post.commentCount > 0 && (
          <Link to={`/post/${post.id}`} className="text-sm text-nebula-muted mt-1 block">
            View all {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
          </Link>
        )}
      </div>
    </article>
  );
}
