import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Bell, ShieldOff, LogOut, Trash2, ChevronRight, Palette, ArrowLeft, BadgeCheck, ShieldCheck, Sun, Moon, Monitor } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

function PasswordPanel() {
  const [form, setForm] = useState({ current_password: '', new_password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await api.put('/users/me/password', form);
      setMsg('Password updated.');
      setForm({ current_password: '', new_password: '' });
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not update password.');
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {msg && <p className="text-sm text-nebula-cyan">{msg}</p>}
      {err && <p className="text-sm text-nebula-pink">{err}</p>}
      <input type="password" placeholder="Current password" className="input-field" value={form.current_password} onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))} />
      <input type="password" placeholder="New password" className="input-field" value={form.new_password} onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))} />
      <button className="btn-primary px-4 py-2 text-sm">Update password</button>
    </form>
  );
}

function PrivacyPanel() {
  const { user, updateUser } = useAuth();
  const [isPrivate, setIsPrivate] = useState(!!user.is_private);
  const toggle = async () => {
    const next = !isPrivate;
    setIsPrivate(next);
    await api.put('/users/me/profile', { full_name: user.full_name, bio: user.bio, field_of_interest: user.field_of_interest, website: user.website, is_private: next });
    updateUser({ is_private: next });
  };
  return (
    <label className="flex items-center justify-between card px-4 py-3">
      <div>
        <p className="text-sm font-medium">Private account</p>
        <p className="text-xs text-nebula-muted">Only approved followers can see your problems and reels.</p>
      </div>
      <input type="checkbox" checked={isPrivate} onChange={toggle} className="w-4 h-4 accent-nebula-violet" />
    </label>
  );
}

function NotificationsPanel() {
  const [settings, setSettings] = useState({ email_notifications: true, push_notifications: true });
  useEffect(() => { api.get('/auth/me').then(({ data }) => setSettings({
    email_notifications: !!data.user.email_notifications, push_notifications: !!data.user.push_notifications
  })); }, []);
  const toggle = async (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    await api.put('/users/me/settings', next);
  };
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between card px-4 py-3">
        <span className="text-sm">Push notifications</span>
        <input type="checkbox" checked={settings.push_notifications} onChange={() => toggle('push_notifications')} className="w-4 h-4 accent-nebula-violet" />
      </label>
      <label className="flex items-center justify-between card px-4 py-3">
        <span className="text-sm">Email notifications</span>
        <input type="checkbox" checked={settings.email_notifications} onChange={() => toggle('email_notifications')} className="w-4 h-4 accent-nebula-violet" />
      </label>
    </div>
  );
}

function BlockedPanel() {
  const [blocked, setBlocked] = useState([]);
  useEffect(() => { api.get('/users/me/blocked').then(({ data }) => setBlocked(data.users)); }, []);
  const unblock = async (id) => {
    await api.delete(`/users/${id}/block`);
    setBlocked((b) => b.filter((u) => u.id !== id));
  };
  if (blocked.length === 0) return <p className="text-sm text-nebula-muted">You haven't blocked anyone.</p>;
  return (
    <div className="space-y-2">
      {blocked.map((u) => (
        <div key={u.id} className="flex items-center justify-between card px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-nebula-bg border border-nebula-border overflow-hidden flex items-center justify-center">
              {u.avatar_url ? <img src={mediaUrl(u.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-xs font-display">{u.username[0].toUpperCase()}</span>}
            </div>
            <span className="text-sm">{u.username}</span>
          </div>
          <button onClick={() => unblock(u.id)} className="btn-ghost px-3 py-1 text-xs">Unblock</button>
        </div>
      ))}
    </div>
  );
}

function ThemePanel() {
  const { theme, setTheme } = useTheme();
  const { updateUser } = useAuth();

  const pick = async (t) => {
    setTheme(t);
    try {
      await api.put('/users/me/settings', { theme: t });
      updateUser({ theme: t });
    } catch (e) {
      // theme still applies locally even if the preference sync fails
    }
  };

  const OPTIONS = [
    { key: 'dark', label: 'Dark', icon: Moon, desc: 'Deep space, easy on the eyes at night.' },
    { key: 'light', label: 'Light', icon: Sun, desc: 'Bright and clean for daytime use.' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            onClick={() => pick(key)}
            className={`flex flex-col items-center gap-2 py-5 rounded-xl border text-sm transition-colors ${theme === key ? 'border-nebula-violet bg-nebula-violet/10 text-nebula-violet' : 'border-nebula-border text-nebula-muted hover:border-nebula-violet/40'}`}
          >
            <Icon size={20} />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-nebula-muted mt-3">{OPTIONS.find((o) => o.key === theme)?.desc}</p>
    </div>
  );
}

function VerificationPanel() {
  const { user } = useAuth();
  const [request, setRequest] = useState(undefined);
  const [form, setForm] = useState({ category: 'scientist', reason: '', links: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/users/me/verification-request').then(({ data }) => setRequest(data.request)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const { data } = await api.post('/users/me/verification-request', form);
      setRequest(data.request);
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not submit request.');
    } finally {
      setBusy(false);
    }
  };

  if (user.is_verified) {
    return (
      <div className="card p-4 flex items-center gap-2 text-sm">
        <BadgeCheck size={18} className="text-nebula-cyan" /> Your account is verified.
      </div>
    );
  }

  if (request === undefined) return <p className="text-sm text-nebula-muted">Loading…</p>;

  if (request && request.status === 'pending') {
    return <p className="text-sm text-nebula-muted">Your verification request is under review. We'll notify you once it's decided.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {request && request.status === 'rejected' && (
        <p className="text-sm text-nebula-pink">
          Your last request was declined{request.review_note ? `: ${request.review_note}` : '.'} You can submit a new one below.
        </p>
      )}
      {err && <p className="text-sm text-nebula-pink">{err}</p>}
      <div>
        <label className="eyebrow block mb-1">Category</label>
        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input-field w-full">
          <option value="scientist">Scientist / researcher</option>
          <option value="educator">Educator</option>
          <option value="organization">Organization / institution</option>
          <option value="public_figure">Public figure</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="eyebrow block mb-1">Why should you be verified?</label>
        <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} rows={4} className="input-field w-full" placeholder="Tell us who you are and why this account is notable…" />
      </div>
      <div>
        <label className="eyebrow block mb-1">Supporting links (optional)</label>
        <input value={form.links} onChange={(e) => setForm((f) => ({ ...f, links: e.target.value }))} className="input-field w-full" placeholder="Institution page, publications, press…" />
      </div>
      <button disabled={busy} className="btn-primary px-4 py-2 text-sm">{busy ? 'Submitting…' : 'Submit request'}</button>
    </form>
  );
}

const SECTIONS = [
  { key: 'profile', label: 'Edit profile', icon: User },
  { key: 'password', label: 'Password', icon: Lock },
  { key: 'privacy', label: 'Privacy', icon: ShieldOff },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'blocked', label: 'Blocked accounts', icon: ShieldOff },
  { key: 'verification', label: 'Request verification', icon: BadgeCheck },
  { key: 'theme', label: 'Appearance', icon: Palette },
];

export default function Settings() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(null);

  const deleteAccount = async () => {
    if (!confirm('This will permanently delete your account and all your posts. Continue?')) return;
    await api.delete('/users/me');
    logout();
    nav('/login');
  };

  if (open === 'profile') {
    nav('/edit-profile');
    return null;
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-16">
      <h1 className="font-display text-xl font-semibold mb-5">Settings</h1>

      {open ? (
        <div>
          <button onClick={() => setOpen(null)} className="flex items-center gap-1.5 text-sm text-nebula-muted mb-4 hover:text-white">
            <ArrowLeft size={16} /> Back to settings
          </button>
          <h2 className="font-medium mb-3">{SECTIONS.find((s) => s.key === open)?.label}</h2>
          {open === 'password' && <PasswordPanel />}
          {open === 'privacy' && <PrivacyPanel />}
          {open === 'notifications' && <NotificationsPanel />}
          {open === 'blocked' && <BlockedPanel />}
          {open === 'verification' && <VerificationPanel />}
          {open === 'theme' && <ThemePanel />}
        </div>
      ) : (
        <div className="space-y-1">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => (key === 'profile' ? nav('/edit-profile') : setOpen(key))}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-nebula-surface transition-colors"
            >
              <span className="flex items-center gap-3 text-sm"><Icon size={17} className="text-nebula-muted" /> {label}</span>
              <ChevronRight size={16} className="text-nebula-muted" />
            </button>
          ))}
          {user.is_admin && (
            <Link to="/admin/verification" className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-nebula-surface transition-colors">
              <span className="flex items-center gap-3 text-sm"><ShieldCheck size={17} className="text-nebula-cyan" /> Admin: verification requests</span>
              <ChevronRight size={16} className="text-nebula-muted" />
            </Link>
          )}
          <div className="h-px bg-nebula-border my-3" />
          <button onClick={() => { logout(); nav('/login'); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-nebula-surface text-sm">
            <LogOut size={17} /> Log out
          </button>
          <button onClick={deleteAccount} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-nebula-pink/10 text-sm text-nebula-pink">
            <Trash2 size={17} /> Delete account
          </button>
        </div>
      )}
    </div>
  );
}
