# ArcFace ONNX model (optional)

All processing runs in the browser. The app loads the ArcFace model from a CDN by default (Hugging Face); the browser downloads it when you first run "Process". No server hosting is required.

## If the CDN is blocked (e.g. CORS)

Place the model here so the app can fall back to it:

- **File:** `public/models/arcface.onnx`
- **Source:** https://huggingface.co/garavv/arcface-onnx/resolve/main/arc.onnx (download and save as `arcface.onnx` in this folder)

Then the app will try the CDN first and use this file if the CDN request fails.

## Model details

- **Input:** 112×112 RGB face crop, shape `(1, 3, 112, 112)` (NCHW), float32, normalized `(pixel - 127.5) / 128`.
- **Output:** 512-d face embedding (L2-normalized for cosine similarity).
