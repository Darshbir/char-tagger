# Character Tagger

Tag recurring characters across photos and organize them in Google Drive. Photos are processed in your browser; we do not store your images.

## Setup

- **Node:** 18+
- **Package manager:** pnpm

```bash
pnpm install
cp .env.example .env
# Edit .env when you add Google OAuth (Phase 4+)
```

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
2. Set env vars from `.env.example` in the Vercel project settings when you add OAuth (Phase 4+).
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
- **Results** show per-cluster thumbnails. No images are sent to any server.
