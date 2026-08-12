require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Fails fast with a clear message if Firebase env vars are missing, instead
// of the app booting and every request 500-ing on its first Firestore call.
require('./config/firebase');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const app = express();

// Required on Render/Railway/Heroku/most PaaS: they sit behind a proxy, and
// express-rate-limit needs to trust its X-Forwarded-* headers to see the
// real client IP.
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());

// CLIENT_URL supports a comma-separated list, so you can allow your
// production domain plus preview deploys, e.g.:
// CLIENT_URL=https://cosmicproblems.app,https://cosmic-problems.vercel.app
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  console.warn('⚠️  CLIENT_URL is not set — allowing all origins. Set CLIENT_URL in production.');
}

app.use(cors({
  origin: allowedOrigins.length === 0 ? true : allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

// Media is served from Firebase Cloud Storage (public URLs), not this server
// — there's no local /uploads static route anymore.

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'Cosmic Problems API' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/music', require('./routes/music'));
app.use('/api/reels', require('./routes/reels'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/users', require('./routes/verification'));
app.use('/api/admin', requireAuth, requireAdmin, require('./routes/admin'));

// 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Error handler (also catches multer errors)
app.use((err, req, res, next) => {
  console.error(err);
  if (err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('Reels must be a video file')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('Avatar must be an image')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File is too large.' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong on our end.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Cosmic Problems API running on port ${PORT}`);
});
