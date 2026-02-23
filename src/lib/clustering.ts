"use client";

import dbscan from "dbscanjs";
import { kmeans } from "ml-kmeans";
import type { DetectionWithEmbedding, TaggedDetection, ClusterSummary } from "./types";
import { detectionId } from "./types";
import {
  DBSCAN_EPSILON_DEFAULT,
  DBSCAN_MIN_POINTS_DEFAULT,
  CLUSTER_METHOD_STORAGE_KEY,
  DBSCAN_EPSILON_STORAGE_KEY,
  DBSCAN_MIN_POINTS_STORAGE_KEY,
  KMEANS_K_STORAGE_KEY,
  DETECTOR_STORAGE_KEY,
  type FaceDetectorType,
} from "./constants";

/** Cosine similarity between two L2-normalized vectors (dot product). Range [-1, 1]; we use [0, 1] for same-person. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

/** Cosine distance for DBSCAN: 1 - cosineSimilarity (so smaller = more similar). */
function cosineDistance(a: Float32Array, b: Float32Array): number {
  return 1 - cosineSimilarity(a, b);
}

export type ClusterMethod = "dbscan" | "kmeans";

export interface ClusterOptions {
  method: ClusterMethod;
  epsilon?: number;
  minPoints?: number;
  k?: number;
}

function getStoredNumber(key: string, defaultVal: number, min: number, max: number): number {
  if (typeof window === "undefined") return defaultVal;
  const stored = localStorage.getItem(key);
  if (stored == null) return defaultVal;
  const n = parseFloat(stored);
  if (!Number.isFinite(n) || n < min || n > max) return defaultVal;
  return n;
}

export function getClusterOptions(): ClusterOptions {
  const method =
    (typeof window !== "undefined" ? localStorage.getItem(CLUSTER_METHOD_STORAGE_KEY) : null) === "kmeans"
      ? "kmeans"
      : "dbscan";
  return {
    method,
    epsilon: getStoredNumber(DBSCAN_EPSILON_STORAGE_KEY, DBSCAN_EPSILON_DEFAULT, 0.1, 1),
    minPoints: Math.max(1, Math.round(getStoredNumber(DBSCAN_MIN_POINTS_STORAGE_KEY, DBSCAN_MIN_POINTS_DEFAULT, 1, 20))),
    k: Math.max(1, Math.round(getStoredNumber(KMEANS_K_STORAGE_KEY, 5, 1, 100))),
  };
}

export function setClusterOptions(options: Partial<ClusterOptions>): void {
  if (typeof window === "undefined") return;
  if (options.method !== undefined) localStorage.setItem(CLUSTER_METHOD_STORAGE_KEY, options.method);
  if (options.epsilon !== undefined) localStorage.setItem(DBSCAN_EPSILON_STORAGE_KEY, String(options.epsilon));
  if (options.minPoints !== undefined) localStorage.setItem(DBSCAN_MIN_POINTS_STORAGE_KEY, String(options.minPoints));
  if (options.k !== undefined) localStorage.setItem(KMEANS_K_STORAGE_KEY, String(options.k));
}

export function getDetectorOption(): FaceDetectorType {
  if (typeof window === "undefined") return "retinaface";
  return localStorage.getItem(DETECTOR_STORAGE_KEY) === "face-api" ? "face-api" : "retinaface";
}

export function setDetectorOption(detector: FaceDetectorType): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DETECTOR_STORAGE_KEY, detector);
}

/**
 * Cluster detections by 512-d ArcFace embeddings:
 * - Use cosine similarity (L2-normalized vectors).
 * - DBSCAN: distance = 1 - cosineSimilarity; params epsilon, minPoints.
 * - K-means: L2-normalized vectors, Euclidean ≈ cosine; param k.
 */
export function clusterDetections(
  detections: DetectionWithEmbedding[],
  options: ClusterOptions = getClusterOptions()
): { tagged: TaggedDetection[]; clusters: ClusterSummary[] } {
  const n = detections.length;
  if (n === 0) return { tagged: [], clusters: [] };

  let labels: number[];

  if (options.method === "dbscan") {
    const epsilon = options.epsilon ?? DBSCAN_EPSILON_DEFAULT;
    const minPoints = options.minPoints ?? DBSCAN_MIN_POINTS_DEFAULT;
    const embeddings = detections.map((d) => d.embedding);
    labels = dbscan(embeddings, cosineDistance, epsilon, minPoints);
  } else {
    const k = Math.min(options.k ?? 5, n);
    const data = detections.map((d) => Array.from(d.embedding));
    const result = kmeans(data, k, {});
    labels = result.clusters;
  }

  // Map labels to cluster IDs: DBSCAN uses -1 for noise; we assign noise to cluster 0 "Uncategorized"
  const uniqueLabels = Array.from(new Set(labels)).sort((a, b) => a - b);
  const labelToClusterId = new Map<number, number>();
  let nextId = 1;
  for (const L of uniqueLabels) {
    labelToClusterId.set(L, L === -1 ? 0 : nextId++);
  }

  const tagged: TaggedDetection[] = detections.map((d, i) => ({
    imageId: d.imageId,
    detectionIndex: d.detectionIndex,
    bbox: d.bbox,
    clusterId: labelToClusterId.get(labels[i]!) ?? 0,
  }));

  const clusterIdToDetectionIds = new Map<number, string[]>();
  for (const t of tagged) {
    const id = detectionId(t.imageId, t.detectionIndex);
    const list = clusterIdToDetectionIds.get(t.clusterId) ?? [];
    list.push(id);
    clusterIdToDetectionIds.set(t.clusterId, list);
  }

  const clusters: ClusterSummary[] = Array.from(clusterIdToDetectionIds.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([clusterId, detectionIds]) => ({
      clusterId,
      name: clusterId === 0 ? "Uncategorized" : `Character ${clusterId}`,
      detectionIds,
    }));

  return { tagged, clusters };
}
