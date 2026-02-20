// App constants
export const APP_NAME = "Character Tagger";

// Face detection (face-api.js)
/** Base URL for face-api models (CDN or /models if self-hosted) */
export const FACE_MODEL_BASE_URL =
  typeof window !== "undefined"
    ? "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model"
    : "";

/** Lower score = more faces detected (higher recall). Default 0.3 for robustness. */
export const FACE_DETECT_SCORE_THRESHOLD = 0.3;

/** Number of images to process in one batch before yielding to UI */
export const DETECTION_BATCH_SIZE = 5;

// ArcFace embeddings (ONNX) — all loaded in the browser
/** ArcFace ONNX model: default CDN (browser downloads; no server hosting). Fallback: /models/arcface.onnx if self-hosted. */
export const ARCFACE_MODEL_CDN_URL =
  typeof window !== "undefined"
    ? "https://huggingface.co/garavv/arcface-onnx/resolve/main/arc.onnx"
    : "";
/** Local fallback when CDN is blocked (e.g. CORS); put arcface.onnx in public/models/ */
export const ARCFACE_MODEL_LOCAL_URL = "/models/arcface.onnx";

/** ArcFace input size (width and height) */
export const ARCFACE_INPUT_SIZE = 112;

// Clustering (cosine similarity + DBSCAN / k-means)
/** DBSCAN: max distance (1 - cosineSimilarity) to link two faces. Lower = stricter. */
export const DBSCAN_EPSILON_DEFAULT = 0.4;

/** DBSCAN: min points to form a cluster (1 = single face can be its own cluster) */
export const DBSCAN_MIN_POINTS_DEFAULT = 1;

// Phase 3: Tag edit UX — cluster 0 is reserved for "Uncategorized"
export const UNCATEGORIZED_CLUSTER_ID = 0;

/** localStorage keys for user-tunable clustering */
export const CLUSTER_METHOD_STORAGE_KEY = "char-tagger-cluster-method";
export const DBSCAN_EPSILON_STORAGE_KEY = "char-tagger-dbscan-epsilon";
export const DBSCAN_MIN_POINTS_STORAGE_KEY = "char-tagger-dbscan-minpoints";
export const KMEANS_K_STORAGE_KEY = "char-tagger-kmeans-k";
