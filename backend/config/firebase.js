const admin = require('firebase-admin');

function loadServiceAccount() {
  // Preferred for Render/most PaaS: paste the service account JSON, base64-encoded,
  // into a single env var (no multiline secrets, no file to manage).
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    return JSON.parse(json);
  }
  // Also accepted: the raw JSON string itself in one env var.
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  return null;
}

if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();

  admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      // Local dev fallback: `gcloud auth application-default login`, or set
      // GOOGLE_APPLICATION_CREDENTIALS to a local key file path.
      : admin.credential.applicationDefault(),
    // Note: no storageBucket here — media uploads go to Cloudinary instead
    // (see config/upload.js), since Firebase Storage now requires the paid
    // Blaze plan even for the free-tier quota. Firestore itself is unaffected
    // and stays fully on the free Spark plan.
  });
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db };
