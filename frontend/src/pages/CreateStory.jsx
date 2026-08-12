import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Image as ImageIcon, RefreshCw, Type, Pencil, Music2, Search, Play, Pause,
  Undo2, Check, ChevronLeft, Settings, Zap, ZapOff, LayoutTemplate, Layers,
  Camera, ChevronDown, Sparkles, SlidersHorizontal, Columns, Infinity as InfinityIcon,
} from 'lucide-react';
import api from '../api';

const MAX_RECORD_MS = 15000;
const TEXT_COLORS = ['#ffffff', '#e8e9f5', '#7c5cfc', '#23d9d9', '#ffd166', '#ff5c9e', '#000000'];
const BRUSH_SIZES = [
  { label: 'S', width: 0.006 },
  { label: 'M', width: 0.012 },
  { label: 'L', width: 0.022 },
];

function formatDuration(sec) {
  if (!sec && sec !== 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CreateStory() {
  const navigate = useNavigate();

  // ---- capture screen state ----
  const [screen, setScreen] = useState('capture'); // 'capture' | 'edit'
  const [mode, setMode] = useState('gallery'); // 'gallery' | 'camera' -- gallery is the default landing view, swipe left for camera
  const [facingMode, setFacingMode] = useState('user');
  const [cameraError, setCameraError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  const videoLiveRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const pressTimerRef = useRef(null);
  const recordTimeoutRef = useRef(null);
  const recordIntervalRef = useRef(null);
  const didLongPressRef = useRef(false);
  const galleryInputRef = useRef(null);
  const touchStartX = useRef(null);

  // ---- "Add to story" gallery screen state ----
  const [recentPicks, setRecentPicks] = useState([]); // files browsed this session, for the recents grid
  const [selectMode, setSelectMode] = useState(false); // multi-pick: share several recents as separate stories at once
  const [multiUploading, setMultiUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // ---- captured media ----
  const [capturedFile, setCapturedFile] = useState(null);
  const [capturedType, setCapturedType] = useState(null); // 'image' | 'video'
  const [previewUrl, setPreviewUrl] = useState(null);

  // ---- editor state ----
  const containerRef = useRef(null);
  const [drawMode, setDrawMode] = useState(false);
  const [brush, setBrush] = useState(BRUSH_SIZES[1]);
  const [brushColor, setBrushColor] = useState('#ff5c9e');
  const [paths, setPaths] = useState([]);
  const [livePath, setLivePath] = useState(null);
  const currentPathRef = useRef(null);
  const canvasRef = useRef(null);

  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const dragRef = useRef(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerColor, setComposerColor] = useState('#ffffff');
  const [editingTextId, setEditingTextId] = useState(null);

  const [musicSheetOpen, setMusicSheetOpen] = useState(false);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [music, setMusic] = useState(null);
  const [musicStart, setMusicStart] = useState(0);
  const [previewingId, setPreviewingId] = useState(null);
  const previewAudioRef = useRef(null);

  const [uploading, setUploading] = useState(false);

  // ---------------- Camera lifecycle ----------------
  useEffect(() => {
    if (screen !== 'capture' || mode !== 'camera') return;
    let cancelled = false;
    setCameraError(null);

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode }, audio: true,
        }).catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode } }));
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoLiveRef.current) videoLiveRef.current.srcObject = stream;
      } catch (err) {
        if (!cancelled) setCameraError("Couldn't access your camera. You can still use Gallery.");
      }
    }
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [screen, mode, facingMode]);

  // Revoke object URLs when we're done with them
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const startEditing = useCallback((file, type) => {
    setCapturedFile(file);
    setCapturedType(type);
    setPreviewUrl(URL.createObjectURL(file));
    setTexts([]);
    setPaths([]);
    setMusic(null);
    setMusicStart(0);
    setDrawMode(false);
    setScreen('edit');
  }, []);

  // ---------------- Photo / video capture ----------------
  const takePhoto = () => {
    const video = videoLiveRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      startEditing(new File([blob], 'story.jpg', { type: 'image/jpeg' }), 'image');
    }, 'image/jpeg', 0.92);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || !stream.getVideoTracks().length) return;
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
    try {
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'video/webm' });
        startEditing(new File([blob], 'story.webm', { type: blob.type }), 'video');
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordMs(0);
      recordIntervalRef.current = setInterval(() => setRecordMs((ms) => ms + 100), 100);
      recordTimeoutRef.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
    } catch (err) {
      setCameraError("Couldn't start recording.");
    }
  };

  const stopRecording = () => {
    clearTimeout(recordTimeoutRef.current);
    clearInterval(recordIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const onShutterDown = () => {
    didLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => { didLongPressRef.current = true; startRecording(); }, 250);
  };
  const onShutterUp = () => {
    clearTimeout(pressTimerRef.current);
    if (didLongPressRef.current) stopRecording();
    else takePhoto();
  };

  const showToast = (msg) => {
    clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  };

  const toggleFlash = async () => {
    const next = !flashOn;
    setFlashOn(next);
    try {
      const track = streamRef.current?.getVideoTracks?.()[0];
      if (track && track.getCapabilities?.().torch) {
        await track.applyConstraints({ advanced: [{ torch: next }] });
      } else if (next) {
        showToast('Flash not supported on this camera');
      }
    } catch (e) {
      // best-effort only -- most laptop/phone webcams don't expose a torch control
    }
  };

  const shareRaw = async (files) => {
    setMultiUploading(true);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      showToast(`Sharing ${i + 1}/${files.length}…`);
      try {
        const fd = new FormData();
        fd.append('media', files[i], files[i].name);
        await api.post('/stories', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        ok++;
      } catch (err) {
        // keep going so one bad file doesn't block the rest
      }
    }
    setMultiUploading(false);
    if (ok > 0) navigate('/');
    else showToast("Couldn't share those.");
  };

  const onGalleryPick = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    const withMeta = picked.map((f) => ({ file: f, url: URL.createObjectURL(f), type: f.type.startsWith('video') ? 'video' : 'image' }));
    setRecentPicks((prev) => [...withMeta, ...prev].slice(0, 11));

    if (selectMode && picked.length > 1) { shareRaw(picked); return; }
    const file = picked[0];
    startEditing(file, file.type.startsWith('video') ? 'video' : 'image');
  };

  const openGalleryPicker = () => galleryInputRef.current?.click();

  // ---------------- Swipe between Gallery / Camera ----------------
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -45 && mode === 'gallery') setMode('camera');
    if (dx > 45 && mode === 'camera') setMode('gallery');
    touchStartX.current = null;
  };

  // ---------------- Text tool ----------------
  const openComposer = (id = null) => {
    if (id) {
      const t = texts.find((x) => x.id === id);
      if (!t) return;
      setComposerText(t.text);
      setComposerColor(t.color);
      setEditingTextId(id);
    } else {
      setComposerText('');
      setComposerColor('#ffffff');
      setEditingTextId(null);
    }
    setComposerOpen(true);
  };
  const saveComposer = () => {
    const val = composerText.trim();
    if (editingTextId) {
      if (!val) setTexts((prev) => prev.filter((t) => t.id !== editingTextId));
      else setTexts((prev) => prev.map((t) => (t.id === editingTextId ? { ...t, text: val, color: composerColor } : t)));
    } else if (val) {
      setTexts((prev) => [...prev, {
        id: newId(), text: val, color: composerColor, x: 0.5, y: 0.42, size: 0.075, rotation: 0,
      }]);
    }
    setComposerOpen(false);
  };

  const onTextPointerDown = (e, id) => {
    e.stopPropagation();
    setSelectedTextId(id);
    const rect = containerRef.current.getBoundingClientRect();
    const t = texts.find((x) => x.id === id);
    dragRef.current = {
      id, rect,
      offsetX: e.clientX - (rect.left + t.x * rect.width),
      offsetY: e.clientY - (rect.top + t.y * rect.height),
    };
    e.target.setPointerCapture?.(e.pointerId);
  };
  const onTextPointerMove = (e) => {
    if (!dragRef.current) return;
    const { id, rect, offsetX, offsetY } = dragRef.current;
    let x = (e.clientX - offsetX - rect.left) / rect.width;
    let y = (e.clientY - offsetY - rect.top) / rect.height;
    x = Math.min(0.95, Math.max(0.05, x));
    y = Math.min(0.95, Math.max(0.05, y));
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
  };
  const onTextPointerUp = () => { dragRef.current = null; };

  // ---------------- Drawing tool ----------------
  const toRel = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };
  const onCanvasPointerDown = (e) => {
    if (!drawMode) return;
    const pt = toRel(e);
    currentPathRef.current = { points: [pt], color: brushColor, width: brush.width };
    setLivePath({ ...currentPathRef.current });
    e.target.setPointerCapture?.(e.pointerId);
  };
  const onCanvasPointerMove = (e) => {
    if (!drawMode || !currentPathRef.current) return;
    currentPathRef.current.points.push(toRel(e));
    setLivePath({ ...currentPathRef.current, points: [...currentPathRef.current.points] });
  };
  const onCanvasPointerUp = () => {
    if (!drawMode || !currentPathRef.current) return;
    setPaths((prev) => [...prev, currentPathRef.current]);
    currentPathRef.current = null;
    setLivePath(null);
  };
  const undoStroke = () => setPaths((prev) => prev.slice(0, -1));

  useEffect(() => {
    const canvas = canvasRef.current;
    const el = containerRef.current;
    if (!canvas || !el) return;
    canvas.width = el.clientWidth;
    canvas.height = el.clientHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const drawPath = (p) => {
      if (!p.points.length) return;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.width * canvas.width);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      p.points.forEach((pt, i) => {
        const x = pt.x * canvas.width, y = pt.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    paths.forEach(drawPath);
    if (livePath) drawPath(livePath);
  }, [paths, livePath, screen]);

  // ---------------- Music ----------------
  useEffect(() => {
    if (!musicSheetOpen) return;
    setMusicLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/music/search', { params: { q: musicQuery } });
        setMusicResults(data.tracks);
      } catch (e) {
        setMusicResults([]);
      } finally {
        setMusicLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [musicQuery, musicSheetOpen]);

  const togglePreview = (t) => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (previewingId === t.id) {
      audio.pause();
      setPreviewingId(null);
      return;
    }
    audio.src = t.url;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    setPreviewingId(t.id);
  };
  const selectMusic = (t) => {
    previewAudioRef.current?.pause();
    setPreviewingId(null);
    setMusic(t);
    setMusicStart(0);
    setMusicSheetOpen(false);
  };

  // ---------------- Discard / Share ----------------
  const discardAndBack = () => {
    const hasEdits = texts.length || paths.length || music;
    if (hasEdits && !window.confirm('Discard this story?')) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedFile(null);
    setPreviewUrl(null);
    setScreen('capture');
  };

  const handleShare = async () => {
    if (!capturedFile || uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('media', capturedFile, capturedFile.name);
      if (texts.length || paths.length) fd.append('overlay', JSON.stringify({ texts, paths }));
      if (music) {
        fd.append('music_url', music.url);
        fd.append('music_name', music.name);
        fd.append('music_artist', music.artist || '');
        fd.append('music_start', String(musicStart || 0));
      }
      await api.post('/stories', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Could not share your story.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white select-none">
      <div className="relative w-full h-full max-w-md mx-auto overflow-hidden flex flex-col">

        {screen === 'capture' && (
          <>
            {/* Header — swaps with the panel: "Add to story" while browsing, flash + settings while shooting */}
            <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-4">
              <button onClick={() => navigate(-1)} className="p-1.5"><X size={24} /></button>
              {mode === 'gallery' ? (
                <span className="text-[15px] font-semibold">Add to story</span>
              ) : (
                <button onClick={toggleFlash} className="p-1.5">
                  {flashOn ? <Zap size={21} className="text-yellow-300" fill="currentColor" /> : <ZapOff size={21} />}
                </button>
              )}
              <button onClick={() => navigate('/settings')} className="p-1.5"><Settings size={21} /></button>
            </div>

            <div
              className="flex-1 flex w-[200%] transition-transform duration-200 ease-out"
              style={{ transform: mode === 'gallery' ? 'translateX(0%)' : 'translateX(-50%)' }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Gallery panel (default) — Templates/Music/Collage shortcuts + Recents grid */}
              <div className="w-1/2 h-full overflow-y-auto pt-16 pb-6">
                <div className="grid grid-cols-3 gap-2 px-4 mb-5">
                  <button onClick={() => showToast('Templates — coming soon')} className="aspect-square rounded-2xl bg-white/[0.07] flex flex-col items-center justify-center gap-2">
                    <LayoutTemplate size={22} />
                    <span className="text-xs font-medium">Templates</span>
                  </button>
                  <button onClick={() => showToast('Add music from the editor, right after you capture')} className="aspect-square rounded-2xl bg-white/[0.07] flex flex-col items-center justify-center gap-2">
                    <Music2 size={22} />
                    <span className="text-xs font-medium">Music</span>
                  </button>
                  <button onClick={() => showToast('Collage — coming soon')} className="aspect-square rounded-2xl bg-white/[0.07] flex flex-col items-center justify-center gap-2">
                    <Layers size={22} />
                    <span className="text-xs font-medium">Collage</span>
                  </button>
                </div>

                <div className="flex items-center justify-between px-4 mb-2">
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    Recents <ChevronDown size={15} />
                  </span>
                  <button
                    onClick={() => setSelectMode((s) => !s)}
                    className={`text-xs font-medium px-3 py-1 rounded-full border ${selectMode ? 'border-nebula-violet text-nebula-violet' : 'border-white/25 text-white/80'}`}
                  >
                    {selectMode ? 'Done' : 'Select'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-0.5">
                  <button onClick={() => setMode('camera')} className="aspect-square bg-white/[0.06] flex items-center justify-center">
                    <Camera size={26} className="text-white/70" />
                  </button>
                  {recentPicks.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => (selectMode ? shareRaw([p.file]) : startEditing(p.file, p.type))}
                      className="aspect-square relative overflow-hidden"
                    >
                      {p.type === 'video' ? (
                        <video src={p.url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={p.url} className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                  <button onClick={openGalleryPicker} className="aspect-square bg-white/[0.07] flex flex-col items-center justify-center gap-1.5 text-white/70">
                    <ImageIcon size={22} />
                    <span className="text-[10px]">Browse</span>
                  </button>
                </div>

                {recentPicks.length === 0 && (
                  <p className="text-xs text-white/40 text-center px-10 mt-4">
                    {selectMode ? 'Pick several photos or videos to share as separate stories at once.' : 'Browse your device to pick a photo or video.'}
                  </p>
                )}

                <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple={selectMode} hidden onChange={onGalleryPick} />
              </div>

              {/* Camera panel */}
              <div className="w-1/2 h-full relative bg-nebula-bg flex items-center justify-center">
                {cameraError ? (
                  <p className="text-sm text-white/60 text-center px-10">{cameraError}</p>
                ) : (
                  <video
                    ref={videoLiveRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                  />
                )}

                {recording && (
                  <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-mono">{formatDuration(recordMs / 1000)}</span>
                  </div>
                )}

                {/* Left tool rail — quick creation modes, added in the editor after capture */}
                <div className="absolute left-3 top-[30%] flex flex-col items-center gap-6 text-white/85">
                  <button onClick={() => showToast('Type a story straight onto a background — coming soon')}><Type size={20} /></button>
                  <button onClick={() => showToast('Boomerang — coming soon')}><InfinityIcon size={20} /></button>
                  <button onClick={() => showToast('Multi-clip layout — coming soon')}><Columns size={20} /></button>
                  <button onClick={() => showToast('More creation modes — coming soon')}><ChevronDown size={20} /></button>
                </div>

                <p className="absolute bottom-[7.5rem] left-0 right-0 text-center text-[10px] text-white/50">Tap for photo · hold for video</p>

                {/* Shutter row */}
                <div className="absolute bottom-16 left-0 right-0 flex items-center justify-center gap-9">
                  <button onClick={() => showToast('Effects — coming soon')} className="text-white/80"><Sparkles size={20} /></button>
                  <button
                    onPointerDown={onShutterDown}
                    onPointerUp={onShutterUp}
                    onPointerLeave={() => { if (recording) onShutterUp(); }}
                    className={`w-[68px] h-[68px] rounded-full border-4 flex items-center justify-center transition-transform ${recording ? 'border-red-500 scale-110' : 'border-white'}`}
                  >
                    <span className={`rounded-full bg-white transition-all ${recording ? 'w-6 h-6 rounded-md bg-red-500' : 'w-14 h-14'}`} />
                  </button>
                  <button onClick={() => showToast('Manual adjustments — coming soon')} className="text-white/80"><SlidersHorizontal size={20} /></button>
                </div>

                {/* Mode switcher row */}
                <div className="absolute bottom-4 left-0 right-0 flex items-center justify-between px-6">
                  <button onClick={() => setMode('gallery')} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                    {recentPicks[0] ? (
                      recentPicks[0].type === 'video'
                        ? <video src={recentPicks[0].url} className="w-full h-full object-cover" muted />
                        : <img src={recentPicks[0].url} className="w-full h-full object-cover" />
                    ) : <ImageIcon size={16} className="text-white/70" />}
                  </button>

                  <div className="flex items-center gap-4 text-xs font-display font-semibold tracking-wide text-white/55">
                    <button onClick={() => navigate('/create', { state: { type: 'post' } })}>POST</button>
                    <span className="text-white">STORY</span>
                    <button onClick={() => navigate('/create', { state: { type: 'reel' } })}>REEL</button>
                    <button onClick={() => showToast('Live — coming soon')}>LIVE</button>
                  </div>

                  <button onClick={() => setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))} className="p-1.5">
                    <RefreshCw size={20} />
                  </button>
                </div>
              </div>
            </div>

            {toast && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur text-xs px-4 py-2 rounded-full max-w-[85%] text-center">
                {toast}
              </div>
            )}
            {multiUploading && (
              <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
              </div>
            )}
          </>
        )}

        {screen === 'edit' && previewUrl && (
          <>
            <div
              ref={containerRef}
              className="flex-1 relative bg-black flex items-center justify-center overflow-hidden"
            >
              {capturedType === 'video' ? (
                <video src={previewUrl} className="max-h-full max-w-full" autoPlay loop playsInline muted={!!music} />
              ) : (
                <img src={previewUrl} className="max-h-full max-w-full object-contain" />
              )}

              <canvas
                ref={canvasRef}
                className="absolute inset-0"
                style={{ touchAction: drawMode ? 'none' : 'auto', pointerEvents: drawMode ? 'auto' : 'none' }}
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
              />

              {texts.map((t) => (
                <div
                  key={t.id}
                  onPointerDown={(e) => onTextPointerDown(e, t.id)}
                  onPointerMove={onTextPointerMove}
                  onPointerUp={onTextPointerUp}
                  onDoubleClick={() => openComposer(t.id)}
                  className="absolute font-display font-semibold text-center whitespace-pre-wrap"
                  style={{
                    left: `${t.x * 100}%`, top: `${t.y * 100}%`,
                    transform: 'translate(-50%,-50%)', color: t.color,
                    fontSize: `${t.size * (containerRef.current?.clientWidth || 380)}px`,
                    maxWidth: '85%', cursor: 'grab', textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                    outline: selectedTextId === t.id ? '1.5px dashed rgba(255,255,255,0.6)' : 'none',
                    outlineOffset: 6, touchAction: 'none',
                  }}
                >
                  {t.text}
                  {selectedTextId === t.id && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setTexts((p) => p.filter((x) => x.id !== t.id)); setSelectedTextId(null); }}
                      className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}

              {/* Header */}
              <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-4">
                <button onClick={discardAndBack} className="p-1.5 rounded-full bg-black/40"><ChevronLeft size={22} /></button>
                <button
                  onClick={handleShare}
                  disabled={uploading}
                  className="btn-primary px-5 py-1.5 rounded-full text-sm font-semibold disabled:opacity-60"
                >
                  {uploading ? 'Sharing…' : 'Share'}
                </button>
              </div>

              {/* Music chip + trim */}
              {music && (
                <div className="absolute top-16 left-3 right-3 z-20 flex items-center gap-2 bg-black/50 backdrop-blur rounded-full px-3 py-1.5">
                  <Music2 size={14} className="shrink-0" />
                  <span className="text-xs truncate flex-1">{music.name} · {music.artist}</span>
                  <button onClick={() => setMusic(null)}><X size={14} className="text-white/80" /></button>
                </div>
              )}
              {music && music.duration > 20 && (
                <div className="absolute top-[6.5rem] left-3 right-3 z-20 bg-black/50 backdrop-blur rounded-xl px-3 py-2">
                  <input
                    type="range" min={0} max={Math.max(0, music.duration - 15)} value={musicStart}
                    onChange={(e) => setMusicStart(Number(e.target.value))}
                    className="w-full accent-nebula-violet"
                  />
                  <p className="text-[10px] text-white/70 mt-0.5">15s starting at {formatDuration(musicStart)}</p>
                </div>
              )}

              {/* Right-side tool rail */}
              {!drawMode && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-4">
                  <button onClick={() => openComposer()} className="w-10 h-10 rounded-full bg-black/45 flex items-center justify-center"><Type size={19} /></button>
                  <button onClick={() => { setDrawMode(true); setSelectedTextId(null); }} className="w-10 h-10 rounded-full bg-black/45 flex items-center justify-center"><Pencil size={19} /></button>
                  <button onClick={() => setMusicSheetOpen(true)} className="w-10 h-10 rounded-full bg-black/45 flex items-center justify-center"><Music2 size={19} /></button>
                </div>
              )}

              {/* Draw mode controls */}
              {drawMode && (
                <div className="absolute bottom-6 left-0 right-0 z-30 flex flex-col items-center gap-3 px-4">
                  <div className="flex items-center gap-2 bg-black/45 rounded-full px-3 py-2">
                    {TEXT_COLORS.map((c) => (
                      <button key={c} onClick={() => setBrushColor(c)} className="w-6 h-6 rounded-full border-2" style={{ background: c, borderColor: brushColor === c ? '#fff' : 'transparent' }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-3 bg-black/45 rounded-full px-3 py-1.5">
                    {BRUSH_SIZES.map((b) => (
                      <button key={b.label} onClick={() => setBrush(b)} className={`text-xs w-6 h-6 rounded-full flex items-center justify-center ${brush.label === b.label ? 'bg-white text-black' : 'text-white/70'}`}>{b.label}</button>
                    ))}
                    <button onClick={undoStroke} className="text-white/80"><Undo2 size={16} /></button>
                    <button onClick={() => setDrawMode(false)} className="text-white bg-nebula-violet rounded-full w-7 h-7 flex items-center justify-center"><Check size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Text composer */}
        {composerOpen && (
          <div className="fixed inset-0 z-[70] bg-black/92 flex flex-col p-4 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-4 pt-2">
              <button onClick={() => setComposerOpen(false)}><X size={22} /></button>
              <button onClick={saveComposer} className="btn-primary px-4 py-1.5 rounded-full text-sm font-semibold">Done</button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <textarea
                autoFocus
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                style={{ color: composerColor }}
                className="bg-transparent text-center text-3xl font-display font-semibold outline-none resize-none w-full placeholder-white/40"
                placeholder="Type something…"
                rows={4}
              />
            </div>
            <div className="flex justify-center flex-wrap gap-3 pb-6">
              {TEXT_COLORS.map((c) => (
                <button key={c} onClick={() => setComposerColor(c)} className="w-8 h-8 rounded-full border-2" style={{ background: c, borderColor: composerColor === c ? '#fff' : 'transparent' }} />
              ))}
            </div>
          </div>
        )}

        {/* Music sheet */}
        {musicSheetOpen && (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-end" onClick={() => setMusicSheetOpen(false)}>
            <div className="w-full max-w-md mx-auto bg-nebula-surface rounded-t-2xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-nebula-border">
                <div className="flex items-center gap-2 input-field px-3 py-2">
                  <Search size={16} className="text-nebula-muted" />
                  <input
                    autoFocus
                    value={musicQuery}
                    onChange={(e) => setMusicQuery(e.target.value)}
                    placeholder="Search music…"
                    className="bg-transparent outline-none flex-1 text-sm text-nebula-text"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {musicLoading && <p className="text-center text-xs text-nebula-muted py-6">Searching…</p>}
                {!musicLoading && musicResults.length === 0 && (
                  <p className="text-center text-xs text-nebula-muted py-6">No tracks found.</p>
                )}
                {!musicLoading && musicResults.map((t) => (
                  <div key={t.id} onClick={() => selectMusic(t)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-nebula-bg cursor-pointer">
                    <button onClick={(e) => { e.stopPropagation(); togglePreview(t); }} className="w-10 h-10 rounded-lg bg-nebula-bg overflow-hidden shrink-0 relative flex items-center justify-center">
                      {t.cover ? <img src={t.cover} className="w-full h-full object-cover" /> : <Music2 size={16} className="text-nebula-muted" />}
                      <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        {previewingId === t.id ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white" />}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-nebula-text">{t.name}</p>
                      <p className="text-xs text-nebula-muted truncate">{t.artist}</p>
                    </div>
                    <span className="text-xs text-nebula-muted font-mono">{formatDuration(t.duration)}</span>
                  </div>
                ))}
              </div>
              <audio ref={previewAudioRef} onEnded={() => setPreviewingId(null)} hidden />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
