"use client";

import {
  ARCFACE_MODEL_CDN_URL,
  ARCFACE_MODEL_LOCAL_URL,
  ARCFACE_INPUT_SIZE,
} from "./constants";

const SIZE = ARCFACE_INPUT_SIZE;

const ONNX_CDN =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/ort.wasm.min.js";

declare global {
  interface Window {
    ort?: {
      InferenceSession: {
        create(
          path: string,
          options?: { executionProviders?: string[]; graphOptimizationLevel?: string }
        ): Promise<{
          inputNames: string[];
          outputNames: string[];
          run(feeds: Record<string, { data: Float32Array | ArrayBuffer; dims: number[] }>): Promise<Record<string, { data: Float32Array | ArrayBuffer }>>;
        }>;
      };
      Tensor: new (
        type: string,
        data: Float32Array,
        dims: number[]
      ) => { data: Float32Array | ArrayBuffer };
    };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document not available"));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

async function getOrt() {
  if (typeof window !== "undefined" && window.ort) return window.ort;
  await loadScript(ONNX_CDN);
  if (!window.ort) throw new Error("ONNX Runtime failed to load");
  return window.ort;
}

let sessionPromise: Promise<{
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | ArrayBuffer }>>;
}> | null = null;

async function loadSession() {
  const ort = await getOrt();
  const options = {
    executionProviders: ["wasm"] as string[],
    graphOptimizationLevel: "all" as string,
  };
  try {
    return await ort.InferenceSession.create(ARCFACE_MODEL_CDN_URL, options);
  } catch (e) {
    if (ARCFACE_MODEL_LOCAL_URL) {
      return await ort.InferenceSession.create(ARCFACE_MODEL_LOCAL_URL, options);
    }
    throw e;
  }
}

function getSessionPromise() {
  if (!sessionPromise) sessionPromise = loadSession();
  return sessionPromise;
}

/** Get or create the ArcFace ONNX session (cached). */
export async function getArcFaceSession() {
  return getSessionPromise();
}

/** Crop face to 112x112 RGB float32 NHWC (batch, height, width, channels), normalized (img - 127.5) / 128. */
function preprocessFace(
  source: HTMLImageElement | HTMLCanvasElement,
  bbox: { x: number; y: number; width: number; height: number }
): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2d context");

  ctx.drawImage(
    source,
    bbox.x,
    bbox.y,
    bbox.width,
    bbox.height,
    0,
    0,
    SIZE,
    SIZE
  );

  const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
  const data = imageData.data;
  const nhwc = new Float32Array(1 * SIZE * SIZE * 3);

  for (let i = 0; i < SIZE * SIZE; i++) {
    const r = (data[i * 4]! - 127.5) / 128;
    const g = (data[i * 4 + 1]! - 127.5) / 128;
    const b = (data[i * 4 + 2]! - 127.5) / 128;
    nhwc[i * 3] = r;
    nhwc[i * 3 + 1] = g;
    nhwc[i * 3 + 2] = b;
  }

  return nhwc;
}

/** L2-normalize a vector in place and return it. */
function l2Normalize(arr: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i]! * arr[i]!;
  const norm = Math.sqrt(sum) || 1e-8;
  for (let i = 0; i < arr.length; i++) arr[i] = (arr[i] ?? 0) / norm;
  return arr;
}

/**
 * Run ArcFace on a cropped face and return 512-d L2-normalized embedding.
 * @param source - Image or canvas containing the full picture
 * @param bbox - Face bounding box in source coordinates
 */
export async function embedFace(
  source: HTMLImageElement | HTMLCanvasElement,
  bbox: { x: number; y: number; width: number; height: number }
): Promise<Float32Array> {
  const ort = await getOrt();
  const sess = await getArcFaceSession();
  const inputTensor = preprocessFace(source, bbox);

  const inputName = sess.inputNames[0];
  if (!inputName) throw new Error("ArcFace model has no input");
  const tensor = new ort.Tensor("float32", inputTensor, [1, SIZE, SIZE, 3]);
  const feeds: Record<string, unknown> = { [inputName]: tensor };

  const results = await sess.run(feeds as Record<string, { data: Float32Array | ArrayBuffer; dims: number[] }>);
  const outputName = sess.outputNames[0];
  if (!outputName) throw new Error("ArcFace model has no output");
  const output = results[outputName];
  if (!output) throw new Error("ArcFace model returned no output");

  const data = output.data;
  const vec =
    data instanceof Float32Array
      ? new Float32Array(data)
      : new Float32Array(data as ArrayBuffer);
  return l2Normalize(vec);
}
