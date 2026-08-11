import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, CornerDownRight, Trash2 } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

function Comment({ c, postId, onDeleted }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(c.likedByViewer);
  const [likeCount, setLikeCount] = useState(c.likeCount);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyCount, setReplyCount] = useState(c.replyCount);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    try {
      if (next) await api.post(`/comments/${c.id}/like`);
      else await api.delete(`/comments/${c.id}/like`);
    } catch (e) {}
  };

  const loadReplies = async () => {
    if (showReplies) { setShowReplies(false); return; }
    const { data } = await api.get(`/comments/${c.id}/replies`);
    setReplies(data.comments);
    setShowReplies(true);
  };

  const submitReply = async () => {
    if (!replyText.trim()) return;
    const { data } = await api.post(`/comments/post/${postId}`, { content: replyText, parent_id: c.id });
    setReplies((r) => [...r, data.comment]);
    setReplyCount((n) => n + 1);
    setReplyText('');
    setReplying(false);
    setShowReplies(true);
  };

  const remove = async () => {
    if (!confirm('Delete this comment?')) return;
    await api.delete(`/comments/${c.id}`);
    onDeleted(c.id);
  };

  const timeAgo = formatDistanceToNowStrict(new Date(c.created_at), { addSuffix: false });

  return (
    <div className="py-2.5">
      <div className="flex gap-2.5">
        <Link to={`/${c.author.username}`} className="w-8 h-8 rounded-full bg-nebula-bg border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
          {c.author.avatar_url ? <img src={mediaUrl(c.author.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{c.author.username[0].toUpperCase()}</span>}
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <Link to={`/${c.author.username}`} className="font-medium mr-1.5">{c.author.username}</Link>
            {c.content}
          </p>
          <div className="flex items-center gap-3 mt-1 eyebrow">
            <span>{timeAgo} ago</span>
            {likeCount > 0 && <span>{likeCount} like{likeCount === 1 ? '' : 's'}</span>}
            <button onClick={() => setReplying((v) => !v)} className="hover:text-nebula-violet">Reply</button>
            {c.author.id === user?.id && (
              <button onClick={remove} className="hover:text-nebula-pink"><Trash2 size={12} /></button>
            )}
          </div>

          {replying && (
            <div className="flex items-center gap-2 mt-2">
              <input
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitReply()}
                placeholder={`Reply to ${c.author.username}…`}
                className="input-field text-xs py-1.5"
              />
              <button onClick={submitReply} className="text-xs text-nebula-violet font-medium shrink-0">Post</button>
            </div>
          )}

          {replyCount > 0 && (
            <button onClick={loadReplies} className="flex items-center gap-1 mt-2 eyebrow text-nebula-muted hover:text-nebula-violet">
              <CornerDownRight size={12} /> {showReplies ? 'Hide' : 'View'} {replyCount} repl{replyCount === 1 ? 'y' : 'ies'}
            </button>
          )}

          {showReplies && (
            <div className="pl-3 border-l border-nebula-border mt-2 space-y-2">
              {replies.map((r) => <Comment key={r.id} c={r} postId={postId} onDeleted={(id) => setReplies((rs) => rs.filter((x) => x.id !== id))} />)}
            </div>
          )}
        </div>
        <button onClick={toggleLike} className="pt-1">
          <Heart size={13} className={liked ? 'fill-nebula-pink text-nebula-pink' : 'text-nebula-muted'} />
        </button>
      </div>
    </div>
  );
}

export default function CommentSection({ postId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/comments/post/${postId}`).then(({ data }) => {
      setComments(data.comments);
      setLoading(false);
    });
  }, [postId]);

  const submit = async () => {
    if (!text.trim()) return;
    const { data } = await api.post(`/comments/post/${postId}`, { content: text });
    setComments((c) => [...c, data.comment]);
    setText('');
  };

  return (
    <div>
      <div className="divide-y divide-nebula-border/60">
        {loading && <p className="text-sm text-nebula-muted py-4">Loading discussion…</p>}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-nebula-muted py-6 text-center">No one has weighed in yet — be the first to discuss this problem.</p>
        )}
        {comments.map((c) => (
          <Comment key={c.id} c={c} postId={postId} onDeleted={(id) => setComments((cs) => cs.filter((x) => x.id !== id))} />
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-nebula-border pt-3 mt-1 sticky bottom-0 bg-nebula-surface">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Add to the discussion…"
          className="input-field"
        />
        <button onClick={submit} disabled={!text.trim()} className="btn-primary px-4 py-2 text-sm shrink-0">Post</button>
      </div>
    </div>
  );
}
