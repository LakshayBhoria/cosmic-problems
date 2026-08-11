import React, { useState, useEffect } from 'react';
import api from '../api';
import PostCard from '../components/PostCard.jsx';
import { Bookmark } from 'lucide-react';

export default function Saved() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/posts/saved').then(({ data }) => { setPosts(data.posts); setLoading(false); });
  }, []);

  return (
    <div className="max-w-lg mx-auto px-3 pt-4 space-y-4">
      <h1 className="font-display text-lg font-semibold px-1">Saved problems</h1>
      {!loading && posts.length === 0 && (
        <div className="card p-10 text-center mt-4">
          <Bookmark size={28} className="mx-auto text-nebula-muted mb-2" />
          <p className="text-sm text-nebula-muted">Posts you save will show up here.</p>
        </div>
      )}
      {posts.map((p) => <PostCard key={p.id} post={p} onDelete={(id) => setPosts((ps) => ps.filter((x) => x.id !== id))} />)}
    </div>
  );
}
