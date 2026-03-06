"use client";

import { memo, useEffect, useState } from "react";
import { releaseFilePreviewUrl, retainFilePreviewUrl } from "@/lib/filePreviewCache";

interface FullImageThumbnailProps {
  file: File;
  size?: number;
  alt?: string;
  className?: string;
}

/** Renders the full image (no crop) as a square thumbnail. Used for images with no detected faces. */
export const FullImageThumbnail = memo(function FullImageThumbnail({
  file,
  size = 56,
  alt = "",
  className = "",
}: FullImageThumbnailProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = retainFilePreviewUrl(file);
    setObjectUrl(url);
    return () => releaseFilePreviewUrl(file);
  }, [file]);

  if (!objectUrl) return <div className={`rounded bg-gray-200 dark:bg-gray-700 ${className}`} style={{ width: size, height: size }} />;

  return (
    <img
      src={objectUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`rounded object-cover bg-gray-200 dark:bg-gray-700 ${className}`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
});
