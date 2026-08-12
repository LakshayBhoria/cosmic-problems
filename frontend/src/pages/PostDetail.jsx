import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Bookmark, BadgeCheck, ArrowLeft, ChevronDown } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import CommentSection from '../components/CommentSection.jsx';

const STATUS_LABEL = { open: 'Open question', discussing: 'Discussing', solved: 'Solved' };

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [post, setPost] = useState(null);
  const [idx, setIdx] = useState(0);
  const [statusMenu, setStatusMenu] = useState(false);

  useEffect(() => {
    api.get(`/posts/${id}`).then(({ data }) => setPost(data.post));
  }, [id]);

  if (!post) return <div className="flex justify-center pt-24"><div className="w-8 h-8 rounded-full border-2 border-nebula-violet border-t-transparent animate-spin" /></div>;

  const toggleLike = async () => {
    const next = !post.likedByViewer;
    setPost((p) => ({ ...p, likedByViewer: next, likeCount: p.likeCount + (next ? 1 : -1) }));
    if (next) await api.post(`/posts/${id}/like`); else await api.delete(`/posts/${id}/like`);
  };

  const toggleSave = async () => {
    const next = !post.savedByViewer;
    setPost((p) => ({ ...p, savedByViewer: next }));
    if (next) await api.post(`/posts/${id}/save`); else await api.delete(`/posts/${id}/save`);
  };

  const setStatus = async (status) => {
    setPost((p) => ({ ...p, status }));
    setStatusMenu(false);
    await api.put(`/posts/${id}/status`, { status });
  };

  const timeAgo = formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: false });
  const media = post.media || [];

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 pt-4">
      <button onClick={() => nav(-1)} className="flex items-center gap-1.5 text-sm text-nebula-muted mb-3 hover:text-white">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card overflow-hidden md:flex">
        {media.length > 0 && (
          <div className="relative bg-black md:w-1/2 aspect-square shrink-0">
            {media[idx].media_type === 'video' ? (
              <video src={mediaUrl(media[idx].media_url)} className="w-full h-full object-contain" controls autoPlay playsInline />
            ) : (
              <img src={mediaUrl(media[idx].media_url)} className="w-full h-full object-cover" />
            )}
            {media.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {media.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-nebula-violet' : 'bg-white/40'}`} />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="md:w-1/2 flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-nebula-border">
            <Link to={`/${post.author.username}`} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-nebula-bg border border-nebula-border overflow-hidden flex items-center justify-center">
                {post.author.avatar_url ? <img src={mediaUrl(post.author.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{post.author.username[0].toUpperCase()}</span>}
              </div>
              <div className="leading-tight">
                <span className="text-sm font-medium flex items-center gap-1">{post.author.username} {!!post.author.is_verified && <BadgeCheck size={13} className="text-nebula-cyan" />}</span>
                <p className="eyebrow">{post.category} · {timeAgo} ago</p>
              </div>
            </Link>

            <div className="relative">
              <button
                onClick={() => post.author.id === user?.id && setStatusMenu((v) => !v)}
                className={`status-pill status-${post.status} ${post.author.id === user?.id ? 'cursor-pointer' : ''}`}
              >
                <span className="status-dot" />{STATUS_LABEL[post.status]}
                {post.author.id === user?.id && <ChevronDown size={12} />}
              </button>
              {statusMenu && (
                <div className="absolute right-0 top-8 card py-1 w-40 z-10">
                  {Object.entries(STATUS_LABEL).map(([k, label]) => (
                    <button key={k} onClick={() => setStatus(k)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-nebula-bg">{label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {post.caption && (
            <div className="px-4 py-3 border-b border-nebula-border">
              <p className="text-sm"><span className="font-medium mr-1.5">{post.author.username}</span>{post.caption}</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4">
            <CommentSection postId={post.id} disabled={post.comments_disabled} />
          </div>

          <div className="px-4 py-3 border-t border-nebula-border flex items-center gap-4">
            <button onClick={toggleLike}><Heart size={22} className={post.likedByViewer ? 'fill-nebula-pink text-nebula-pink' : ''} /></button>
            <button onClick={toggleSave} className="ml-auto"><Bookmark size={20} className={post.savedByViewer ? 'fill-nebula-star text-nebula-star' : ''} /></button>
          </div>
          {(!post.hide_like_count || post.author.id === user?.id) && (
            <p className="px-4 pb-3 text-sm font-semibold">{post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
