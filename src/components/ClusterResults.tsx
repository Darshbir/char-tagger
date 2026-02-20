"use client";

import type { ClusterSummary, TaggedDetection } from "@/lib/types";
import { FaceThumbnail } from "./FaceThumbnail";

interface ClusterResultsProps {
  clusters: ClusterSummary[];
  tagged: TaggedDetection[];
  filesById: Map<string, File>;
}

function parseDetectionId(id: string): { imageId: string; detectionIndex: number } {
  const hash = id.indexOf("#");
  if (hash === -1) return { imageId: id, detectionIndex: 0 };
  return {
    imageId: id.slice(0, hash),
    detectionIndex: parseInt(id.slice(hash + 1), 10) || 0,
  };
}

export function ClusterResults({ clusters, tagged, filesById }: ClusterResultsProps) {
  const taggedByKey = new Map<string, TaggedDetection>();
  for (const t of tagged) {
    taggedByKey.set(`${t.imageId}#${t.detectionIndex}`, t);
  }

  if (clusters.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No faces detected. Try photos with clear faces.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Characters</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clusters.map((cluster) => {
          const detections = cluster.detectionIds
            .map((id) => {
              const t = taggedByKey.get(id);
              if (!t) return null;
              const file = filesById.get(t.imageId);
              if (!file) return null;
              return { id, file, bbox: t.bbox };
            })
            .filter((d): d is NonNullable<typeof d> => d != null);

          return (
            <div
              key={cluster.clusterId}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <h3 className="mb-3 font-medium">{cluster.name}</h3>
              <div className="flex flex-wrap gap-2">
                {detections.map(({ id, file, bbox }) => (
                  <FaceThumbnail
                    key={id}
                    file={file}
                    bbox={bbox}
                    size={56}
                    alt={cluster.name}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {detections.length} face{detections.length !== 1 ? "s" : ""}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
