import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    full_name: user.full_name || '',
    bio: user.bio || '',
    field_of_interest: user.field_of_interest || '',
    website: user.website || '',
    is_private: !!user.is_private,
  });
  const [avatarPreview, setAvatarPreview] = useState(user.avatar_url);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onAvatarPick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append('avatar', file);
    const { data } = await api.put('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    updateUser({ avatar_url: data.avatar_url });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const { data } = await api.put('/users/me/profile', form);
      updateUser(data.user);
      setMsg('Profile updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-16">
      <h1 className="font-display text-xl font-semibold mb-5">Edit profile</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-nebula-surface border border-nebula-border overflow-hidden flex items-center justify-center">
          {avatarPreview ? <img src={mediaUrl(avatarPreview)} className="w-full h-full object-cover" /> : <span className="font-display text-xl">{user.username[0].toUpperCase()}</span>}
        </div>
        <button onClick={() => fileRef.current.click()} className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5">
          <Camera size={14} /> Change photo
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />
      </div>

      <form onSubmit={save} className="space-y-4">
        {msg && <p className="text-sm text-nebula-cyan">{msg}</p>}
        <div>
          <label className="eyebrow block mb-1.5">Full name</label>
          <input className="input-field" value={form.full_name} onChange={set('full_name')} />
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Field of interest</label>
          <input className="input-field" placeholder="e.g. Astrophysics, Quantum Computing" value={form.field_of_interest} onChange={set('field_of_interest')} />
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Bio</label>
          <textarea className="input-field" rows={3} value={form.bio} onChange={set('bio')} maxLength={200} />
        </div>
        <div>
          <label className="eyebrow block mb-1.5">Website</label>
          <input className="input-field" value={form.website} onChange={set('website')} placeholder="https://" />
        </div>
        <label className="flex items-center justify-between card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Private account</p>
            <p className="text-xs text-nebula-muted">Only approved followers can see your problems and reels.</p>
          </div>
          <input type="checkbox" checked={form.is_private} onChange={(e) => setForm((f) => ({ ...f, is_private: e.target.checked }))} className="w-4 h-4 accent-nebula-violet" />
        </label>
        <button disabled={saving} className="btn-primary w-full py-2.5">{saving ? 'Saving…' : 'Save changes'}</button>
      </form>
    </div>
  );
}
