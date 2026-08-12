const express = require('express');
const { db } = require('../config/firebase');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadReelMedia, uploadBufferToStorage } = require('../config/upload');
const { attachPostExtras } = require('../lib/serialize');

const router = express.Router();

// Upload a reel (single video)
router.post('/', requireAuth, uploadReelMedia.single('video'), async (req, res, next) => {
  try {
    const { caption, category } = req.body;
    if (!req.file) return res.status(400).json({ error: 'A video file is required for reels.' });

    const url = await uploadBufferToStorage(req.file, 'reels');
    const data = {
      user_id: req.user.id, type: 'reel',
      caption: caption || '', category: category || 'General', status: 'open', location: '',
      media: [{ media_url: url, media_type: 'video', position: 0 }],
      created_at: new Date().toISOString(),
    };
    const docRef = await db.collection('posts').add(data);
    const reel = await attachPostExtras(docRef.id, data, req.user.id);
    res.status(201).json({ reel });
  } catch (err) { next(err); }
});

// Reels feed - vertical scroll, most recent first
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '0', 10);
    const limit = 8;
    const snap = await db.collection('posts').where('type', '==', 'reel')
      .orderBy('created_at', 'desc').limit(limit).offset(page * limit).get();
    const reels = await Promise.all(snap.docs.map((d) => attachPostExtras(d.id, d.data(), req.user && req.user.id)));
    res.json({ reels });
  } catch (err) { next(err); }
});

module.exports = router;
