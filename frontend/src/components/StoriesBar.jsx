import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import StoryViewer from './StoryViewer.jsx';

export default function StoriesBar() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/stories/feed');
      setGroups(data.groups);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const myGroupIndex = groups.findIndex((g) => g.user.id === me?.id);
  const hasOwnStory = myGroupIndex !== -1;

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-3 md:px-0 pt-4 flex gap-4 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="w-16 h-16 rounded-full bg-nebula-surface animate-pulse" />
            <div className="w-10 h-2 rounded bg-nebula-surface animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-3 md:px-0 pt-4">
      <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Own avatar: opens own stories if any exist, otherwise triggers upload */}
        <button
          onClick={() => (hasOwnStory ? setViewerIndex(myGroupIndex) : navigate('/create/story'))}
          className="flex flex-col items-center gap-1.5 shrink-0 w-16"
        >
          <div className={`relative w-16 h-16 rounded-full p-[2px] ${hasOwnStory && groups[myGroupIndex].hasUnseen ? 'bg-gradient-to-tr from-nebula-violet to-nebula-cyan' : hasOwnStory ? 'bg-nebula-border' : 'bg-transparent'}`}>
            <div className="w-full h-full rounded-full bg-[#07070d] p-[2px]">
              {me?.avatar_url ? (
                <img src={mediaUrl(me.avatar_url)} className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-nebula-surface flex items-center justify-center font-display">{me?.username?.[0]?.toUpperCase()}</div>
              )}
            </div>
            <span
              onClick={(e) => { e.stopPropagation(); navigate('/create/story'); }}
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-nebula-violet border-2 border-[#07070d] flex items-center justify-center"
            >
              <Plus size={12} strokeWidth={3} className="text-white" />
            </span>
          </div>
          <span className="text-xs text-nebula-muted truncate w-full text-center">Your story</span>
        </button>

        {groups.filter((g) => g.user.id !== me?.id).map((g) => {
          const idx = groups.findIndex((gg) => gg.user.id === g.user.id);
          return (
            <button key={g.user.id} onClick={() => setViewerIndex(idx)} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
              <div className={`w-16 h-16 rounded-full p-[2px] ${g.hasUnseen ? 'bg-gradient-to-tr from-nebula-violet to-nebula-cyan' : 'bg-nebula-border'}`}>
                <div className="w-full h-full rounded-full bg-[#07070d] p-[2px]">
                  {g.user.avatar_url ? (
                    <img src={mediaUrl(g.user.avatar_url)} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-nebula-surface flex items-center justify-center font-display">{g.user.username[0]?.toUpperCase()}</div>
                  )}
                </div>
              </div>
              <span className="text-xs text-nebula-muted truncate w-full text-center">{g.user.username}</span>
            </button>
          );
        })}
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          groups={groups}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onExhausted={load}
        />
      )}
    </div>
  );
}
