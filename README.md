# TripTag — Sort trip photos by person, privately

Tag recurring people across photos and organise them in Google Drive. Every photo is processed in your browser, we never see your images. Try it out [here](https://triptag.vercel.app).

## Setup

- **Node:** 18+
- **Package manager:** pnpm

```bash
pnpm install
cp .env.example .env
# Edit .env to enable Google Drive OAuth
```

## System Requirements

### Browsers (AI mode)

| Browser | Minimum version | Notes |
|---------|----------------|-------|
| Chrome / Chromium | 90+ | Recommended; best WebAssembly performance |
| Edge | 90+ | Chromium-based, identical performance |
| Firefox | 88+ | Fully supported |
| Safari | 14.1+ | Supported; WASM performance slightly lower |

**WebGL 2.0** is required for the face-api.js detector backend. All modern desktop browsers support it. If WebGL is unavailable, the app falls back to **manual mode** automatically (see [Manual Mode](#manual-mode-ai-unavailable)).

### Memory

- **Recommended:** 4 GB RAM free for smooth processing
- **Mobile devices:** Supported for small batches; processing 50+ photos may trigger out-of-memory errors on older phones
- **Tip:** Close other tabs before processing large batches (100+ photos)

---

## Google Drive OAuth

TripTag includes Google Drive auth for exporting tagged photo folders:

- `GET /api/auth/google` — starts Google OAuth with PKCE
- `GET /api/auth/callback` — exchanges code, stores encrypted refresh-token in an httpOnly cookie
- `GET /api/auth/me` — returns the signed-in Google user
- `POST /api/auth/logout` — clears the Drive session

### Required environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console | `123….apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret | `GOCSPX-…` |
| `AUTH_SECRET` | Random secret for encrypting the session cookie | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app origin | `http://localhost:3000` |

### Google Cloud Console setup

1. Enable the **Google Drive API** in [Google Cloud Console](https://console.cloud.google.com).
2. Create an **OAuth 2.0 Web Client** credential.
3. Add authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback` (local dev)
   - `https://your-app.vercel.app/api/auth/callback` (production)
4. Copy the Client ID and Secret into your `.env`.

---

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

---

## Deploy (Vercel)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. Set the four env vars from `.env.example` in the Vercel project **Environment Variables** settings.
3. Deploy — `vercel.json` handles security headers and the Next.js build automatically.

---

## Pre-Deployment Checklist

- [ ] Google Cloud Console OAuth 2.0 Web Client created
- [ ] Google Drive API enabled in the project
- [ ] Callback URLs configured for both localhost and production domain
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `NEXTAUTH_URL` set in Vercel dashboard
- [ ] `AUTH_SECRET` generated with `openssl rand -base64 32` (never reuse across environments)
- [ ] `pnpm run build` passes with no errors locally
- [ ] `pnpm run lint` passes with no warnings
- [ ] OAuth flow tested on Vercel preview deployment (sign in → export to Drive)
- [ ] CDN fallback tested: block `cdn.jsdelivr.net` and `huggingface.co` in DevTools → verify manual mode banner appears
- [ ] End-to-end test with 10–20 photos containing multiple people
- [ ] Error boundary verified: temporarily throw in a component, confirm fallback UI renders

---

## Project Structure

- `src/app/` — Next.js App Router (layout, page, error boundary)
- `src/components/` — UI (Layout, UploadZone, ClusterResults, FaceThumbnail, DriveExportModal, …)
- `src/lib/` — utils, constants, face pipeline, ArcFace embedding, clustering, Drive export
- `src/hooks/` — React hooks (`useFacePipeline`, `useGoogleAuth`, `useTouchDrag`)
- `public/models/` — Optional local ONNX model files (see `public/models/README.md`)

---

## In-browser ML Pipeline

After uploading photos, click **Tag my trip** to run the full pipeline entirely in your browser:

1. **Face detection** — RetinaFace ONNX model (default) or face-api.js TinyFaceDetector. Loaded from CDN on first run with a local `/public/models/` fallback.
2. **Embeddings** — ArcFace ONNX via ONNX Runtime Web. Produces 512-d L2-normalised vectors (`(pixel − 127.5) / 128`). Loaded from HuggingFace CDN with `/models/arcface.onnx` local fallback.
3. **Clustering** — DBSCAN (default, auto-detects count) or K-means (fixed k). Cosine similarity on embeddings; cluster 0 = "Uncategorised" (noise points).

No photo bytes are ever sent to our server.

---

## Manual Mode (AI Unavailable)

If ML models fail to load (WebGL disabled, CDN blocked, or insufficient memory), TripTag enters **manual mode**:

- A warning banner appears in the upload screen.
- After uploading photos, click **Continue in manual mode**.
- All photos are placed in a default "Group 1" folder — rename it and create additional groups by using the results UI.
- Drag-and-drop photo reassignment works identically to AI mode.
- Google Drive export works exactly the same way.

To test manual mode: block `cdn.jsdelivr.net` and `huggingface.co` in Chrome DevTools → Network → Request blocking, then reload the page.

---

## Performance Characteristics

Processing times depend on device CPU, photo resolution, and number of faces per image.

| Batch size | Laptop (M1/i7) | Mid-range phone |
|-----------|---------------|----------------|
| 20 photos | ~30–60 s | ~2–3 min |
| 50 photos | ~1.5–3 min | ~5–8 min |
| 100 photos | ~4–7 min | ~12–18 min |

**Factors that affect speed:**
- Higher-resolution photos (>12 MP) increase detection time; images are resized to 640 px wide before inference
- More faces per photo increases embedding time linearly
- RetinaFace (default) is more accurate but ~2× slower than face-api TinyFaceDetector; switch in **Advanced settings**
- First run is slower while ONNX models download and compile (~30–120 s on first load, cached thereafter)

**Memory patterns:**
- Each photo is decoded into a `<canvas>` element for inference, then released
- Peak memory is roughly proportional to the largest single photo's resolution
- If the browser tab crashes, reduce batch size or switch to a desktop browser

---

## Rate Limits and Quotas

### Google Drive API

- **Default quota:** 1,000 requests per 100 seconds per user
- **Typical export consumption:** ~3–5 API calls per photo (upload + shortcut + permission) plus ~5–10 calls for folder creation
- **Example:** 50 photos → ~160–260 API calls — well within the default quota
- **Quota exceeded behaviour:** The app retries with exponential back-off (up to 3 attempts, 1 s / 2 s / 4 s delays). If all retries fail, an error message is shown with a Retry button.

### Google Drive Storage

- The export uploads original photos to an "All" folder and creates Drive shortcuts in per-character folders (shortcuts do not consume additional storage).
- The app checks available Drive storage before exporting and aborts with a clear message if space is insufficient.

---

## Privacy Model

- Photos are processed locally in the browser; zero bytes reach our server.
- Optional Google Drive sign-in stores an encrypted refresh token in an httpOnly session cookie — only Drive API calls pass through the server, never photo data.
- No analytics, telemetry, or third-party tracking scripts.

---

## Troubleshooting

### "Models won't load" / pipeline stuck on "Loading…"

1. Check your internet connection — models load from CDN on first run.
2. Check if a browser extension or corporate firewall is blocking `cdn.jsdelivr.net` or `huggingface.co`.
3. Self-host the models: place `arcface.onnx` and `retinaface.onnx` in `public/models/` (see `public/models/README.md`). The app falls back to `/models/` automatically.
4. Switch to **manual mode** if AI is not essential for your use case.

### "Out of memory" / tab crashes

- Process in smaller batches (< 30 photos at a time).
- Close other browser tabs to free memory.
- Use a desktop browser instead of mobile.
- Switch to the **face-api TinyFaceDetector** in Advanced settings — it uses less memory than RetinaFace.

### "OAuth fails" / "redirect_uri_mismatch"

1. Open Google Cloud Console → OAuth 2.0 credentials.
2. Confirm the callback URL `https://your-app.vercel.app/api/auth/callback` is listed under **Authorised redirect URIs**.
3. Ensure `NEXTAUTH_URL` in Vercel matches your actual deployment domain exactly (no trailing slash).
4. After editing credentials in Google Console, wait ~5 minutes for propagation.

### "Drive upload stuck" / upload progress stops

- Check your Google Drive storage quota in [drive.google.com/settings/storage](https://drive.google.com/settings/storage).
- Check your internet connection — large photo uploads can time out on slow connections.
- Click **Retry** if shown, or close the modal and re-open it to restart the export.
- If the issue persists, the Google Drive API may be temporarily rate-limited; wait a few minutes and retry.

### "WebGL not available" / AI features disabled

- Enable WebGL in your browser: `chrome://flags/#use-webgl` (Chrome), `about:config` → `webgl.disabled = false` (Firefox).
- If you are on a virtual machine or remote desktop, GPU acceleration may be disabled — use manual mode.
- On iOS 15 and earlier, WebGL 2.0 may not be available; upgrade iOS or use a desktop browser.

---

## Production Monitoring (Optional)

TripTag does not include monitoring by default. For production deployments, these free-tier services integrate well:

### Error tracking — Sentry

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Add to `.env`:
```
NEXT_PUBLIC_SENTRY_DSN=https://…@sentry.io/…
```

### Privacy-preserving analytics — Plausible

Add to `src/app/layout.tsx`:
```tsx
<Script defer data-domain="your-domain.com" src="https://plausible.io/js/script.js" />
```

No PII, no cookies, GDPR-compliant. Only page views and custom events — never photo data or Drive content.

---

## Health Check Endpoint (Optional)

For uptime monitoring, add `src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ status: "ok", version: "0.1.0" });
}
```

Point your uptime monitor (e.g. [Better Uptime](https://betteruptime.com), [UptimeRobot](https://uptimerobot.com)) to `https://your-app.vercel.app/api/health`.
