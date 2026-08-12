import React, { useState, useEffect } from 'react';
import { X, Search, Check, BadgeCheck, Send, Link2 } from 'lucide-react';
import api, { mediaUrl } from '../api';

// "Share to..." sheet opened from a post's Send button — pick one or more
// friends (recent DM contacts, or search anyone), add an optional note, and
// drop the post straight into their message threads.
export default function SharePostModal({ postId, onClose, onShareCountChange }) {
  const [recent, setRecent] = useState([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null); // null = not searching, [] = no matches
  const [selected, setSelected] = useState([]); // [{id, username, avatar_url}]
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState(null); // Set of ids once sent
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/chat/conversations').then(({ data }) => {
      const people = (data.conversations || [])
        .filter((c) => !c.is_group && c.other_user)
        .map((c) => c.other_user);
      setRecent(people);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults(null); return; }
      try {
        const { data } = await api.get('/users/search', { params: { q } });
        setResults(data.users || []);
      } catch (e) { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = (u) => {
    setSelected((s) => (s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));
  };

  const send = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await api.post('/chat/share-post', {
        post_id: postId,
        user_ids: selected.map((u) => u.id),
        message: note.trim(),
      });
      const ok = new Set((data.results || []).filter((r) => r.ok).map((r) => r.user_id));
      const failed = (data.results || []).filter((r) => !r.ok);
      if (ok.size) { setSentTo(ok); if (typeof data.shareCount === 'number') onShareCountChange?.(data.shareCount); }
      if (failed.length && ok.size === 0) setError('Could not send to the selected people.');
      else if (failed.length) setError(`Sent, but ${failed.length} could not receive it.`);
      if (ok.size) setTimeout(onClose, 1100);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not share this post.');
    } finally {
      setSending(false);
    }
  };

  const list = q.trim() ? (results || []) : recent;

  const copyLink = async () => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.share) await navigator.share({ url: postUrl });
      else await navigator.clipboard.writeText(postUrl);
    } catch (e) { /* user cancelled */ }
    try {
      const { data } = await api.post(`/posts/${postId}/share`);
      onShareCountChange?.(data.shareCount);
    } catch (e) { /* share tracking is best-effort */ }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-nebula-border shrink-0">
          <h3 className="text-sm font-semibold">Share to…</h3>
          <div className="flex items-center gap-3">
            <button onClick={copyLink} className="text-nebula-muted hover:text-white" aria-label="Copy link"><Link2 size={16} /></button>
            <button onClick={onClose} className="text-nebula-muted hover:text-white"><X size={16} /></button>
          </div>
        </div>

        <div className="px-4 pt-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nebula-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search friends…"
              className="input-field w-full text-sm pl-8"
            />
          </div>
        </div>

        {selected.length > 0 && (
          <div className="px-4 pt-2.5 flex flex-wrap gap-1.5 shrink-0">
            {selected.map((u) => (
              <span key={u.id} onClick={() => toggle(u)} className="flex items-center gap-1 bg-nebula-surface border border-nebula-border rounded-full pl-1 pr-2 py-0.5 text-xs cursor-pointer">
                <span className="w-4 h-4 rounded-full bg-nebula-bg overflow-hidden flex items-center justify-center">
                  {u.avatar_url ? <img src={mediaUrl(u.avatar_url)} className="w-full h-full object-cover" /> : u.username?.[0]?.toUpperCase()}
                </span>
                {u.username} <X size={10} />
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {list.length === 0 ? (
            <p className="text-xs text-nebula-muted text-center py-6">
              {q.trim() ? 'No one found.' : 'No recent chats — search to find someone.'}
            </p>
          ) : (
            list.map((u) => {
              const isSelected = selected.some((x) => x.id === u.id);
              return (
                <div key={u.id} onClick={() => toggle(u)} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-nebula-surface cursor-pointer">
                  <div className="w-9 h-9 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
                    {u.avatar_url ? <img src={mediaUrl(u.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{u.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <span className="text-sm flex-1 truncate flex items-center gap-1">
                    {u.username} {u.is_verified && <BadgeCheck size={13} className="text-nebula-cyan" />}
                  </span>
                  {sentTo?.has(u.id) ? (
                    <span className="text-[10px] text-nebula-muted">Sent</span>
                  ) : (
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'bg-nebula-violet border-nebula-violet' : 'border-nebula-border'}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-nebula-border shrink-0">
          {error && <p className="text-xs text-nebula-pink mb-2">{error}</p>}
          {sentTo && !error && <p className="text-xs text-nebula-cyan mb-2">Sent!</p>}
          <div className="flex items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write a message…"
              className="input-field flex-1 text-sm"
            />
            <button
              onClick={send}
              disabled={!selected.length || sending}
              className="btn-primary px-3 py-2.5 disabled:opacity-50"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
