import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Orbit } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      nav('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Orbit size={36} className="text-nebula-violet animate-twinkle" />
          <h1 className="font-display text-2xl font-semibold mt-3">Cosmic Problems</h1>
          <p className="eyebrow mt-1">Where the universe's open questions live</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-3">
          {error && <p className="text-sm text-nebula-pink bg-nebula-pink/10 border border-nebula-pink/30 rounded-lg px-3 py-2">{error}</p>}
          <input
            className="input-field"
            placeholder="Username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
          />
          <input
            className="input-field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-nebula-muted mt-5">
          New to Cosmic Problems? <Link to="/register" className="text-nebula-violet font-medium">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
