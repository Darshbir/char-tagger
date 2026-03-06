type PreviewCacheEntry = {
  url: string;
  refs: number;
  image?: HTMLImageElement;
  imagePromise?: Promise<HTMLImageElement>;
};

const previewCache = new WeakMap<File, PreviewCacheEntry>();

function createEntry(file: File): PreviewCacheEntry {
  return {
    url: URL.createObjectURL(file),
    refs: 0,
  };
}

function getOrCreateEntry(file: File): PreviewCacheEntry {
  let entry = previewCache.get(file);
  if (!entry) {
    entry = createEntry(file);
    previewCache.set(file, entry);
  }
  return entry;
}

export function retainFilePreviewUrl(file: File): string {
  const entry = getOrCreateEntry(file);
  entry.refs += 1;
  return entry.url;
}

export function releaseFilePreviewUrl(file: File): void {
  const entry = previewCache.get(file);
  if (!entry) return;

  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;

  URL.revokeObjectURL(entry.url);
  previewCache.delete(file);
}

export function loadFilePreviewImage(file: File): Promise<HTMLImageElement> {
  const entry = getOrCreateEntry(file);

  if (entry.image) {
    return Promise.resolve(entry.image);
  }

  if (entry.imagePromise) {
    return entry.imagePromise;
  }

  entry.imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      entry.image = img;
      entry.imagePromise = undefined;
      resolve(img);
    };
    img.onerror = () => {
      entry.imagePromise = undefined;
      reject(new Error(`Failed to load preview image for ${file.name}`));
    };
    img.src = entry.url;
  });

  return entry.imagePromise;
}