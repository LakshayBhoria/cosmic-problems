import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ImagePlus, Clapperboard, X, MapPin } from 'lucide-react';
import api, { mediaUrl } from '../api';

export default function CreatePost() {
  const nav = useNavigate();
  const location = useLocation();
  const [type, setType] = useState(location.state?.type === 'reel' ? 'reel' : 'post'); // post | reel
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('General');
  const [location, setLocation] = useState('');
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/posts/categories').then(({ data }) => setCategory((c) => c) && setCategories(data.categories));
  }, []);

  const onPick = (e) => {
    const picked = Array.from(e.target.files || []);
    if (type === 'reel') {
      const f = picked[0];
      if (!f) return;
      setFiles([f]);
      setPreviews([{ url: URL.createObjectURL(f), type: 'video' }]);
    } else {
      const combined = [...files, ...picked].slice(0, 10);
      setFiles(combined);
      setPreviews(combined.map((f) => ({ url: URL.createObjectURL(f), type: f.type.startsWith('video') ? 'video' : 'image' })));
    }
  };

  const removeFile = (i) => {
    const nf = files.filter((_, idx) => idx !== i);
    setFiles(nf);
    setPreviews(nf.map((f) => ({ url: URL.createObjectURL(f), type: f.type.startsWith('video') ? 'video' : 'image' })));
  };

  const switchType = (t) => {
    setType(t);
    setFiles([]);
    setPreviews([]);
    setError('');
  };

  const submit = async () => {
    if (files.length === 0) { setError(`Add ${type === 'reel' ? 'a video' : 'at least one photo or video'} first.`); return; }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('caption', caption);
      fd.append('category', category);
      if (type === 'post') {
        fd.append('location', location);
        files.forEach((f) => fd.append('media', f));
        const { data } = await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        nav(`/post/${data.post.id}`);
      } else {
        fd.append('video', files[0]);
        const { data } = await api.post('/reels', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        nav(`/post/${data.reel.id}`);
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed. Try a smaller file.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-16">
      <h1 className="font-display text-xl font-semibold mb-4">Share a cosmic problem</h1>

      <div className="flex gap-2 mb-5">
        <button onClick={() => switchType('post')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm ${type === 'post' ? 'border-nebula-violet text-nebula-violet bg-nebula-violet/10' : 'border-nebula-border text-nebula-muted'}`}>
          <ImagePlus size={16} /> Post
        </button>
        <button onClick={() => switchType('reel')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm ${type === 'reel' ? 'border-nebula-violet text-nebula-violet bg-nebula-violet/10' : 'border-nebula-border text-nebula-muted'}`}>
          <Clapperboard size={16} /> Reel
        </button>
      </div>

      {error && <p className="text-sm text-nebula-pink bg-nebula-pink/10 border border-nebula-pink/30 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {previews.length === 0 ? (
        <label className="card flex flex-col items-center justify-center gap-2 py-16 cursor-pointer border-dashed hover:border-nebula-violet/50 transition-colors">
          {type === 'post' ? <ImagePlus size={32} className="text-nebula-muted" /> : <Clapperboard size={32} className="text-nebula-muted" />}
          <p className="text-sm text-nebula-muted">{type === 'post' ? 'Select photos or videos (up to 10)' : 'Select a video'}</p>
          <input type="file" accept="image/*,video/*" multiple={type === 'post'} hidden onChange={onPick} />
        </label>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {previews.map((p, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-black">
              {p.type === 'video' ? <video src={p.url} className="w-full h-full object-cover" /> : <img src={p.url} className="w-full h-full object-cover" />}
              <button onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><X size={12} /></button>
            </div>
          ))}
          {type === 'post' && files.length < 10 && (
            <label className="aspect-square rounded-lg border border-dashed border-nebula-border flex items-center justify-center cursor-pointer text-nebula-muted">
              <ImagePlus size={20} />
              <input type="file" accept="image/*,video/*" multiple hidden onChange={onPick} />
            </label>
          )}
        </div>
      )}

      <textarea
        className="input-field mt-2"
        rows={3}
        placeholder="Describe the problem — what's puzzling you?"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />

      <div className="mt-3">
        <label className="eyebrow block mb-1.5">Field</label>
        <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {(categories.length ? categories : ['General']).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {type === 'post' && (
        <div className="mt-3">
          <label className="eyebrow block mb-1.5">Location (optional)</label>
          <div className="flex items-center gap-2 input-field">
            <MapPin size={14} className="text-nebula-muted" />
            <input className="bg-transparent outline-none flex-1 text-sm" placeholder="Observatory, lab, or place" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>
      )}

      <button onClick={submit} disabled={submitting} className="btn-primary w-full py-2.5 mt-5">
        {submitting ? 'Publishing…' : `Publish ${type}`}
      </button>
    </div>
  );
}
