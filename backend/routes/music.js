const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Proxies track search to the Jamendo API (free, no-cost licensed music)
// so the client-id secret never ships to the browser. Requires
// JAMENDO_CLIENT_ID — a free key from https://devportal.jamendo.com.
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const clientId = process.env.JAMENDO_CLIENT_ID;
    if (!clientId) {
      return res.status(503).json({ error: 'Music search isn\'t configured yet. Ask the site owner to set JAMENDO_CLIENT_ID.' });
    }

    const q = (req.query.q || '').toString().trim().slice(0, 100);
    const params = new URLSearchParams({
      client_id: clientId,
      format: 'json',
      limit: '25',
      audioformat: 'mp32',
      include: 'musicinfo',
    });
    if (q) params.set('namesearch', q);
    else params.set('order', 'popularity_total');

    const jamendoRes = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`);
    if (!jamendoRes.ok) throw new Error('Jamendo request failed');
    const json = await jamendoRes.json();

    const tracks = (json.results || []).map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artist_name,
      cover: t.album_image || t.image || null,
      url: t.audio,
      duration: t.duration,
    })).filter((t) => t.url);

    res.json({ tracks });
  } catch (err) { next(err); }
});

module.exports = router;
