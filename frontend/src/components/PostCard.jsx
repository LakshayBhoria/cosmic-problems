import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart, MessageCircle, Send, Bookmark, ChevronLeft, ChevronRight, BadgeCheck, MoreHorizontal, Trash2,
  Archive, ArchiveRestore, Share2, QrCode, Eye, EyeOff, MessageSquare, MessageSquareOff, Video, Pencil,
  Crop, BarChart3, Repeat, Pin, PinOff, X,
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import SharePostModal from './SharePostModal.jsx';

const STATUS_LABEL = { open: 'Open question', discussing: 'Discussing', solved: 'Solved' };

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center gap-2.5 hover:bg-nebula-bg ${danger ? 'text-nebula-pink' : ''}`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-nebula-border">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-nebula-muted hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function PostCard({ post, onChange, onDelete }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [idx, setIdx] = useState(0);
  const [liked, setLiked] = useState(post.likedByViewer);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [shareCount, setShareCount] = useState(post.shareCount || 0);
  const [saved, setSaved] = useState(post.savedByViewer);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'edit' | 'qr' | 'insights' | 'preview' | 'share' | null
  const [caption, setCaption] = useState(post.caption);
  const [category, setCategory] = useState(post.category);
  const [hideLikeCount, setHideLikeCount] = useState(post.hide_like_count);
  const [hideShareCount, setHideShareCount] = useState(post.hide_share_count);
  const [commentsDisabled, setCommentsDisabled] = useState(post.comments_disabled);
  const [archived, setArchived] = useState(post.is_archived);
  const [pinned, setPinned] = useState(post.is_pinned);
  const [allowReuse, setAllowReuse] = useState(post.allow_reuse);
  const [coverIndex, setCoverIndex] = useState(post.cover_index || 0);
  const [settingsError, setSettingsError] = useState('');
  const [insights, setInsights] = useState(null);
  const media = post.media || [];
  const isOwner = post.author.id === user?.id;
  const postUrl = `${window.location.origin}/post/${post.id}`;

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

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500');
    setMenuOpen(false);
  };

  // Owner-only toggles/edits, all backed by PATCH /posts/:id/settings
  const updateSettings = async (patch) => {
    setSettingsError('');
    try {
      const { data } = await api.patch(`/posts/${post.id}/settings`, patch);
      const p = data.post;
      setHideLikeCount(p.hide_like_count);
      setHideShareCount(p.hide_share_count);
      setCommentsDisabled(p.comments_disabled);
      setArchived(p.is_archived);
      setPinned(p.is_pinned);
      setAllowReuse(p.allow_reuse);
      setCoverIndex(p.cover_index);
      onChange && onChange(p);
      return true;
    } catch (e) {
      setSettingsError(e.response?.data?.error || 'Could not update this setting.');
      return false;
    }
  };

  const saveEdit = async () => {
    try {
      const { data } = await api.put(`/posts/${post.id}`, { caption, category });
      setCaption(data.post.caption);
      setCategory(data.post.category);
      onChange && onChange(data.post);
      setActiveModal(null);
    } catch (e) {
      setSettingsError(e.response?.data?.error || 'Could not save changes.');
    }
  };

  const openInsights = async () => {
    setMenuOpen(false);
    setActiveModal('insights');
    try {
      const { data } = await api.get(`/posts/${post.id}/insights`);
      setInsights(data.insights);
    } catch (e) {
      setInsights(null);
    }
  };

  const createReelFromPost = () => {
    setMenuOpen(false);
    nav('/create', { state: { type: 'reel' } });
  };

  const hasVideo = media.some((m) => m.media_type === 'video');
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
              {pinned && <Pin size={11} className="text-nebula-muted" />}
            </span>
            <p className="eyebrow">{category} · {timeAgo} ago{archived ? ' · Archived' : ''}</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <span className={`status-pill status-${post.status}`}>
            <span className="status-dot" />{STATUS_LABEL[post.status]}
          </span>
          {isOwner && (
            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="p-1 text-nebula-muted hover:text-white">
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-7 card py-1 w-64 z-20 max-h-[70vh] overflow-y-auto">
                    <MenuItem
                      icon={archived ? ArchiveRestore : Archive}
                      label={archived ? 'Unarchive' : 'Archive'}
                      onClick={() => updateSettings({ is_archived: !archived }).then(() => setMenuOpen(false))}
                    />
                    <MenuItem icon={Share2} label="Share to Facebook" onClick={shareToFacebook} />
                    <MenuItem icon={QrCode} label="QR code" onClick={() => { setMenuOpen(false); setActiveModal('qr'); }} />
                    <MenuItem
                      icon={hideLikeCount ? Eye : EyeOff}
                      label={hideLikeCount ? 'Unhide like count' : 'Hide like count'}
                      onClick={() => updateSettings({ hide_like_count: !hideLikeCount }).then(() => setMenuOpen(false))}
                    />
                    <MenuItem
                      icon={hideShareCount ? Eye : EyeOff}
                      label={hideShareCount ? 'Unhide share count' : 'Hide share count'}
                      onClick={() => updateSettings({ hide_share_count: !hideShareCount }).then(() => setMenuOpen(false))}
                    />
                    <MenuItem
                      icon={commentsDisabled ? MessageSquare : MessageSquareOff}
                      label={commentsDisabled ? 'Turn on commenting' : 'Turn off commenting'}
                      onClick={() => updateSettings({ comments_disabled: !commentsDisabled }).then(() => setMenuOpen(false))}
                    />
                    {post.type === 'post' && hasVideo && (
                      <MenuItem icon={Video} label="Create reel from this post" onClick={createReelFromPost} />
                    )}
                    <MenuItem icon={Pencil} label="Edit" onClick={() => { setMenuOpen(false); setActiveModal('edit'); }} />
                    {media.length > 1 && (
                      <MenuItem icon={Crop} label="Adjust preview" onClick={() => { setMenuOpen(false); setActiveModal('preview'); }} />
                    )}
                    <MenuItem icon={BarChart3} label="View insights" onClick={openInsights} />
                    <MenuItem
                      icon={Repeat}
                      label={allowReuse ? 'Turn off reuse' : 'Allow reuse'}
                      onClick={() => updateSettings({ allow_reuse: !allowReuse }).then(() => setMenuOpen(false))}
                    />
                    {post.type === 'post' && (
                      <MenuItem
                        icon={pinned ? PinOff : Pin}
                        label={pinned ? 'Unpin from your main grid' : 'Pin to your main grid'}
                        onClick={() => updateSettings({ is_pinned: !pinned }).then(() => setMenuOpen(false))}
                      />
                    )}
                    <div className="h-px bg-nebula-border my-1" />
                    <MenuItem icon={Trash2} label="Delete" onClick={remove} danger />
                  </div>
                </>
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
          <button onClick={() => setActiveModal('share')} className="flex items-center gap-1.5 group">
            <Send size={20} className="text-nebula-text group-hover:text-nebula-violet" strokeWidth={1.8} />
            {(!hideShareCount || isOwner) && shareCount > 0 && <span className="text-xs text-nebula-muted">{shareCount}</span>}
          </button>
          <button onClick={toggleSave} className="ml-auto">
            <Bookmark size={20} className={saved ? 'fill-nebula-star text-nebula-star' : 'text-nebula-text'} strokeWidth={1.8} />
          </button>
        </div>

        {(!hideLikeCount || isOwner) && (
          <p className="text-sm font-semibold mt-2">
            {likeCount} {likeCount === 1 ? 'like' : 'likes'}
            {hideLikeCount && isOwner && <span className="text-xs font-normal text-nebula-muted ml-1.5">(hidden from others)</span>}
          </p>
        )}

        {caption && (
          <p className="text-sm mt-1">
            <Link to={`/${post.author.username}`} className="font-medium mr-1.5">{post.author.username}</Link>
            {caption}
          </p>
        )}

        {commentsDisabled ? (
          <p className="text-xs text-nebula-muted mt-1">Comments are turned off for this post.</p>
        ) : post.commentCount > 0 && (
          <Link to={`/post/${post.id}`} className="text-sm text-nebula-muted mt-1 block">
            View all {post.commentCount} comment{post.commentCount === 1 ? '' : 's'}
          </Link>
        )}
      </div>

      {activeModal === 'edit' && (
        <Modal title="Edit post" onClose={() => setActiveModal(null)}>
          {settingsError && <p className="text-xs text-nebula-pink mb-2">{settingsError}</p>}
          <textarea className="input-field mb-3" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" />
          <input className="input-field mb-3" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Field" />
          <button onClick={saveEdit} className="btn-primary w-full py-2 text-sm">Save</button>
        </Modal>
      )}

      {activeModal === 'share' && (
        <SharePostModal
          postId={post.id}
          onClose={() => setActiveModal(null)}
          onShareCountChange={setShareCount}
        />
      )}

      {activeModal === 'qr' && (
        <Modal title="QR code" onClose={() => setActiveModal(null)}>
          <div className="flex flex-col items-center gap-3">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(postUrl)}`}
              alt="QR code linking to this post"
              className="w-56 h-56 rounded-lg bg-white p-2"
            />
            <p className="text-xs text-nebula-muted break-all text-center">{postUrl}</p>
          </div>
        </Modal>
      )}

      {activeModal === 'preview' && (
        <Modal title="Adjust preview" onClose={() => setActiveModal(null)}>
          <p className="text-xs text-nebula-muted mb-3">Choose which photo or video shows as the cover on your profile grid.</p>
          <div className="grid grid-cols-3 gap-2">
            {media.map((m, i) => (
              <button
                key={i}
                onClick={() => updateSettings({ cover_index: i })}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 ${coverIndex === i ? 'border-nebula-violet' : 'border-transparent'}`}
              >
                {m.media_type === 'video' ? (
                  <video src={mediaUrl(m.media_url)} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={mediaUrl(m.media_url)} className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {activeModal === 'insights' && (
        <Modal title="Insights" onClose={() => setActiveModal(null)}>
          {!insights ? (
            <p className="text-sm text-nebula-muted">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3 text-center"><p className="text-lg font-semibold">{insights.likes}</p><p className="eyebrow">Likes</p></div>
              <div className="card p-3 text-center"><p className="text-lg font-semibold">{insights.comments}</p><p className="eyebrow">Comments</p></div>
              <div className="card p-3 text-center"><p className="text-lg font-semibold">{insights.shares}</p><p className="eyebrow">Shares</p></div>
              <div className="card p-3 text-center"><p className="text-lg font-semibold">{insights.saves}</p><p className="eyebrow">Saves</p></div>
            </div>
          )}
        </Modal>
      )}
    </article>
  );
}
