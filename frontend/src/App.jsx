import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Feed from './pages/Feed.jsx';
import Explore from './pages/Explore.jsx';
import Reels from './pages/Reels.jsx';
import PostDetail from './pages/PostDetail.jsx';
import Profile from './pages/Profile.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Settings from './pages/Settings.jsx';
import Notifications from './pages/Notifications.jsx';
import Saved from './pages/Saved.jsx';
import CreatePost from './pages/CreatePost.jsx';
import CreateStory from './pages/CreateStory.jsx';
import Followers from './pages/Followers.jsx';
import Chat from './pages/Chat.jsx';
import ChatRoom from './pages/ChatRoom.jsx';
import AdminVerification from './pages/AdminVerification.jsx';
import CallOverlay from './components/CallOverlay.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function SplashLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-void">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-nebula-violet border-t-transparent animate-spin" />
        <p className="eyebrow">Loading Cosmic Problems…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <SplashLoader />;

  return (
    <>
    {user && <CallOverlay />}
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      {/* Full-screen, no chrome — same pattern as Login/Register */}
      <Route path="/create/story" element={<ProtectedRoute><CreateStory /></ProtectedRoute>} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Feed />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/reels" element={<Reels />} />
        <Route path="/create" element={<CreatePost />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:id" element={<ChatRoom />} />
        <Route path="/admin/verification" element={<AdminVerification />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/settings/*" element={<Settings />} />
        <Route path="/edit-profile" element={<EditProfile />} />
        <Route path="/post/:id" element={<PostDetail />} />
        <Route path="/:username" element={<Profile />} />
        <Route path="/:username/followers" element={<Followers mode="followers" />} />
        <Route path="/:username/following" element={<Followers mode="following" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
