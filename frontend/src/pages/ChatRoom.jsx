import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Send, MoreVertical, Pencil, Trash2, Users, UserPlus, LogOut, X, Music, BadgeCheck, Phone, Video, ShieldOff, Ban, Search, BellOff, Bell, Palette, Timer, Shield, UserCog, ChevronRight, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useCall } from '../context/CallContext.jsx';

function DirectChatMenu({ conv, onClose, onRestrictToggled, onBlocked, onDeleted }) {
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleRestrict = async () => {
    setBusy(true);
    try {
      if (conv.is_restricted) await api.delete(`/chat/conversations/${conv.id}/restrict`);
      else await api.post(`/chat/conversations/${conv.id}/restrict`);
      onRestrictToggled(!conv.is_restricted);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const doBlock = async () => {
    setBusy(true);
    try {
      await api.post(`/users/${conv.other_user.id}/block`);
      onBlocked();
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/chat/conversations/${conv.id}`);
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute right-0 top-9 z-20 card p-1 w-48 text-sm" onClick={(e) => e.stopPropagation()}>
      {confirmBlock ? (
        <div className="p-2">
          <p className="text-xs text-nebula-muted mb-2">Block {conv.other_user?.username}? They won't be able to message or follow you.</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={doBlock} className="btn-primary flex-1 py-1.5 text-xs bg-nebula-pink border-nebula-pink">Block</button>
            <button disabled={busy} onClick={() => setConfirmBlock(false)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      ) : confirmDelete ? (
        <div className="p-2">
          <p className="text-xs text-nebula-muted mb-2">Delete this conversation? This can't be undone.</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={doDelete} className="btn-primary flex-1 py-1.5 text-xs bg-nebula-pink border-nebula-pink">Delete</button>
            <button disabled={busy} onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <button disabled={busy} onClick={toggleRestrict} className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-nebula-surface text-left">
            <ShieldOff size={15} /> {conv.is_restricted ? 'Unrestrict' : 'Restrict'}
          </button>
          <button disabled={busy} onClick={() => setConfirmBlock(true)} className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-nebula-surface text-left text-nebula-pink">
            <Ban size={15} /> Block
          </button>
          <button disabled={busy} onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-nebula-surface text-left text-nebula-pink">
            <Trash2 size={15} /> Delete
          </button>
        </>
      )}
    </div>
  );
}

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
    <div className="fixed inset-0 z-50 bg-void/94 backdrop-blur-sm flex justify-end" onClick={onClose}>
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

// Slide-over "contact info" panel for a direct chat — opened from tapping
// the peer's name in the chat header. Groups the everyday actions (view
// profile, search this chat, mute, block/restrict/delete) the way a
// familiar messaging app's contact-info screen does.
function ContactInfoPanel({ conv, onClose, onRestrictToggled, onBlocked, onDeleted, onMuteToggled }) {
  const nav = useNavigate();
  const peerUser = conv.other_user;
  const title = peerUser?.username || '[deleted]';
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleRestrict = async () => {
    setBusy(true);
    try {
      if (conv.is_restricted) await api.delete(`/chat/conversations/${conv.id}/restrict`);
      else await api.post(`/chat/conversations/${conv.id}/restrict`);
      onRestrictToggled(!conv.is_restricted);
    } finally { setBusy(false); }
  };

  const toggleMute = async () => {
    setBusy(true);
    try {
      if (conv.is_muted) await api.delete(`/chat/conversations/${conv.id}/mute`);
      else await api.post(`/chat/conversations/${conv.id}/mute`);
      onMuteToggled(!conv.is_muted);
    } finally { setBusy(false); }
  };

  const doBlock = async () => {
    setBusy(true);
    try { await api.post(`/users/${peerUser.id}/block`); onBlocked(); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try { await api.delete(`/chat/conversations/${conv.id}`); onDeleted(); } finally { setBusy(false); }
  };

  const Row = ({ icon: Icon, label, sub, onClick, danger, disabled }) => (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-3 w-full py-3 text-left disabled:opacity-50">
      <Icon size={18} className={danger ? 'text-nebula-pink' : 'text-nebula-muted'} />
      <span className="flex-1 min-w-0">
        <p className={`text-sm ${danger ? 'text-nebula-pink' : ''}`}>{label}</p>
        {sub && <p className="text-xs text-nebula-muted">{sub}</p>}
      </span>
      <ChevronRight size={16} className="text-nebula-muted" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-void/94 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xs h-full bg-nebula-bg border-l border-nebula-border overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end p-3"><button onClick={onClose}><X size={20} /></button></div>

        <div className="flex flex-col items-center px-4 pb-4">
          <Link to={`/${title}`} onClick={onClose} className="w-24 h-24 rounded-full bg-nebula-surface border-2 border-nebula-border overflow-hidden flex items-center justify-center mb-3">
            {peerUser?.avatar_url ? <img src={mediaUrl(peerUser.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-2xl font-display">{title?.[0]?.toUpperCase()}</span>}
          </Link>
          <p className="font-display font-semibold flex items-center gap-1">{title} {peerUser?.is_verified && <BadgeCheck size={15} className="text-nebula-cyan" />}</p>

          <div className="flex items-center justify-around w-full mt-4 text-center">
            <Link to={`/${title}`} onClick={onClose} className="flex flex-col items-center gap-1 text-xs text-nebula-muted">
              <span className="w-10 h-10 rounded-full bg-nebula-surface border border-nebula-border flex items-center justify-center"><UserIcon size={16} /></span>
              Profile
            </Link>
            <div className="flex flex-col items-center gap-1 text-xs text-nebula-muted opacity-50">
              <span className="w-10 h-10 rounded-full bg-nebula-surface border border-nebula-border flex items-center justify-center"><Search size={16} /></span>
              Search
            </div>
            <button onClick={toggleMute} disabled={busy} className="flex flex-col items-center gap-1 text-xs text-nebula-muted">
              <span className="w-10 h-10 rounded-full bg-nebula-surface border border-nebula-border flex items-center justify-center">
                {conv.is_muted ? <Bell size={16} /> : <BellOff size={16} />}
              </span>
              {conv.is_muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </div>

        <div className="px-4 divide-y divide-nebula-border/60 border-t border-nebula-border">
          <Row icon={Palette} label="Customize" sub="Theme and font" disabled />
          <Row icon={Timer} label="Disappearing messages" sub="Off" disabled />
          <Row icon={ShieldOff} label={conv.is_restricted ? 'Unrestrict' : 'Restrict'} onClick={toggleRestrict} disabled={busy} />
          <Row icon={Shield} label="Privacy & safety" disabled />
          <Row icon={UserCog} label="Nicknames" disabled />
          <Row icon={Users} label="Create a group chat" onClick={() => nav('/chat?new=group')} />
          <Row icon={Ban} label="Block" danger onClick={() => setConfirmBlock(true)} />
          <Row icon={Trash2} label="Delete chat" danger onClick={() => setConfirmDelete(true)} />
        </div>

        {confirmBlock && (
          <div className="p-4 mx-4 mt-3 card">
            <p className="text-xs text-nebula-muted mb-2">Block {title}? They won't be able to message or follow you.</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={doBlock} className="btn-primary flex-1 py-1.5 text-xs bg-nebula-pink border-nebula-pink">Block</button>
              <button disabled={busy} onClick={() => setConfirmBlock(false)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
            </div>
          </div>
        )}
        {confirmDelete && (
          <div className="p-4 mx-4 mt-3 card">
            <p className="text-xs text-nebula-muted mb-2">Delete this conversation? This can't be undone.</p>
            <div className="flex gap-2">
              <button disabled={busy} onClick={doDelete} className="btn-primary flex-1 py-1.5 text-xs bg-nebula-pink border-nebula-pink">Delete</button>
              <button disabled={busy} onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 py-1.5 text-xs">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ msg, isSelf, onEdit, onDelete, seenText }) {
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
            {msg.post && (
              <Link
                to={`/post/${msg.post.id}`}
                className={`block mb-1.5 rounded-xl overflow-hidden border ${isSelf ? 'border-white/20' : 'border-nebula-border'} bg-black/20 max-w-[200px]`}
              >
                {msg.post.cover_url && (
                  <div className="w-full aspect-square bg-black">
                    {msg.post.media_type === 'video' ? (
                      <video src={mediaUrl(msg.post.cover_url)} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={mediaUrl(msg.post.cover_url)} className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
                <div className="px-2 py-1.5">
                  <p className="text-[10px] opacity-80">Post from @{msg.post.author_username}</p>
                  {msg.post.caption && <p className="text-xs truncate mt-0.5">{msg.post.caption}</p>}
                </div>
              </Link>
            )}
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
        {seenText && <p className="text-[10px] text-nebula-violet text-right mt-0.5">{seenText}</p>}
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
  const callCtx = useCall();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const endRef = useRef(null);
  const lastLoadedAt = useRef(null);

  const showToast = (msg) => {
    clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  };

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
      // 404/403 means the conversation genuinely isn't accessible — leave.
      // Anything else (e.g. a backend/500 error) should be shown, not hidden.
      const status = err.response?.status;
      if (status === 404 || status === 403) {
        if (!silent) nav('/chat');
      } else {
        setError(err.response?.data?.error || 'Could not load this conversation.');
      }
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

  // "Seen" indicator: attaches to the most recent message I sent, shown once
  // every other participant's last_read catches up to (or passes) it.
  const seenInfo = React.useMemo(() => {
    if (!conv) return null;
    let lastMine = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === user.id && !messages[i].deleted) { lastMine = messages[i]; break; }
    }
    if (!lastMine) return null;
    const lastRead = conv.last_read || {};

    if (conv.is_group) {
      const others = (conv.participant_ids || []).filter((pid) => pid !== user.id);
      const seenBy = others.filter((pid) => lastRead[pid] && lastRead[pid] >= lastMine.created_at);
      if (!seenBy.length) return null;
      return { messageId: lastMine.id, text: seenBy.length === others.length ? 'Seen by everyone' : `Seen by ${seenBy.length}` };
    }

    const otherId = conv.other_user?.id;
    if (!otherId || !(lastRead[otherId] && lastRead[otherId] >= lastMine.created_at)) return null;
    return { messageId: lastMine.id, text: 'Seen' };
  }, [messages, conv, user.id]);

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

  const placeCall = (type) => {
    if (!conv?.other_user) return;
    if (!callCtx) { showToast('Calling is unavailable right now.'); return; }
    if (callCtx.callStatus !== 'idle') { showToast('You are already on a call.'); return; }
    callCtx.startCall(conv.id, conv.other_user, type);
  };

  if (error) {
    return (
      <div className="max-w-md mx-auto px-3 py-10 text-center">
        <p className="text-sm text-nebula-pink mb-3">{error}</p>
        <button onClick={() => nav('/chat')} className="btn-ghost px-4 py-2 text-sm">Back to messages</button>
      </div>
    );
  }

  if (loading || !conv) return <p className="text-center text-sm text-nebula-muted py-10">Loading…</p>;

  const title = conv.is_group ? conv.name : conv.other_user?.username || '[deleted]';
  const isPendingForMe = conv.status === 'pending' && conv.initiator_id !== user.id;

  return (
    <div className="max-w-md mx-auto flex flex-col h-[calc(100dvh-7.5rem)] md:h-[calc(100vh-6rem)]">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-3 py-2.5 border-b border-nebula-border bg-nebula-bg shrink-0">
        <button onClick={() => nav('/chat')}><ArrowLeft size={20} /></button>
        {conv.is_group ? (
          <button onClick={() => setShowInfo(true)} className="w-9 h-9 rounded-full bg-nebula-surface border border-nebula-border flex items-center justify-center shrink-0"><Users size={16} /></button>
        ) : (
          <button onClick={() => setShowContactInfo(true)} className="w-9 h-9 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
            {conv.other_user?.avatar_url ? <img src={mediaUrl(conv.other_user.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{title?.[0]?.toUpperCase()}</span>}
          </button>
        )}
        <button
          onClick={() => (conv.is_group ? setShowInfo(true) : setShowContactInfo(true))}
          className="font-medium text-sm flex-1 truncate flex items-center gap-1 text-left"
        >
          {title} {!conv.is_group && conv.other_user?.is_verified && <BadgeCheck size={14} className="text-nebula-cyan shrink-0" />}
          {!conv.is_group && conv.is_restricted && (
            <span className="text-[10px] font-normal text-nebula-muted border border-nebula-border rounded-full px-1.5 py-0.5 shrink-0">Restricted</span>
          )}
        </button>
        {!conv.is_group && (
          <div className="relative flex items-center gap-3 shrink-0">
            <button onClick={() => placeCall('audio')} className="text-nebula-text" aria-label="Audio call"><Phone size={19} /></button>
            <button onClick={() => placeCall('video')} className="text-nebula-text" aria-label="Video call"><Video size={20} /></button>
            <button onClick={() => setShowMenu((m) => !m)} aria-label="More options"><MoreVertical size={20} className="text-nebula-muted" /></button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <DirectChatMenu
                  conv={conv}
                  onClose={() => setShowMenu(false)}
                  onRestrictToggled={(is_restricted) => { setConv((c) => ({ ...c, is_restricted })); showToast(is_restricted ? 'Conversation restricted' : 'Conversation unrestricted'); }}
                  onBlocked={() => { setShowMenu(false); nav('/chat'); }}
                  onDeleted={() => { setShowMenu(false); nav('/chat'); }}
                />
              </>
            )}
          </div>
        )}
        {conv.is_group && <button onClick={() => setShowInfo(true)}><MoreVertical size={20} className="text-nebula-muted" /></button>}
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            isSelf={m.sender_id === user.id}
            onEdit={editMsg}
            onDelete={deleteMsg}
            seenText={seenInfo && seenInfo.messageId === m.id ? seenInfo.text : null}
          />
        ))}
        <div ref={endRef} />
      </div>

      {isPendingForMe ? (
        <div className="p-3 border-t border-nebula-border flex gap-2 shrink-0">
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
        <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-nebula-border shrink-0">
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

      {showContactInfo && !conv.is_group && (
        <ContactInfoPanel
          conv={conv}
          onClose={() => setShowContactInfo(false)}
          onRestrictToggled={(is_restricted) => { setConv((c) => ({ ...c, is_restricted })); showToast(is_restricted ? 'Conversation restricted' : 'Conversation unrestricted'); }}
          onMuteToggled={(is_muted) => { setConv((c) => ({ ...c, is_muted })); showToast(is_muted ? 'Notifications muted' : 'Notifications unmuted'); }}
          onBlocked={() => { setShowContactInfo(false); nav('/chat'); }}
          onDeleted={() => { setShowContactInfo(false); nav('/chat'); }}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur text-xs text-white px-4 py-2 rounded-full">
          {toast}
        </div>
      )}
    </div>
  );
}
