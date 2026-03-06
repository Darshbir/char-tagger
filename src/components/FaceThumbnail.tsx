"use client";

import { memo, useEffect, useRef } from "react";
import { loadFilePreviewImage, releaseFilePreviewUrl, retainFilePreviewUrl } from "@/lib/filePreviewCache";
import type { Bbox } from "@/lib/types";

interface FaceThumbnailProps {
  file: File;
  bbox: Bbox;
  size?: number;
  alt?: string;
  className?: string;
}

/** Renders a cropped face from an image file using canvas (bbox in image coordinates). */
export const FaceThumbnail = memo(function FaceThumbnail({ file, bbox, size = 64, alt = "", className = "" }: FaceThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    retainFilePreviewUrl(file);
    return () => releaseFilePreviewUrl(file);
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    void loadFilePreviewImage(file)
      .then((img) => {
        if (cancelled || !canvasRef.current) return;

        const dpr = window.devicePixelRatio ?? 1;
        const w = Math.round(size * dpr);
        const h = Math.round(size * dpr);
        const targetCanvas = canvasRef.current;
        if (!targetCanvas) return;

        targetCanvas.width = w;
        targetCanvas.height = h;

        const ctx = targetCanvas.getContext("2d");
        if (!ctx) return;

        const { x, y, width, height } = bbox;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, x, y, width, height, 0, 0, w, h);
      })
      .catch(() => {
        if (cancelled || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      });

    return () => {
      cancelled = true;
    };
  }, [file, bbox, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      aria-label={alt || undefined}
      className={`rounded object-cover bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{ width: size, height: size, display: "block", pointerEvents: "none" }}
    />
  );
});
