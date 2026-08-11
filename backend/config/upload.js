const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('./cloudinary');

const IMAGE_TYPES = /jpeg|jpg|png|gif|webp/;
const VIDEO_TYPES = /mp4|mov|webm|avi|mkv/;

function mediaFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (IMAGE_TYPES.test(ext) || VIDEO_TYPES.test(ext)) return cb(null, true);
  cb(new Error('Unsupported file type. Only images and videos are allowed.'));
}

const maxMb = parseInt(process.env.MAX_UPLOAD_MB || '100', 10);

// Render (and most PaaS free tiers) have no persistent disk, so files are
// held in memory just long enough to stream to Firebase Cloud Storage.
const memoryStorage = multer.memoryStorage();

const uploadPostMedia = multer({
  storage: memoryStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: maxMb * 1024 * 1024 }
});

const uploadReelMedia = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (VIDEO_TYPES.test(ext)) return cb(null, true);
    cb(new Error('Reels must be a video file.'));
  },
  limits: { fileSize: maxMb * 1024 * 1024 }
});

const uploadAvatar = multer({
  storage: memoryStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (IMAGE_TYPES.test(ext)) return cb(null, true);
    cb(new Error('Avatar must be an image file.'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

function mediaTypeFor(filename) {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  return VIDEO_TYPES.test(ext) ? 'video' : 'image';
}

// Uploads an in-memory file (from multer memoryStorage) to Cloudinary under
// `folder/`, and returns its public URL. Cloudinary's free tier needs no
// billing info, unlike Firebase Storage.
async function uploadBufferToStorage(file, folder) {
  const isVideo = VIDEO_TYPES.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
  const publicId = uuidv4();

  const result = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `cosmic-problems/${folder}`,
        public_id: publicId,
        resource_type: isVideo ? 'video' : 'image',
      },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    uploadStream.end(file.buffer);
  });

  return result.secure_url;
}

// Deletes a previously uploaded file given its public Cloudinary URL. Used
// when overwriting an avatar or deleting a post's media. Failures are
// swallowed (non-fatal) — a dangling object in storage isn't worth failing
// the user's request over.
async function deleteFromStorage(publicUrl) {
  if (!publicUrl || !publicUrl.includes('res.cloudinary.com')) return;
  try {
    // URL shape: .../upload/v<version>/cosmic-problems/<folder>/<publicId>.<ext>
    const afterUpload = publicUrl.split('/upload/')[1];
    if (!afterUpload) return;
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const publicId = withoutVersion.replace(/\.[^/.]+$/, '');
    const isVideo = VIDEO_TYPES.test(publicUrl.split('.').pop());
    await cloudinary.uploader.destroy(publicId, { resource_type: isVideo ? 'video' : 'image' });
  } catch (err) {
    // ignore — object may already be gone
  }
}

module.exports = { uploadPostMedia, uploadReelMedia, uploadAvatar, mediaTypeFor, uploadBufferToStorage, deleteFromStorage };
