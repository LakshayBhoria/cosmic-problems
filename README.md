# Cosmic Problems 🌌

A social network for posting and discussing cosmic and scientific problems —
same interaction model as Instagram (feed, profiles, follows, likes, comments,
reels, saved posts, notifications, settings), but every post is a problem,
question, or observation instead of a lifestyle photo.

```
cosmic-problems/
├── backend/    Node.js + Express + Firestore REST API
└── frontend/   React + Vite + Tailwind single-page app
```

**Data layer:** [Firestore](https://firebase.google.com/docs/firestore) (NoSQL,
serverless, generous free tier) for all app data, and
[Cloudinary](https://cloudinary.com) (free tier, no card required) for
uploaded images/video. Both are external to the backend server, which means
the server itself is fully stateless — perfect for free-tier hosts like
Render, which don't offer persistent disks on their free plan.

---

## Features

Same as before — accounts & profiles, multi-image/video posts and reels with
a scientific category and an Open/Discussing/Solved status, threaded comment
discussions, likes, saves, follows (with private-account requests), blocking,
notifications, and a full Instagram-style settings menu. See the bottom of
this file for the full API surface.

---

## 1. Set up Firebase (one-time, ~5 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) →
   **Add project** (the free Spark plan is all you need).
2. **Build → Firestore Database → Create database.** Choose *production mode*
   and any region close to you. (The security rules don't matter much here —
   `firestore.rules` in this repo denies all direct client access, since the
   app only ever talks to Firestore through the backend's trusted Admin SDK,
   never from the browser.)
3. **Build → Storage → Get started.** Accept the default rules (again, the
   backend uses the Admin SDK, which bypasses these).
4. **Project settings (gear icon) → Service accounts → Generate new private
   key.** This downloads a JSON file — keep it secret, never commit it.
5. **Project settings → General** — copy your **Storage bucket** name (looks
   like `your-project.appspot.com`).
6. Base64-encode the downloaded JSON key (you'll paste the result into an env
   var in step 3 below):
   ```bash
   # macOS/Linux
   base64 -i service-account.json | tr -d '\n' > key.b64

   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json")) | Out-File key.b64
   ```
7. **Composite indexes** — this app's list queries (feed, explore, comments,
   followers, notifications, etc.) each filter on one field and sort by
   another, which Firestore requires a composite index for. Easiest path:
   just run the app and use it — the first time each query runs, Firestore
   returns an error in your Render logs with a **direct link** that creates
   the exact index needed in one click (each takes about a minute to build).
   Click through them once and you're done permanently. *(Prefer to do it
   all upfront? Install the [Firebase CLI](https://firebase.google.com/docs/cli),
   run `firebase login`, `firebase use --add` to select your project, then
   `firebase deploy --only firestore:indexes` — this repo's
   `firestore.indexes.json` already lists everything needed.)*

---

## 2. Local development

### Backend

```bash
cd backend
cp .env.example .env
```
Edit `.env`:
- `JWT_SECRET` → any long random string
- `FIREBASE_SERVICE_ACCOUNT_BASE64` → the contents of `key.b64` from step 1.6
- `FIREBASE_STORAGE_BUCKET` → your bucket name from step 1.5

```bash
npm install
npm run dev          # http://localhost:5000
```

### Frontend

```bash
cd frontend
cp .env.example .env    # leave VITE_API_URL blank for local dev
npm install
npm run dev              # http://localhost:5173
```

Open `http://localhost:5173`, register an account, and start posting.

---

## 3. Deploy to Render (free)

Because Firestore and Cloud Storage hold all the persistent state, the
backend itself needs **no disk** — so it runs entirely on Render's free plan
with no data-loss tradeoff. `backend/render.yaml` is already set up for this.

1. **Push this repo to GitHub.**
2. **Render → New → Blueprint** → connect your repo. Render detects
   `backend/render.yaml` and sets up a free Node web service with:
   - Build command `npm install`, start command `npm start`
   - Health check at `/api/health`
   - An auto-generated `JWT_SECRET`
   - Three prompts for values it can't guess — fill these in:
     - `CLIENT_URL` — leave as `http://localhost:5173` for now, you'll
       update it in step 4
     - `FIREBASE_SERVICE_ACCOUNT_BASE64` — paste the contents of `key.b64`
     - `FIREBASE_STORAGE_BUCKET` — your bucket name
3. Deploy. Note your backend URL, e.g.
   `https://cosmic-problems-api.onrender.com`.
   - Free-plan services spin down after ~15 minutes idle and take a few
     seconds to wake on the next request — normal, not a bug. Upgrade to a
     paid plan later if you want it always warm.

4. **Deploy the frontend** (Vercel, Netlify, or Cloudflare Pages — all free,
   `vercel.json`/`netlify.toml` are already included):
   - Root directory: `frontend`
   - Env var: `VITE_API_URL` = `https://cosmic-problems-api.onrender.com/api`
     (your Render URL + `/api`)
   - Deploy. Note your frontend URL, e.g. `https://cosmic-problems.vercel.app`.

5. **Close the loop:** back in Render → your service → Environment → set
   `CLIENT_URL` to your frontend URL from step 4 (no trailing slash). Saving
   triggers a redeploy, and CORS will then allow your frontend to call the API.

That's it — a fully free, persistent deployment.

*(Prefer Docker Compose on your own VM, or Railway/Fly.io? Same idea —
`docker-compose.yml` and `backend/Dockerfile`/`Procfile` are all still here
and work unchanged, since they were never SQLite-specific in the first place.
Just set the same three Firebase env vars.)*

---

## Production notes

- **Firestore query limits**: a few queries (the home feed's "posts from
  people you follow", explore's category filter) load matching documents
  into memory before paginating, rather than using Firestore cursors — fine
  at hobby/demo scale, but worth revisiting with proper cursor-based
  pagination if you expect heavy traffic.
- **Account deletion is best-effort**: Firestore has no `ON DELETE CASCADE`.
  Deleting an account removes the user and their own posts, but likes,
  comments, and follow edges referencing them are left in place (they render
  with a "[deleted]" author). Move this to a scheduled Cloud Function for a
  production app.
- **Search is prefix-only**: Firestore has no substring search, so
  `/users/search` matches on a prefix of username/full name (a standard
  Firestore trick) rather than SQL's substring `LIKE`. For real full-text
  search, add Algolia or Typesense.
- **Firestore free tier (Spark plan)** includes 1 GiB storage, 50K reads/
  20K writes/20K deletes per day, and 5 GB of Cloud Storage/1 GB downloads
  per day — generous for a personal project, but note some pages here (e.g.
  a post detail view) issue several reads per load. Watch usage in the
  Firebase console if you expect real traffic.

## What isn't built (parity gaps vs. Instagram)

Direct messages, Stories, live video, ads, multi-factor auth, and delivered
push notifications (the notification *records* exist — wiring up actual
push delivery needs a service worker + provider) weren't implemented, to
keep this a finishable, deployable app rather than an open-ended project.

---

## API overview

All endpoints are under `/api`. Auth endpoints aside, everything expects
`Authorization: Bearer <token>` for actions tied to the logged-in user; GET
endpoints for public content work without a token but personalize the
response (like/save state, follow state) when one is provided.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Users | `GET /users/search`, `GET /users/:username`, `PUT /users/me/profile`, `PUT /users/me/avatar`, `PUT /users/me/password`, `PUT /users/me/settings`, `DELETE /users/me`, `POST/DELETE /users/:id/follow`, `GET /users/:id/followers`, `GET /users/:id/following`, `POST/DELETE /users/:id/block` |
| Posts | `POST /posts`, `GET /posts/feed`, `GET /posts/explore`, `GET /posts/categories`, `GET /posts/saved`, `GET /posts/user/:userId`, `GET/DELETE /posts/:id`, `PUT /posts/:id/status`, `POST/DELETE /posts/:id/like`, `GET /posts/:id/likes`, `POST/DELETE /posts/:id/save` |
| Reels | `POST /reels`, `GET /reels` |
| Comments | `GET /comments/post/:postId`, `POST /comments/post/:postId`, `GET /comments/:id/replies`, `DELETE /comments/:id`, `POST/DELETE /comments/:id/like` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PUT /notifications/read-all`, `PUT /notifications/:id/read` |

---

## License

Built for you — do whatever you like with it.
