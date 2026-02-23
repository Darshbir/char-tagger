/** Bounding box from face detection */
export interface Bbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Raw detection (no embedding yet). eyeAngleRad = angle of eye line for alignment (horizontal = 0). */
export interface RawDetection {
  imageId: string;
  detectionIndex: number;
  bbox: Bbox;
  /** Rotation in radians so eye line is horizontal; used when cropping for ArcFace. */
  eyeAngleRad?: number;
}

/** One detected face: image, index, box, and 512-d ArcFace embedding (L2-normalized) */
export interface DetectionWithEmbedding {
  imageId: string;
  detectionIndex: number;
  bbox: Bbox;
  embedding: Float32Array;
}

/** After clustering: each detection gets a cluster id */
export interface TaggedDetection {
  imageId: string;
  detectionIndex: number;
  bbox: Bbox;
  clusterId: number;
}

/** Cluster summary for UI: id, label, and detection ids for thumbnails */
export interface ClusterSummary {
  clusterId: number;
  name: string;
  detectionIds: string[];
}

/** Stable id for a single detection (imageId + index) */
export function detectionId(imageId: string, detectionIndex: number): string {
  return `${imageId}#${detectionIndex}`;
}

/** Progress during pipeline run */
export interface PipelineProgress {
  phase: "idle" | "loading" | "detecting" | "embedding" | "clustering" | "done" | "error";
  current?: number;
  total?: number;
  message?: string;
}
