import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Search, BadgeCheck, ChevronLeft } from 'lucide-react';
import api, { mediaUrl } from '../api';

const RECENTS_KEY = 'cp-recent-searches';
const MAX_RECENTS = 8;

function loadRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveRecents(list) {
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS))); } catch (e) {}
}

export default function SearchPanel({ onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [recents, setRecents] = useState(loadRecents);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      try {
        const { data } = await api.get('/users/search', { params: { q } });
        setResults(data.users);
      } catch (e) {}
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const addRecentUser = (u) => {
    const entry = { type: 'user', id: u.id, username: u.username, full_name: u.full_name, avatar_url: u.avatar_url, is_verified: u.is_verified };
    const next = [entry, ...recents.filter((r) => !(r.type === 'user' && r.id === u.id))].slice(0, MAX_RECENTS);
    setRecents(next);
    saveRecents(next);
  };

  const addRecentQuery = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry = { type: 'query', text: trimmed };
    const next = [entry, ...recents.filter((r) => !(r.type === 'query' && r.text.toLowerCase() === trimmed.toLowerCase()))].slice(0, MAX_RECENTS);
    setRecents(next);
    saveRecents(next);
  };

  const removeRecent = (i) => {
    const next = recents.filter((_, idx) => idx !== i);
    setRecents(next);
    saveRecents(next);
  };

  const clearRecents = () => { setRecents([]); saveRecents([]); };

  const goToQuery = (text) => {
    addRecentQuery(text);
    onClose();
    navigate('/explore');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (results.length) {
      addRecentUser(results[0]);
      onClose();
      navigate(`/${results[0].username}`);
    } else if (q.trim()) {
      goToQuery(q);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-nebula-bg flex flex-col">
      {/* Header: search field + cancel, Instagram-style */}
      <form onSubmit={handleSubmit} className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2.5 border-b border-nebula-border">
        <button type="button" onClick={onClose} className="p-1 -ml-1 text-nebula-text md:hidden">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 flex items-center gap-2 input-field px-3 py-2">
          <Search size={16} className="text-nebula-muted shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="bg-transparent outline-none flex-1 text-sm min-w-0"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="shrink-0">
              <X size={15} className="text-nebula-muted" />
            </button>
          )}
        </div>
        <button type="button" onClick={onClose} className="hidden md:block text-sm font-medium text-nebula-text px-1 shrink-0">
          Cancel
        </button>
      </form>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto">
          {/* Empty state: recent searches, Instagram-style rows */}
          {!q.trim() && (
            <div className="pt-1">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-semibold">Recent</span>
                {recents.length > 0 && (
                  <button onClick={clearRecents} className="text-xs font-medium text-nebula-violet">Clear all</button>
                )}
              </div>

              {recents.length === 0 && (
                <p className="text-center text-sm text-nebula-muted py-10 px-6">
                  Search for people, or type a field of interest to jump into Explore.
                </p>
              )}

              {recents.map((r, i) => (
                r.type === 'user' ? (
                  <Link
                    key={`u-${r.id}`}
                    to={`/${r.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-nebula-surface transition-colors"
                  >
                    <div className="w-11 h-11 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
                      {r.avatar_url ? <img src={mediaUrl(r.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-sm font-display">{r.username[0].toUpperCase()}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium flex items-center gap-1 truncate">
                        {r.username}
                        {r.is_verified && <BadgeCheck size={13} className="text-nebula-cyan shrink-0" fill="currentColor" fillOpacity={0.15} />}
                      </p>
                      <p className="text-xs text-nebula-muted truncate">{r.full_name}</p>
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeRecent(i); }}
                      className="shrink-0 p-1"
                    >
                      <X size={15} className="text-nebula-muted" />
                    </button>
                  </Link>
                ) : (
                  <button
                    key={`q-${r.text}-${i}`}
                    onClick={() => goToQuery(r.text)}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-nebula-surface transition-colors text-left"
                  >
                    <div className="w-11 h-11 rounded-full bg-nebula-surface flex items-center justify-center shrink-0">
                      <Search size={16} className="text-nebula-muted" />
                    </div>
                    <span className="text-sm flex-1 truncate">{r.text}</span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); removeRecent(i); }}
                      className="shrink-0 p-1"
                    >
                      <X size={15} className="text-nebula-muted" />
                    </span>
                  </button>
                )
              ))}
            </div>
          )}

          {/* Live results */}
          {q.trim() && (
            <div className="pt-1 pb-4">
              {results.map((u) => (
                <Link
                  key={u.id}
                  to={`/${u.username}`}
                  onClick={() => { addRecentUser(u); onClose(); }}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-nebula-surface transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
                    {u.avatar_url ? <img src={mediaUrl(u.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-sm font-display">{u.username[0].toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium flex items-center gap-1 truncate">
                      {u.username}
                      {u.is_verified && <BadgeCheck size={13} className="text-nebula-cyan shrink-0" fill="currentColor" fillOpacity={0.15} />}
                    </p>
                    <p className="text-xs text-nebula-muted truncate">{u.full_name}</p>
                  </div>
                </Link>
              ))}

              {results.length === 0 && (
                <p className="text-center text-sm text-nebula-muted py-8 px-6">No one out there by that name yet.</p>
              )}

              {/* "See all results for ..." row, Instagram-style */}
              <button
                onClick={() => goToQuery(q)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-nebula-surface transition-colors text-left border-t border-nebula-border mt-1"
              >
                <div className="w-11 h-11 rounded-full bg-nebula-surface flex items-center justify-center shrink-0">
                  <Search size={16} className="text-nebula-muted" />
                </div>
                <span className="text-sm text-nebula-muted">
                  See all results for "<span className="text-nebula-text font-medium">{q}</span>"
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
