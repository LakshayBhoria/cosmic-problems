import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, Grid3x3, Clapperboard, Lock, Link as LinkIcon, PlayCircle } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { username } = useParams();
  const { user: me, updateUser } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get(`/users/${username}`);
    setProfile(data.user);
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); setTab('posts'); }, [load]);

  useEffect(() => {
    if (!profile) return;
    if (tab === 'saved') {
      api.get('/posts/saved').then(({ data }) => setPosts(data.posts));
    } else {
      api.get(`/posts/user/${profile.id}`, { params: { type: tab === 'reels' ? 'reel' : 'post' } }).then(({ data }) => setPosts(data.posts));
    }
  }, [tab, profile]);

  if (loading || !profile) return <div className="flex justify-center pt-24"><div className="w-8 h-8 rounded-full border-2 border-nebula-violet border-t-transparent animate-spin" /></div>;

  const isSelf = profile.isSelf;
  const canSeeContent = !profile.is_private || isSelf || profile.isFollowing;

  const handleFollow = async () => {
    setFollowBusy(true);
    try {
      if (profile.isFollowing) {
        await api.delete(`/users/${profile.id}/follow`);
        setProfile((p) => ({ ...p, isFollowing: false, followerCount: p.followerCount - 1 }));
      } else {
        const { data } = await api.post(`/users/${profile.id}/follow`);
        setProfile((p) => ({ ...p, isFollowing: data.status === 'accepted', followStatus: data.status, followerCount: data.status === 'accepted' ? p.followerCount + 1 : p.followerCount }));
      }
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-3 md:px-6 pt-6">
      <div className="flex items-start gap-5 md:gap-10">
        <div className="w-20 h-20 md:w-32 md:h-32 rounded-full bg-nebula-surface border-2 border-nebula-border overflow-hidden flex items-center justify-center shrink-0">
          {profile.avatar_url ? <img src={mediaUrl(profile.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-2xl font-display">{profile.username[0].toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-medium flex items-center gap-1">{profile.username} {!!profile.is_verified && <BadgeCheck size={16} className="text-nebula-cyan" />}</h1>
            {isSelf ? (
              <div className="flex gap-2">
                <Link to="/edit-profile" className="btn-ghost px-3 py-1.5 text-sm">Edit profile</Link>
                <Link to="/settings" className="btn-ghost px-3 py-1.5 text-sm">Settings</Link>
              </div>
            ) : (
              <button onClick={handleFollow} disabled={followBusy} className={profile.isFollowing ? 'btn-ghost px-4 py-1.5 text-sm' : 'btn-primary px-4 py-1.5 text-sm'}>
                {profile.isFollowing ? 'Following' : profile.followStatus === 'pending' ? 'Requested' : 'Follow'}
              </button>
            )}
          </div>

          <div className="hidden md:flex gap-6 mt-4 text-sm">
            <span><strong>{profile.postCount}</strong> problems</span>
            <span><strong>{profile.reelCount}</strong> reels</span>
            <Link to={`/${profile.username}/followers`}><strong>{profile.followerCount}</strong> followers</Link>
            <Link to={`/${profile.username}/following`}><strong>{profile.followingCount}</strong> following</Link>
          </div>

          <div className="hidden md:block mt-3">
            <p className="text-sm font-medium">{profile.full_name}</p>
            {profile.field_of_interest && <p className="text-sm text-nebula-violet">{profile.field_of_interest}</p>}
            {profile.bio && <p className="text-sm mt-1 whitespace-pre-wrap">{profile.bio}</p>}
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="text-sm text-nebula-cyan flex items-center gap-1 mt-1"><LinkIcon size={12} />{profile.website}</a>}
          </div>
        </div>
      </div>

      <div className="md:hidden mt-4">
        <p className="text-sm font-medium">{profile.full_name}</p>
        {profile.field_of_interest && <p className="text-sm text-nebula-violet">{profile.field_of_interest}</p>}
        {profile.bio && <p className="text-sm mt-1 whitespace-pre-wrap">{profile.bio}</p>}
        {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="text-sm text-nebula-cyan flex items-center gap-1 mt-1"><LinkIcon size={12} />{profile.website}</a>}
        <div className="flex justify-between mt-4 text-sm border-y border-nebula-border py-2.5">
          <span><strong className="block">{profile.postCount}</strong><span className="eyebrow">problems</span></span>
          <span><strong className="block">{profile.reelCount}</strong><span className="eyebrow">reels</span></span>
          <Link to={`/${profile.username}/followers`}><strong className="block">{profile.followerCount}</strong><span className="eyebrow">followers</span></Link>
          <Link to={`/${profile.username}/following`}><strong className="block">{profile.followingCount}</strong><span className="eyebrow">following</span></Link>
        </div>
      </div>

      <div className="flex border-t border-nebula-border mt-6">
        <button onClick={() => setTab('posts')} className={`tab-underline flex-1 flex items-center justify-center gap-1.5 py-3 text-xs eyebrow ${tab === 'posts' ? 'active text-white' : ''}`}>
          <Grid3x3 size={14} /> Problems
        </button>
        <button onClick={() => setTab('reels')} className={`tab-underline flex-1 flex items-center justify-center gap-1.5 py-3 text-xs eyebrow ${tab === 'reels' ? 'active text-white' : ''}`}>
          <Clapperboard size={14} /> Reels
        </button>
        {isSelf && (
          <button onClick={() => setTab('saved')} className={`tab-underline flex-1 flex items-center justify-center gap-1.5 py-3 text-xs eyebrow ${tab === 'saved' ? 'active text-white' : ''}`}>
            <Lock size={14} /> Saved
          </button>
        )}
      </div>

      {!canSeeContent ? (
        <div className="text-center py-16">
          <Lock size={28} className="mx-auto text-nebula-muted mb-2" />
          <p className="text-sm font-medium">This account is private</p>
          <p className="text-sm text-nebula-muted">Follow to see their problems, reels and saved posts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-2 mt-1 pb-8">
          {posts.length === 0 && <p className="col-span-3 text-center text-sm text-nebula-muted py-12">Nothing here yet.</p>}
          {posts.map((p) => {
            const cover = p.media?.[0];
            return (
              <Link key={p.id} to={`/post/${p.id}`} className="relative aspect-square bg-nebula-surface overflow-hidden group">
                {cover?.media_type === 'video' ? (
                  <>
                    <video src={mediaUrl(cover.media_url)} className="w-full h-full object-cover" muted />
                    <PlayCircle size={18} className="absolute top-2 right-2 text-white drop-shadow" />
                  </>
                ) : (
                  <img src={mediaUrl(cover?.media_url)} className="w-full h-full object-cover" loading="lazy" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
