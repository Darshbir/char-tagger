# Character Tagger

Tag recurring characters across photos and organize them in Google Drive. Photos are processed in your browser; we do not store your images.

## Setup

- **Node:** 18+
- **Package manager:** pnpm

```bash
pnpm install
cp .env.example .env
# Edit .env to enable Google Drive OAuth
```

## Google Drive OAuth (Phase 4)

TripTag now includes the Phase 4 auth flow for Google Drive:

- `GET /api/auth/google` starts Google OAuth with PKCE
- `GET /api/auth/callback` exchanges the code and stores an encrypted refresh-token session cookie
- `GET /api/auth/me` returns the current signed-in Google user
- `POST /api/auth/logout` clears the Drive session

Set these environment variables before testing Drive sign-in locally or on Vercel:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET` — any strong random secret used to encrypt the httpOnly Drive session cookie
- `NEXTAUTH_URL` — your app origin, such as `http://localhost:3000`

In Google Cloud Console:

1. Enable the Google Drive API.
2. Create a Web OAuth client.
3. Add the callback URL: `http://localhost:3000/api/auth/callback` for local dev.
4. Add your production callback URL: `https://your-app.vercel.app/api/auth/callback`.

## Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
pnpm run build
pnpm start
```

## Deploy (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Set env vars from `.env.example` in the Vercel project settings.
3. Deploy; no extra config needed for Next.js.

## Project structure

- `src/app/` – Next.js App Router (layout, page)
- `src/components/` – UI (Layout, UploadZone, ClusterResults, FaceThumbnail)
- `src/lib/` – utils, constants, face pipeline, ArcFace embedding, clustering
- `src/hooks/` – React hooks (e.g. `useFacePipeline`)
- `public/models/` – ArcFace ONNX model (see `public/models/README.md`); face-api detection loads from CDN

## In-browser ML pipeline

After uploading photos, click **Process** to run face detection and grouping in your browser:

- **Face detection:** face-api.js (Tiny Face Detector from CDN). Detects **all faces** per image; lower score threshold for higher recall.
- **Embeddings:** ONNX Runtime Web + ArcFace. All in the browser: ONNX Runtime and the ArcFace model are loaded from CDN on first run (no server hosting). Optional: if the model CDN is blocked, put `arcface.onnx` in `public/models/` for fallback (see `public/models/README.md`). Produces 512-d L2-normalized embeddings.
- **Clustering:** Cosine similarity with **DBSCAN** (default) or **K-means**. DBSCAN uses `epsilon` and `minPoints`; K-means uses expected number of characters (k). Options are in the UI and persisted in `localStorage`.
- **Results** show per-cluster thumbnails. No images are sent to our server.

## Privacy model

- Photos are processed locally in the browser.
- Phase 4 adds optional Google Drive sign-in only.
- When connected, the app stores an encrypted refresh token in an httpOnly session cookie so future Drive routes can request access tokens server-side.
- Photo bytes still do not pass through the app server.
