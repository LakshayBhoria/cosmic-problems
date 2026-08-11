import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Eye } from 'lucide-react';
import api, { mediaUrl } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const STORY_DURATION_MS = 5000;

// Full-screen viewer for one user's story group at a time. `groups` is the
// ordered list from /stories/feed, `startIndex` is which user to open on.
export default function StoryViewer({ groups, startIndex, onClose, onExhausted }) {
  const { user: me } = useAuth();
  const [userIndex, setUserIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const pausedAtRef = useRef(0);

  const group = groups[userIndex];
  const story = group?.stories[storyIndex];

  const goNextStory = useCallback(() => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (userIndex < groups.length - 1) {
      setUserIndex((i) => i + 1);
      setStoryIndex(0);
    } else {
      onExhausted?.();
      onClose();
    }
  }, [group, storyIndex, userIndex, groups.length, onClose, onExhausted]);

  const goPrevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (userIndex > 0) {
      const prevGroup = groups[userIndex - 1];
      setUserIndex((i) => i - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
  }, [storyIndex, userIndex, groups]);

  // Mark viewed + reset progress whenever the active story changes
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    setViewers(null);
    if (!story.viewedByViewer && group.user.id !== me?.id) {
      api.post(`/stories/${story.id}/view`).catch(() => {});
    }
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress timer (image stories only auto-advance on a fixed clock; video
  // stories are driven by the <video> element's own timeupdate instead)
  useEffect(() => {
    if (!story || paused || story.media_type === 'video') return;
    startRef.current = performance.now() - pausedAtRef.current;
    const tick = (now) => {
      const elapsed = now - startRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        pausedAtRef.current = 0;
        goNextStory();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [story?.id, paused, goNextStory]);

  useEffect(() => {
    if (paused) pausedAtRef.current = performance.now() - (startRef.current || performance.now());
  }, [paused]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNextStory();
      if (e.key === 'ArrowLeft') goPrevStory();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goNextStory, goPrevStory]);

  const handleVideoProgress = (e) => {
    const v = e.target;
    if (v.duration) setProgress((v.currentTime / v.duration) * 100);
  };

  const isSelf = group?.user.id === me?.id;

  const loadViewers = async () => {
    if (viewers) { setViewers(null); return; }
    try {
      const { data } = await api.get(`/stories/${story.id}/viewers`);
      setViewers(data.users);
    } catch (e) {}
  };

  const deleteStory = async () => {
    if (!confirm('Delete this story?')) return;
    try {
      await api.delete(`/stories/${story.id}`);
      goNextStory();
    } catch (e) {}
  };

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none">
      <div className="relative w-full h-full max-w-md mx-auto flex flex-col">
        {/* Progress segments */}
        <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{ width: `${i < storyIndex ? 100 : i === storyIndex ? progress : 0}%`, transition: i === storyIndex ? 'none' : 'width 0.15s' }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-2 right-2 z-20 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {group.user.avatar_url ? (
              <img src={mediaUrl(group.user.avatar_url)} className="w-8 h-8 rounded-full object-cover border border-white/30" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-nebula-surface flex items-center justify-center text-xs font-display">{group.user.username[0]?.toUpperCase()}</div>
            )}
            <span className="text-sm font-medium text-white drop-shadow">{group.user.username}</span>
          </div>
          <div className="flex items-center gap-3">
            {isSelf && (
              <button onClick={deleteStory} className="text-white/80 hover:text-white"><Trash2 size={19} /></button>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white"><X size={22} /></button>
          </div>
        </div>

        {/* Media */}
        <div
          className="flex-1 flex items-center justify-center bg-black"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          {story.media_type === 'video' ? (
            <video
              key={story.id}
              src={mediaUrl(story.media_url)}
              className="max-h-full max-w-full"
              autoPlay
              playsInline
              onTimeUpdate={handleVideoProgress}
              onEnded={goNextStory}
            />
          ) : (
            <img src={mediaUrl(story.media_url)} className="max-h-full max-w-full object-contain" />
          )}
        </div>

        {/* Tap zones */}
        <button aria-label="Previous" onClick={goPrevStory} className="absolute left-0 top-0 h-full w-1/3 z-10" />
        <button aria-label="Next" onClick={goNextStory} className="absolute right-0 top-0 h-full w-1/3 z-10" />

        {/* Desktop nav arrows */}
        <button onClick={goPrevStory} className="hidden md:flex absolute -left-14 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
          <ChevronLeft size={22} />
        </button>
        <button onClick={goNextStory} className="hidden md:flex absolute -right-14 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
          <ChevronRight size={22} />
        </button>

        {/* Viewer count (own stories only) */}
        {isSelf && (
          <div className="absolute bottom-4 left-2 right-2 z-20">
            <button onClick={loadViewers} className="flex items-center gap-1.5 text-white/90 text-xs bg-black/40 rounded-full px-3 py-1.5 backdrop-blur">
              <Eye size={13} /> {story.viewerCount ?? 0} {story.viewerCount === 1 ? 'view' : 'views'}
            </button>
            {viewers && (
              <div className="mt-2 card bg-black/70 backdrop-blur border-white/10 p-2 max-h-40 overflow-y-auto">
                {viewers.length === 0 ? (
                  <p className="text-xs text-nebula-muted px-2 py-1">No views yet.</p>
                ) : viewers.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-white">
                    {v.avatar_url ? <img src={mediaUrl(v.avatar_url)} className="w-6 h-6 rounded-full object-cover" /> : <div className="w-6 h-6 rounded-full bg-nebula-surface" />}
                    {v.username}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
