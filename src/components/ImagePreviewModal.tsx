"use client";

import { useCallback, useEffect, useState } from "react";

type ImagePreviewModalProps = {
  files: File[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
};

export function ImagePreviewModal({
  files,
  initialIndex,
  isOpen,
  onClose,
}: ImagePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const file = files[currentIndex];
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setCurrentIndex(Math.min(initialIndex, files.length - 1));
  }, [initialIndex, files.length, isOpen]);

  useEffect(() => {
    if (!isOpen || !files[currentIndex]) return;
    const objectUrl = URL.createObjectURL(files[currentIndex]);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [isOpen, files, currentIndex]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i <= 0 ? files.length - 1 : i - 1));
  }, [files.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i >= files.length - 1 ? 0 : i + 1));
  }, [files.length]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  if (!isOpen || files.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close preview"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <span className="min-w-0 flex-1 truncate font-medium" title={file?.name}>
            {file?.name}
          </span>
          <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
            {currentIndex + 1} / {files.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
          {files.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 dark:bg-gray-800"
                aria-label="Previous image"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 dark:bg-gray-800"
                aria-label="Next image"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          <div className="flex max-h-[70vh] max-w-full items-center justify-center">
            {url ? (
              <img
                src={url}
                alt={file?.name ?? ""}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            ) : (
              <div className="h-64 w-64 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
