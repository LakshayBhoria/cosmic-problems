import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Telescope } from 'lucide-react';
import api from '../api';
import PostCard from '../components/PostCard.jsx';
import StoriesBar from '../components/StoriesBar.jsx';

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);

  const load = useCallback(async (p) => {
    setLoading(true);
    const { data } = await api.get('/posts/feed', { params: { page: p } });
    setPosts((prev) => (p === 0 ? data.posts : [...prev, ...data.posts]));
    setHasMore(data.posts.length === 10);
    setLoading(false);
  }, []);

  useEffect(() => { load(0); }, [load]);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage((p) => p + 1);
      }
    });
    if (loaderRef.current) obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading]);

  useEffect(() => { if (page > 0) load(page); }, [page, load]);

  return (
    <div className="pb-4">
      <StoriesBar />

      <div className="max-w-lg mx-auto px-3 md:px-0 pt-4 space-y-4">
        {!loading && posts.length === 0 && (
          <div className="card p-10 text-center mt-10">
            <Telescope size={32} className="mx-auto text-nebula-violet mb-3" />
            <h2 className="font-display text-lg font-semibold">Your feed is quiet, for now</h2>
            <p className="text-sm text-nebula-muted mt-1.5">Follow other explorers or post your first cosmic problem to get things started.</p>
            <Link to="/explore" className="btn-primary inline-block px-4 py-2 mt-4 text-sm">Explore problems</Link>
          </div>
        )}

        {posts.map((p) => (
          <PostCard key={p.id} post={p} onDelete={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))} />
        ))}

        <div ref={loaderRef} className="h-10 flex items-center justify-center">
          {loading && <div className="w-6 h-6 rounded-full border-2 border-nebula-violet border-t-transparent animate-spin" />}
        </div>
      </div>
    </div>
  );
}
