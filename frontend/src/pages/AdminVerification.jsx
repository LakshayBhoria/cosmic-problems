import React, { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BadgeCheck, Check, X, ArrowLeft } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = ['pending', 'approved', 'rejected'];

export default function AdminVerification() {
  const { user } = useAuth();
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get('/admin/verification-requests', { params: { status: tab } });
    setRequests(data.requests);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  if (!user.is_admin) return <Navigate to="/" replace />;

  const approve = async (id) => {
    await api.post(`/admin/verification-requests/${id}/approve`);
    setRequests((r) => r.filter((x) => x.id !== id));
  };

  const reject = async (id) => {
    await api.post(`/admin/verification-requests/${id}/reject`, { note });
    setRequests((r) => r.filter((x) => x.id !== id));
    setRejectingId(null);
    setNote('');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
      <Link to="/settings" className="flex items-center gap-1.5 text-sm text-nebula-muted mb-4 hover:text-white">
        <ArrowLeft size={16} /> Back to settings
      </Link>
      <h1 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
        <BadgeCheck size={20} className="text-nebula-cyan" /> Verification requests
      </h1>

      <div className="flex gap-1 border-b border-nebula-border mb-4">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm capitalize border-b-2 transition-colors ${tab === t ? 'border-nebula-violet text-nebula-text font-medium' : 'border-transparent text-nebula-muted'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm text-nebula-muted py-10">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-center text-sm text-nebula-muted py-10">No {tab} requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start gap-3">
                <Link to={`/${r.applicant.username}`} className="w-10 h-10 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
                  {r.applicant.avatar_url ? <img src={mediaUrl(r.applicant.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-sm font-display">{r.applicant.username?.[0]?.toUpperCase()}</span>}
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.applicant.username} <span className="text-nebula-muted font-normal">· {r.category.replace('_', ' ')}</span></p>
                  <p className="text-sm text-nebula-muted mt-1 whitespace-pre-wrap">{r.reason}</p>
                  {r.links && <p className="text-xs text-nebula-cyan mt-1 break-all">{r.links}</p>}
                  {r.review_note && <p className="text-xs text-nebula-pink mt-1">Note: {r.review_note}</p>}
                </div>
              </div>

              {tab === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => approve(r.id)} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><Check size={14} /> Approve</button>
                  {rejectingId === r.id ? (
                    <div className="flex-1 flex gap-2">
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="input-field flex-1 text-xs py-1.5" />
                      <button onClick={() => reject(r.id)} className="btn-ghost px-3 py-1.5 text-xs text-nebula-pink">Confirm</button>
                    </div>
                  ) : (
                    <button onClick={() => setRejectingId(r.id)} className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1"><X size={14} /> Decline</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
