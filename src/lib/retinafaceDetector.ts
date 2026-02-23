"use client";

import type { InferenceSession, Tensor } from "onnxruntime-web";
import type { RawDetection } from "./types";
import { getOrt } from "./arcfaceEmbedding";
import {
  RETINAFACE_MODEL_CDN_URL,
  RETINAFACE_MODEL_LOCAL_URL,
} from "./constants";
import Retinaface from "retinaface";

let sessionPromise: Promise<Retinaface> | null = null;

async function loadRetinaFaceSession(): Promise<Retinaface> {
  if (sessionPromise) return sessionPromise;
  const ort = await getOrt();
  const options = {
    executionProviders: ["wasm"] as string[],
    graphOptimizationLevel: "all" as string,
  };
  sessionPromise = (async () => {
    try {
      const session = (await ort.InferenceSession.create(
        RETINAFACE_MODEL_CDN_URL,
        options
      )) as unknown as InferenceSession;
      return new Retinaface(session, ort.Tensor as unknown as typeof Tensor);
    } catch (e) {
      if (RETINAFACE_MODEL_LOCAL_URL) {
        const session = (await ort.InferenceSession.create(
          RETINAFACE_MODEL_LOCAL_URL,
          options
        )) as unknown as InferenceSession;
        return new Retinaface(session, ort.Tensor as unknown as typeof Tensor);
      }
      throw e;
    }
  })();
  return sessionPromise;
}

export async function getRetinaFaceSession(): Promise<Retinaface> {
  return loadRetinaFaceSession();
}

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

/**
 * Run RetinaFace detection on one image. Returns RawDetection[] in original image coordinates.
 */
export async function detectFacesRetinaFace(
  imageId: string,
  file: File,
  probThreshold: number = 0.5,
  nmsThreshold: number = 0.5
): Promise<RawDetection[]> {
  const retinaface = await getRetinaFaceSession();
  const img = await loadImageFromFile(file);
  const [imageData, scale] = retinaface.processImage(img);
  const faces = await retinaface.detect(
    imageData,
    scale,
    probThreshold,
    nmsThreshold
  );
  return faces.map((face, detectionIndex) => {
    const [x0, y0, x1, y1] = face.rect;
    let eyeAngleRad: number | undefined;
    if (face.landmarks.length >= 2) {
      const [leftX, leftY] = face.landmarks[0]!;
      const [rightX, rightY] = face.landmarks[1]!;
      eyeAngleRad = Math.atan2(rightY - leftY, rightX - leftX);
    }
    return {
      imageId,
      detectionIndex,
      bbox: {
        x: x0,
        y: y0,
        width: x1 - x0,
        height: y1 - y0,
      },
      eyeAngleRad,
    };
  });
}
