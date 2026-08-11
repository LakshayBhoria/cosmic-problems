import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, Clapperboard, PlusSquare, Heart, User, Search, Menu, Orbit, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api, { mediaUrl } from '../api';
import SearchPanel from './SearchPanel.jsx';

export default function Layout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const [{ data }, { data: chatData }] = await Promise.all([
          api.get('/notifications/unread-count'),
          api.get('/chat/conversations/unread-count'),
        ]);
        if (mounted) {
          setUnread(data.count);
          setChatUnread(chatData.count + chatData.requestCount);
        }
      } catch (e) {}
    }
    poll();
    const t = setInterval(poll, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, [loc.pathname]);

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/explore', icon: Compass, label: 'Explore' },
    { to: '/reels', icon: Clapperboard, label: 'Reels' },
    { to: '/create', icon: PlusSquare, label: 'Post' },
    { to: '/chat', icon: MessageCircle, label: 'Chat', badge: chatUnread },
    { to: '/notifications', icon: Heart, label: 'Alerts', badge: unread },
    { to: `/${user?.username}`, icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen">
      {/* Desktop top navbar */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 h-16 z-40 border-b border-nebula-border bg-[#0b0c14ee] backdrop-blur">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <Orbit size={22} className="text-nebula-violet" strokeWidth={2.2} />
            <span className="font-display font-semibold text-lg tracking-tight">Cosmic Problems</span>
          </Link>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 input-field max-w-xs text-nebula-muted hover:border-nebula-violet/50 transition-colors"
          >
            <Search size={16} />
            <span className="text-sm">Search problems, people…</span>
          </button>

          <nav className="flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label, badge }) => (
              <Link
                key={label}
                to={to}
                title={label}
                className={`relative p-2.5 rounded-lg hover:bg-nebula-surface transition-colors ${loc.pathname === to ? 'text-nebula-violet' : 'text-nebula-text'}`}
              >
                {label === 'Profile' && user?.avatar_url ? (
                  <img src={mediaUrl(user.avatar_url)} alt="" className={`w-6 h-6 rounded-full object-cover ${loc.pathname === to ? 'ring-2 ring-nebula-violet' : ''}`} />
                ) : (
                  <Icon size={22} strokeWidth={loc.pathname === to ? 2.4 : 1.8} />
                )}
                {!!badge && (
                  <span className="absolute -top-0.5 -right-0.5 bg-nebula-pink text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            ))}
            <Link to="/settings" title="Settings" className="p-2.5 rounded-lg hover:bg-nebula-surface transition-colors text-nebula-text">
              <Menu size={22} strokeWidth={1.8} />
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-40 border-b border-nebula-border bg-[#0b0c14ee] backdrop-blur flex items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <Orbit size={20} className="text-nebula-violet" />
          <span className="font-display font-semibold">Cosmic Problems</span>
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={() => setSearchOpen(true)}><Search size={22} /></button>
          <Link to="/settings"><Menu size={22} /></Link>
        </div>
      </div>

      <main className="pt-14 md:pt-16 pb-16 md:pb-8 min-h-screen">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 z-40 border-t border-nebula-border bg-[#0b0c14ee] backdrop-blur flex items-center justify-around">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <Link key={label} to={to} className="relative p-2">
            {label === 'Profile' && user?.avatar_url ? (
              <img src={mediaUrl(user.avatar_url)} alt="" className={`w-6 h-6 rounded-full object-cover ${loc.pathname === to ? 'ring-2 ring-nebula-violet' : ''}`} />
            ) : (
              <Icon size={24} strokeWidth={loc.pathname === to ? 2.4 : 1.8} className={loc.pathname === to ? 'text-nebula-violet' : 'text-nebula-text'} />
            )}
            {!!badge && (
              <span className="absolute top-0 right-0 bg-nebula-pink text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
