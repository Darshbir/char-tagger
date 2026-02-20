"use client";

import type { Bbox } from "./types";
import type { DetectionWithEmbedding } from "./types";
import {
  FACE_MODEL_BASE_URL,
  DETECTION_BATCH_SIZE,
  FACE_DETECT_SCORE_THRESHOLD,
} from "./constants";
import { embedFace, getArcFaceSession } from "./arcfaceEmbedding";

export type PipelineProgressPhase =
  | "idle"
  | "loading"
  | "detecting"
  | "embedding"
  | "clustering"
  | "done"
  | "error";

export interface PipelineProgressUpdate {
  phase: PipelineProgressPhase;
  current?: number;
  total?: number;
  message?: string;
}

/** Raw detection (no embedding yet) */
export interface RawDetection {
  imageId: string;
  detectionIndex: number;
  bbox: Bbox;
}

/** Load face-api models for detection only (no face recognition net). Call once before processing. */
export async function loadFaceModels(
  baseUrl: string = FACE_MODEL_BASE_URL
): Promise<void> {
  const tf = await import("@tensorflow/tfjs");
  await tf.setBackend("webgl");
  await tf.ready();

  const faceapi = await import("@vladmandic/face-api");
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseUrl),
  ]);
}

/** Create an HTMLImageElement from a File and wait for it to load */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

/** Run face detection only (all faces) on one image. Returns raw detections, no embeddings. */
export async function detectFacesInImage(
  imageId: string,
  file: File
): Promise<RawDetection[]> {
  const faceapi = await import("@vladmandic/face-api");
  const img = await loadImageFromFile(file);

  const results = await faceapi
    .detectAllFaces(
      img,
      new faceapi.TinyFaceDetectorOptions({
        scoreThreshold: FACE_DETECT_SCORE_THRESHOLD,
      })
    )
    .withFaceLandmarks(true);

  return results.map((r, detectionIndex) => ({
    imageId,
    detectionIndex,
    bbox: {
      x: r.detection.box.x,
      y: r.detection.box.y,
      width: r.detection.box.width,
      height: r.detection.box.height,
    },
  }));
}

/** Run full pipeline: detection (face-api) then embedding (ArcFace). Returns 512-d embeddings. */
export async function runDetectionPipeline(
  files: Array<{ id: string; file: File }>,
  onProgress: (update: PipelineProgressUpdate) => void,
  batchSize: number = DETECTION_BATCH_SIZE
): Promise<DetectionWithEmbedding[]> {
  const filesById = new Map<string, File>();
  for (const { id, file } of files) filesById.set(id, file);

  // Phase 1: detect all faces
  const rawDetections: RawDetection[] = [];
  const totalImages = files.length;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    for (let j = 0; j < batch.length; j++) {
      const { id, file } = batch[j];
      onProgress({
        phase: "detecting",
        current: i + j + 1,
        total: totalImages,
        message: `Processing image ${i + j + 1} of ${totalImages}…`,
      });
      const dets = await detectFacesInImage(id, file);
      rawDetections.push(...dets);
    }
    await new Promise((r) => setTimeout(r, 0));
  }

  if (rawDetections.length === 0) return [];

  // Phase 2: load ArcFace and embed each face
  onProgress({
    phase: "embedding",
    current: 0,
    total: rawDetections.length,
    message: "Loading ArcFace model…",
  });
  await getArcFaceSession();

  const all: DetectionWithEmbedding[] = [];
  const totalFaces = rawDetections.length;

  for (let i = 0; i < rawDetections.length; i++) {
    const d = rawDetections[i]!;
    onProgress({
      phase: "embedding",
      current: i + 1,
      total: totalFaces,
      message: `Embedding face ${i + 1} of ${totalFaces}…`,
    });
    const file = filesById.get(d.imageId);
    if (!file) continue;
    const img = await loadImageFromFile(file);
    const embedding = await embedFace(img, d.bbox);
    all.push({
      imageId: d.imageId,
      detectionIndex: d.detectionIndex,
      bbox: d.bbox,
      embedding,
    });
    await new Promise((r) => setTimeout(r, 0));
  }

  return all;
}
