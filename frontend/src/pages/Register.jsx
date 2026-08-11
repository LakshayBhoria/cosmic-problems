import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Orbit } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Orbit size={36} className="text-nebula-violet animate-twinkle" />
          <h1 className="font-display text-2xl font-semibold mt-3">Join Cosmic Problems</h1>
          <p className="eyebrow mt-1 text-center">Post a problem. Start a discussion. Chase the answer.</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-3">
          {error && <p className="text-sm text-nebula-pink bg-nebula-pink/10 border border-nebula-pink/30 rounded-lg px-3 py-2">{error}</p>}
          <input className="input-field" placeholder="Full name" value={form.full_name} onChange={set('full_name')} autoFocus />
          <input className="input-field" placeholder="Username" value={form.username} onChange={set('username')} />
          <input className="input-field" type="email" placeholder="Email" value={form.email} onChange={set('email')} />
          <input className="input-field" type="password" placeholder="Password (min 6 characters)" value={form.password} onChange={set('password')} />
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-nebula-muted mt-5">
          Already have an account? <Link to="/login" className="text-nebula-violet font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
