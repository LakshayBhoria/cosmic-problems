import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import api, { mediaUrl } from '../api';

export default function Followers({ mode }) {
  const { username } = useParams();
  const nav = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    (async () => {
      try {
        const { data: profileData } = await api.get(`/users/${username}`);
        const { data } = await api.get(`/users/${profileData.user.id}/${mode}`);
        setUsers(data.users);
      } catch (e) {
        setError(e.response?.data?.error || 'Could not load this list.');
      } finally {
        setLoading(false);
      }
    })();
  }, [username, mode]);

  return (
    <div className="max-w-sm mx-auto px-4 pt-6 pb-16">
      <button onClick={() => nav(-1)} className="flex items-center gap-1.5 text-sm text-nebula-muted mb-4 hover:text-white">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="font-display text-lg font-semibold mb-4 capitalize">{mode}</h1>

      {loading && <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-nebula-violet border-t-transparent animate-spin" /></div>}

      {!loading && error && (
        <div className="text-center py-16">
          <Lock size={28} className="mx-auto text-nebula-muted mb-2" />
          <p className="text-sm text-nebula-muted">{error}</p>
        </div>
      )}

      {!loading && !error && users.length === 0 && <p className="text-sm text-nebula-muted text-center py-10">No one here yet.</p>}

      <div className="space-y-1">
        {!error && users.map((u) => (
          <Link key={u.id} to={`/${u.username}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-nebula-surface">
            <div className="w-10 h-10 rounded-full bg-nebula-bg border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
              {u.avatar_url ? <img src={mediaUrl(u.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-sm font-display">{u.username[0].toUpperCase()}</span>}
            </div>
            <div>
              <p className="text-sm font-medium">{u.username}</p>
              <p className="text-xs text-nebula-muted">{u.full_name}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
