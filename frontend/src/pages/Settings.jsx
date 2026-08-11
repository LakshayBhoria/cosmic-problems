import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Bell, ShieldOff, LogOut, Trash2, ChevronRight, Palette, ArrowLeft } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

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
  const { user, updateUser } = useAuth();
  const [theme, setTheme] = useState(user.theme || 'dark');
  const pick = async (t) => {
    setTheme(t);
    await api.put('/users/me/settings', { theme: t });
    updateUser({ theme: t });
  };
  return (
    <div className="flex gap-2">
      {['dark', 'deep-space'].map((t) => (
        <button key={t} onClick={() => pick(t)} className={`flex-1 py-3 rounded-xl border text-sm capitalize ${theme === t ? 'border-nebula-violet bg-nebula-violet/10 text-nebula-violet' : 'border-nebula-border text-nebula-muted'}`}>
          {t.replace('-', ' ')}
        </button>
      ))}
      <p className="w-full text-xs text-nebula-muted mt-1">Cosmic Problems is dark-themed by design — more palettes are on the way.</p>
    </div>
  );
}

const SECTIONS = [
  { key: 'profile', label: 'Edit profile', icon: User },
  { key: 'password', label: 'Password', icon: Lock },
  { key: 'privacy', label: 'Privacy', icon: ShieldOff },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'blocked', label: 'Blocked accounts', icon: ShieldOff },
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
