import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, Search } from 'lucide-react';
import api, { mediaUrl } from '../api';

export default function SearchPanel({ onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
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

  return (
    <div className="fixed inset-0 z-50 bg-void/94 backdrop-blur-sm flex flex-col items-center pt-20 px-4" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 card px-3 py-2.5">
          <Search size={18} className="text-nebula-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people by name or username…"
            className="bg-transparent outline-none flex-1 text-sm"
          />
          <button onClick={onClose}><X size={18} className="text-nebula-muted" /></button>
        </div>

        <div className="mt-3 space-y-1 max-h-[60vh] overflow-y-auto">
          {results.map((u) => (
            <Link
              key={u.id}
              to={`/${u.username}`}
              onClick={onClose}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-nebula-surface transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
                {u.avatar_url ? <img src={mediaUrl(u.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-sm font-display">{u.username[0].toUpperCase()}</span>}
              </div>
              <div>
                <p className="text-sm font-medium">{u.username}</p>
                <p className="text-xs text-nebula-muted">{u.full_name}</p>
              </div>
            </Link>
          ))}
          {q.trim() && results.length === 0 && (
            <p className="text-center text-sm text-nebula-muted py-8">No one out there by that name yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
