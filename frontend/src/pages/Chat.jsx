import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SquarePen, Users, X, Search, Check, BadgeCheck } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

function ConversationRow({ conv, isRequest, onAccept, onDecline }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const title = conv.is_group ? conv.name : conv.other_user?.username || '[deleted]';
  const avatar = conv.is_group ? conv.avatar_url : conv.other_user?.avatar_url;
  const preview = conv.last_message
    ? (conv.last_message.sender_id === user.id ? 'You: ' : '') + conv.last_message.text
    : 'Say hello 👋';

  return (
    <div
      onClick={() => !isRequest && nav(`/chat/${conv.id}`)}
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isRequest ? '' : 'cursor-pointer hover:bg-nebula-surface'}`}
    >
      <div className="w-12 h-12 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
        {conv.is_group ? (
          avatar ? <img src={mediaUrl(avatar)} className="w-full h-full object-cover" /> : <Users size={20} className="text-nebula-muted" />
        ) : avatar ? (
          <img src={mediaUrl(avatar)} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display">{title?.[0]?.toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate flex items-center gap-1 ${conv.unread ? 'font-semibold text-nebula-text' : 'text-nebula-text'}`}>
          {title} {!conv.is_group && conv.other_user?.is_verified && <BadgeCheck size={13} className="text-nebula-cyan shrink-0" />}
        </p>
        <p className={`text-xs truncate ${conv.unread ? 'text-nebula-text' : 'text-nebula-muted'}`}>{preview}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {conv.last_message_at && (
          <span className="text-[11px] text-nebula-muted">{formatDistanceToNowStrict(new Date(conv.last_message_at))}</span>
        )}
        {conv.unread && !isRequest && <span className="w-2.5 h-2.5 rounded-full bg-nebula-violet" />}
      </div>
      {isRequest && (
        <div className="flex gap-2 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onAccept(conv.id); }} className="btn-primary px-3 py-1.5 text-xs">Accept</button>
          <button onClick={(e) => { e.stopPropagation(); onDecline(conv.id); }} className="btn-ghost px-3 py-1.5 text-xs">Delete</button>
        </div>
      )}
    </div>
  );
}

function NewChatModal({ onClose, onCreated }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) return setResults([]);
      const { data } = await api.get('/users/search', { params: { q } });
      setResults(data.users);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = (u) => {
    setSelected((sel) => (sel.some((s) => s.id === u.id) ? sel.filter((s) => s.id !== u.id) : [...sel, u]));
  };

  const startChat = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      if (selected.length === 1) {
        const { data } = await api.post('/chat/conversations', { user_id: selected[0].id });
        onCreated(data.conversation.id);
      } else {
        const { data } = await api.post('/chat/conversations/group', {
          name: selected.map((s) => s.username).join(', '),
          participant_ids: selected.map((s) => s.id),
        });
        onCreated(data.conversation.id);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Could not start chat.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07070df0] backdrop-blur-sm flex flex-col items-center pt-16 px-4" onClick={onClose}>
      <div className="w-full max-w-md card p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-nebula-border">
          <h2 className="font-display font-semibold">New message</h2>
          <button onClick={onClose}><X size={20} className="text-nebula-muted" /></button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {selected.map((s) => (
              <span key={s.id} onClick={() => toggle(s)} className="flex items-center gap-1 bg-nebula-surface border border-nebula-border rounded-full px-2.5 py-1 text-xs cursor-pointer">
                {s.username} <X size={12} />
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3">
          <Search size={16} className="text-nebula-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people…"
            className="bg-transparent outline-none flex-1 text-sm"
          />
        </div>

        <div className="max-h-[45vh] overflow-y-auto px-2 pb-2">
          {results.map((u) => {
            const isSelected = selected.some((s) => s.id === u.id);
            return (
              <div key={u.id} onClick={() => toggle(u)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-nebula-surface cursor-pointer">
                <div className="w-9 h-9 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
                  {u.avatar_url ? <img src={mediaUrl(u.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{u.username[0].toUpperCase()}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.username}</p>
                  <p className="text-xs text-nebula-muted truncate">{u.full_name}</p>
                </div>
                {isSelected && <Check size={16} className="text-nebula-violet shrink-0" />}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-nebula-border">
          <button onClick={startChat} disabled={selected.length === 0 || busy} className="btn-primary w-full py-2 text-sm">
            {busy ? 'Starting…' : selected.length > 1 ? `Create group (${selected.length})` : 'Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const [tab, setTab] = useState('messages');
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState(null);
  const nav = useNavigate();

  const load = useCallback(async () => {
    try {
      const [convRes, reqRes] = await Promise.all([
        api.get('/chat/conversations'),
        api.get('/chat/conversations/requests'),
      ]);
      setConversations(convRes.data.conversations);
      setRequests(reqRes.data.conversations);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const accept = async (id) => { await api.post(`/chat/conversations/${id}/accept`); load(); nav(`/chat/${id}`); };
  const decline = async (id) => { await api.post(`/chat/conversations/${id}/decline`); load(); };

  const list = tab === 'messages' ? conversations : requests;

  return (
    <div className="max-w-md mx-auto px-3 md:px-0">
      <div className="flex items-center justify-between py-3">
        <h1 className="font-display font-semibold text-lg">Messages</h1>
        <button onClick={() => setShowNew(true)} className="p-2 rounded-lg hover:bg-nebula-surface"><SquarePen size={20} /></button>
      </div>

      <div className="flex gap-1 border-b border-nebula-border mb-2">
        {['messages', 'requests'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize border-b-2 transition-colors ${tab === t ? 'border-nebula-violet text-nebula-text font-medium' : 'border-transparent text-nebula-muted'}`}
          >
            {t === 'requests' ? `Requests${requests.length ? ` (${requests.length})` : ''}` : 'Primary'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-nebula-muted py-10">Loading…</p>
      ) : error ? (
        <p className="text-center text-sm text-nebula-pink py-10">{error}</p>
      ) : list.length === 0 ? (
        <p className="text-center text-sm text-nebula-muted py-10">
          {tab === 'messages' ? 'No conversations yet. Tap the pencil to start one.' : 'No message requests.'}
        </p>
      ) : (
        <div className="space-y-0.5">
          {list.map((c) => (
            <ConversationRow key={c.id} conv={c} isRequest={tab === 'requests'} onAccept={accept} onDecline={decline} />
          ))}
        </div>
      )}

      {showNew && (
        <NewChatModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); nav(`/chat/${id}`); }}
        />
      )}
    </div>
  );
}
