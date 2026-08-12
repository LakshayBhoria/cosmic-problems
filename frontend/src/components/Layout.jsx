import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, Clapperboard, PlusSquare, Heart, User, Search, Menu, Orbit, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import api, { mediaUrl } from '../api';
import SearchPanel from './SearchPanel.jsx';
import { useSwipeNav } from '../hooks/useSwipeNav.js';

export default function Layout() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const isHome = loc.pathname === '/';
  const isOwnProfile = !!user?.username && loc.pathname === `/${user.username}`;

  // Home <-> Chat <-> Notifications <-> Profile (swipe right walks forward),
  // and Home <-> Settings the other way (swipe left from Home).
  const getSwipeTargets = useCallback((pathname) => {
    const profilePath = user?.username ? `/${user.username}` : null;
    if (pathname === '/') return { left: '/settings', right: '/chat' };
    if (pathname === '/chat') return { left: '/', right: '/notifications' };
    if (pathname === '/notifications') return { left: '/chat', right: profilePath };
    if (profilePath && pathname === profilePath) return { left: '/notifications', right: null };
    if (pathname.startsWith('/settings')) return { left: null, right: '/' };
    return { left: null, right: null };
  }, [user?.username]);
  const swipeHandlers = useSwipeNav(getSwipeTargets);

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

  // Bottom (mobile) nav: swap Post out for Chat (Post now lives in the mobile
  // top bar's "+" icon instead) and keep Alerts out (also top bar, on Home).
  const footerNavItems = navItems.filter((item) => item.label !== 'Post' && item.label !== 'Alerts');

  return (
    <div className="min-h-screen">
      {/* Desktop top navbar */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 h-16 z-40 border-b border-nebula-border bg-nebula-bg/90 backdrop-blur">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-1.5">
            <Orbit size={22} className="text-nebula-violet" strokeWidth={2.2} />
            <span className="brand-wordmark text-2xl leading-none translate-y-[1px]">Cosmic Problems</span>
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
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-40 border-b border-nebula-border bg-nebula-bg/90 backdrop-blur flex items-center justify-between px-4">
        {(isHome || isOwnProfile) ? (
          <Link to="/create" className="p-1 -ml-1" aria-label="New post">
            <PlusSquare size={22} strokeWidth={1.8} />
          </Link>
        ) : (
          <span className="w-6" />
        )}
        <Link to="/" className="flex items-center gap-1.5">
          <Orbit size={19} className="text-nebula-violet" strokeWidth={2.2} />
          <span className="brand-wordmark text-[1.6rem] leading-none translate-y-[1px]">Cosmic Problems</span>
        </Link>
        {isHome ? (
          <div className="flex items-center gap-4">
            <Link to="/notifications" className="relative" aria-label="Alerts">
              <Heart size={24} strokeWidth={loc.pathname === '/notifications' ? 2.2 : 1.8} className={loc.pathname === '/notifications' ? 'text-nebula-violet' : 'text-nebula-text'} />
              {!!unread && (
                <span className="absolute -top-1 -right-1.5 bg-nebula-pink text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link to="/chat" className="relative" aria-label="Chat">
              <MessageCircle size={24} strokeWidth={loc.pathname === '/chat' ? 2.2 : 1.8} className={loc.pathname === '/chat' ? 'text-nebula-violet' : 'text-nebula-text'} />
              {!!chatUnread && (
                <span className="absolute -top-1 -right-1.5 bg-nebula-pink text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </Link>
          </div>
        ) : isOwnProfile ? (
          <Link to="/settings" className="p-1 -mr-1" aria-label="Settings">
            <Menu size={22} strokeWidth={1.8} />
          </Link>
        ) : (
          <span className="w-6" />
        )}
      </div>

      {/* Header stays fixed above (position: fixed) — this spacer + touch
          region is what actually moves/swipes with page changes. */}
      <main className="pt-14 md:pt-16 pb-16 md:pb-8 min-h-screen" onTouchStart={swipeHandlers.onTouchStart} onTouchEnd={swipeHandlers.onTouchEnd}>
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 z-40 border-t border-nebula-border bg-nebula-bg/90 backdrop-blur flex items-center justify-around">
        {footerNavItems.map(({ to, icon: Icon, label, badge }) => (
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
