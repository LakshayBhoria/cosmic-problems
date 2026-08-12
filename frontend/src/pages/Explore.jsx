import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, Layers, Search } from 'lucide-react';
import api, { mediaUrl } from '../api';
import SearchPanel from '../components/SearchPanel.jsx';

export default function Explore() {
  const [categories, setCategories] = useState(['All']);
  const [active, setActive] = useState('All');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    api.get('/posts/categories').then(({ data }) => setCategories(['All', ...data.categories]));
  }, []);

  const load = useCallback(async (cat) => {
    setLoading(true);
    const { data } = await api.get('/posts/explore', { params: { category: cat } });
    setPosts(data.posts);
    setLoading(false);
  }, []);

  useEffect(() => { load(active); }, [active, load]);

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 pt-4">
      <button
        onClick={() => setSearchOpen(true)}
        className="w-full flex items-center gap-2 input-field px-3 py-2.5 mb-3 text-nebula-muted hover:border-nebula-violet/50 transition-colors"
      >
        <Search size={16} />
        <span className="text-sm">Search</span>
      </button>

      <div data-no-swipe-nav className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-none">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              active === c ? 'bg-nebula-violet border-nebula-violet text-white' : 'border-nebula-border text-nebula-muted hover:border-nebula-violet/50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-nebula-violet border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="text-center py-16">
          <Layers size={28} className="mx-auto text-nebula-muted mb-2" />
          <p className="text-sm text-nebula-muted">No problems posted in this field yet.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 md:gap-2 mt-1">
        {posts.map((p) => {
          const cover = p.media?.[0];
          return (
            <Link key={p.id} to={`/post/${p.id}`} className="relative aspect-square bg-nebula-surface overflow-hidden group">
              {cover?.media_type === 'video' ? (
                <>
                  <video src={mediaUrl(cover.media_url)} className="w-full h-full object-cover" muted />
                  <PlayCircle size={20} className="absolute top-2 right-2 text-white drop-shadow" />
                </>
              ) : (
                <img src={mediaUrl(cover?.media_url)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-xs font-mono text-white">{p.likeCount} likes · {p.commentCount} comments</span>
              </div>
              <span className={`absolute bottom-1.5 left-1.5 status-pill status-${p.status} !bg-black/50 backdrop-blur`}>
                <span className="status-dot" />{p.status}
              </span>
            </Link>
          );
        })}
      </div>

      {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
