import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Send, MoreVertical, Pencil, Trash2, Users, UserPlus, LogOut, X, Music, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

function GroupInfoPanel({ conv, onClose, onUpdated }) {
  const [name, setName] = useState(conv.name || '');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) return setResults([]);
      const { data } = await api.get('/users/search', { params: { q } });
      setResults(data.users.filter((u) => !conv.participant_ids.includes(u.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [q, conv.participant_ids]);

  const saveName = async () => {
    if (!name.trim() || name === conv.name) return;
    await api.put(`/chat/conversations/${conv.id}`, { name });
    onUpdated({ ...conv, name });
  };

  const addMember = async (u) => {
    await api.post(`/chat/conversations/${conv.id}/participants`, { user_ids: [u.id] });
    onUpdated({ ...conv, participant_ids: [...conv.participant_ids, u.id] });
    setQ(''); setResults([]); setAdding(false);
  };

  const leave = async () => {
    if (!confirm('Leave this group?')) return;
    await api.delete(`/chat/conversations/${conv.id}/participants/${JSON.parse(localStorage.getItem('cosmic_user')).id}`);
    window.location.href = '/chat';
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07070df0] backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xs h-full bg-nebula-bg border-l border-nebula-border p-4 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold">Group info</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {conv.isSelfAdmin && (
          <div className="mb-4">
            <label className="eyebrow block mb-1">Group name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} className="input-field w-full text-sm" />
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <span className="eyebrow">{conv.participant_ids.length} members</span>
          {conv.isSelfAdmin && (
            <button onClick={() => setAdding((a) => !a)} className="text-nebula-violet"><UserPlus size={18} /></button>
          )}
        </div>

        {adding && (
          <div className="mb-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search to add…" className="input-field w-full text-sm mb-2" />
            {results.map((u) => (
              <div key={u.id} onClick={() => addMember(u)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-nebula-surface cursor-pointer text-sm">
                {u.username}
              </div>
            ))}
          </div>
        )}

        <button onClick={leave} className="btn-ghost w-full py-2 text-sm flex items-center justify-center gap-2 mt-4 text-nebula-pink">
          <LogOut size={16} /> Leave group
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, isSelf, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.text || '');

  if (msg.deleted) {
    return <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} px-1`}><p className="text-xs italic text-nebula-muted py-1.5">Message deleted</p></div>;
  }

  const submitEdit = () => {
    if (draft.trim() && draft !== msg.text) onEdit(msg.id, draft.trim());
    setEditing(false);
  };

  return (
    <div className={`group flex ${isSelf ? 'justify-end' : 'justify-start'} px-1`}>
      <div className={`relative max-w-[75%] ${isSelf ? 'order-2' : ''}`}>
        {editing ? (
          <div className="flex gap-1.5 items-center">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitEdit()}
              className="input-field text-sm py-1.5"
            />
            <button onClick={submitEdit} className="text-xs text-nebula-violet">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-nebula-muted">Cancel</button>
          </div>
        ) : (
          <div className={`rounded-2xl px-3.5 py-2 text-sm ${isSelf ? 'bg-nebula-violet text-white' : 'bg-nebula-surface border border-nebula-border'}`}>
            {msg.song && (
              <div className="flex items-center gap-2 mb-1.5 bg-black/20 rounded-lg p-2">
                {msg.song.image ? <img src={msg.song.image} className="w-8 h-8 rounded object-cover" /> : <Music size={16} />}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{msg.song.title}</p>
                  <p className="text-[10px] opacity-80 truncate">{msg.song.artist}</p>
                </div>
              </div>
            )}
            {msg.song && <audio controls src={msg.song.audio_url} className="w-full h-8 mb-1" />}
            {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
            {msg.edited_at && <span className="text-[10px] opacity-60 ml-1">(edited)</span>}
          </div>
        )}
        <p className={`text-[10px] text-nebula-muted mt-0.5 ${isSelf ? 'text-right' : ''}`}>{format(new Date(msg.created_at), 'p')}</p>
      </div>

      {isSelf && !editing && (
        <div className="relative self-center opacity-0 group-hover:opacity-100 transition-opacity mx-1">
          <button onClick={() => setMenuOpen((o) => !o)}><MoreVertical size={14} className="text-nebula-muted" /></button>
          {menuOpen && (
            <div className="absolute right-0 top-5 z-10 card p-1 w-32 text-xs">
              <button onClick={() => { setEditing(true); setMenuOpen(false); }} className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-nebula-surface"><Pencil size={13} /> Edit</button>
              <button onClick={() => { onDelete(msg.id); setMenuOpen(false); }} className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-nebula-surface text-nebula-pink"><Trash2 size={13} /> Delete</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const lastLoadedAt = useRef(null);

  const load = useCallback(async (silent) => {
    try {
      const [convRes, msgRes] = await Promise.all([
        api.get(`/chat/conversations/${id}`),
        api.get(`/chat/conversations/${id}/messages`),
      ]);
      setConv(convRes.data.conversation);
      setMessages(msgRes.data.messages);
      api.put(`/chat/conversations/${id}/read`).catch(() => {});
    } catch (err) {
      if (!silent) nav('/chat');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, nav]);

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    const { data } = await api.post(`/chat/conversations/${id}/messages`, { text: trimmed });
    setMessages((m) => [...m, data.message]);
  };

  const editMsg = async (msgId, newText) => {
    await api.put(`/chat/conversations/${id}/messages/${msgId}`, { text: newText });
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, text: newText, edited_at: new Date().toISOString() } : x)));
  };

  const deleteMsg = async (msgId) => {
    await api.delete(`/chat/conversations/${id}/messages/${msgId}`);
    setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, deleted: true } : x)));
  };

  if (loading || !conv) return <p className="text-center text-sm text-nebula-muted py-10">Loading…</p>;

  const title = conv.is_group ? conv.name : conv.other_user?.username || '[deleted]';
  const isPendingForMe = conv.status === 'pending' && conv.initiator_id !== user.id;

  return (
    <div className="max-w-md mx-auto flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-nebula-border">
        <button onClick={() => nav('/chat')}><ArrowLeft size={20} /></button>
        {conv.is_group ? (
          <div className="w-9 h-9 rounded-full bg-nebula-surface border border-nebula-border flex items-center justify-center"><Users size={16} /></div>
        ) : (
          <Link to={`/${title}`} className="w-9 h-9 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center">
            {conv.other_user?.avatar_url ? <img src={mediaUrl(conv.other_user.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{title?.[0]?.toUpperCase()}</span>}
          </Link>
        )}
        <p className="font-medium text-sm flex-1 truncate flex items-center gap-1">
          {title} {!conv.is_group && conv.other_user?.is_verified && <BadgeCheck size={14} className="text-nebula-cyan shrink-0" />}
        </p>
        {conv.is_group && <button onClick={() => setShowInfo(true)}><MoreVertical size={20} className="text-nebula-muted" /></button>}
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} isSelf={m.sender_id === user.id} onEdit={editMsg} onDelete={deleteMsg} />
        ))}
        <div ref={endRef} />
      </div>

      {isPendingForMe ? (
        <div className="p-3 border-t border-nebula-border flex gap-2">
          <button
            onClick={async () => { await api.post(`/chat/conversations/${id}/accept`); load(false); }}
            className="btn-primary flex-1 py-2 text-sm"
          >
            Accept request
          </button>
          <button
            onClick={async () => { await api.post(`/chat/conversations/${id}/decline`); nav('/chat'); }}
            className="btn-ghost flex-1 py-2 text-sm"
          >
            Delete
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-nebula-border">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            className="input-field flex-1 text-sm"
          />
          <button type="submit" className="btn-primary p-2.5"><Send size={16} /></button>
        </form>
      )}

      {showInfo && conv.is_group && (
        <GroupInfoPanel conv={conv} onClose={() => setShowInfo(false)} onUpdated={setConv} />
      )}
    </div>
  );
}
