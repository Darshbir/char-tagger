"use client";

import { useCallback, useState } from "react";
import type { ClusterSummary, TaggedDetection } from "@/lib/types";
import { UNCATEGORIZED_CLUSTER_ID } from "@/lib/constants";
import { FaceThumbnail } from "./FaceThumbnail";

interface ClusterResultsProps {
  clusters: ClusterSummary[];
  tagged: TaggedDetection[];
  filesById: Map<string, File>;
  onRename?: (clusterId: number, name: string) => void;
  onMerge?: (sourceClusterId: number, targetClusterId: number) => void;
  onSplit?: (clusterId: number, detectionIdsToMove: string[], targetClusterId?: number) => void;
  onAssignToCluster?: (detectionIds: string[], targetClusterId: number) => void;
}

export function ClusterResults({
  clusters,
  tagged,
  filesById,
  onRename,
  onMerge,
  onSplit,
  onAssignToCluster,
}: ClusterResultsProps) {
  const taggedByKey = new Map<string, TaggedDetection>();
  for (const t of tagged) {
    taggedByKey.set(`${t.imageId}#${t.detectionIndex}`, t);
  }

  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [splitClusterId, setSplitClusterId] = useState<number | null>(null);
  const [splitSelected, setSplitSelected] = useState<Set<string>>(new Set());

  const handleRenameSubmit = useCallback(
    (clusterId: number, value: string) => {
      const trimmed = value.trim();
      if (trimmed && onRename) onRename(clusterId, trimmed);
      setEditingNameId(null);
    },
    [onRename]
  );

  const toggleSplitSelection = useCallback((id: string) => {
    setSplitSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSplitMove = useCallback(
    (clusterId: number, targetClusterId: number | "new") => {
      if (splitSelected.size === 0 || !onSplit) return;
      onSplit(
        clusterId,
        Array.from(splitSelected),
        targetClusterId === "new" ? undefined : targetClusterId
      );
      setSplitClusterId(null);
      setSplitSelected(new Set());
    },
    [splitSelected, onSplit]
  );

  const handleAssignToUncategorized = useCallback(
    (detectionIds: string[]) => {
      if (detectionIds.length === 0 || !onAssignToCluster) return;
      onAssignToCluster(detectionIds, UNCATEGORIZED_CLUSTER_ID);
      setSplitClusterId(null);
      setSplitSelected(new Set());
    },
    [onAssignToCluster]
  );

  if (clusters.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No faces detected. Try photos with clear faces.
      </p>
    );
  }

  const isEditable = Boolean(onRename || onMerge || onSplit || onAssignToCluster);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Characters</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Rename, merge, or split clusters before exporting. Assign faces to Uncategorized if they
        aren’t a recurring character.
      </p>
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

          const isUncategorized = cluster.clusterId === UNCATEGORIZED_CLUSTER_ID;
          const isSplitMode = splitClusterId === cluster.clusterId;
          const otherClusters = clusters.filter((c) => c.clusterId !== cluster.clusterId);

          return (
            <div
              key={cluster.clusterId}
              className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {editingNameId === cluster.clusterId && onRename ? (
                  <input
                    type="text"
                    defaultValue={cluster.name}
                    className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                    placeholder="Character name"
                    onBlur={(e) => handleRenameSubmit(cluster.clusterId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRenameSubmit(cluster.clusterId, (e.target as HTMLInputElement).value);
                      }
                      if (e.key === "Escape") setEditingNameId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <h3 className="font-medium">{cluster.name}</h3>
                )}
                {isEditable && editingNameId !== cluster.clusterId && onRename && (
                  <button
                    type="button"
                    onClick={() => setEditingNameId(cluster.clusterId)}
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Rename
                  </button>
                )}
              </div>

              {isSplitMode ? (
                <>
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    Select faces to move, then choose destination.
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {detections.map(({ id, file, bbox }) => (
                      <label
                        key={id}
                        className="relative flex cursor-pointer flex-col items-center gap-1"
                      >
                        <input
                          type="checkbox"
                          checked={splitSelected.has(id)}
                          onChange={() => toggleSplitSelection(id)}
                          className="absolute left-1 top-1 z-10 rounded"
                        />
                        <FaceThumbnail file={file} bbox={bbox} size={56} alt="" />
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Move to:</span>
                    <button
                      type="button"
                      onClick={() => handleSplitMove(cluster.clusterId, "new")}
                      disabled={splitSelected.size === 0}
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500"
                    >
                      New character
                    </button>
                    {otherClusters.map((c) => (
                      <button
                        key={c.clusterId}
                        type="button"
                        onClick={() => handleSplitMove(cluster.clusterId, c.clusterId)}
                        disabled={splitSelected.size === 0}
                        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      >
                        {c.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAssignToUncategorized(Array.from(splitSelected))}
                      disabled={splitSelected.size === 0}
                      className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200"
                    >
                      Uncategorized
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSplitClusterId(null);
                        setSplitSelected(new Set());
                      }}
                      className="text-xs text-gray-500 hover:underline dark:text-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
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
                  {isEditable && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {onMerge && otherClusters.length > 0 && (
                        <select
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                          value=""
                          onChange={(e) => {
                            const target = parseInt(e.target.value, 10);
                            if (!Number.isNaN(target) && onMerge)
                              onMerge(cluster.clusterId, target);
                            e.target.value = "";
                          }}
                          aria-label="Merge into"
                        >
                          <option value="">Merge into…</option>
                          {otherClusters.map((c) => (
                            <option key={c.clusterId} value={c.clusterId}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {onSplit && detections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSplitClusterId(cluster.clusterId)}
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                        >
                          Split
                        </button>
                      )}
                      {onAssignToCluster && !isUncategorized && detections.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleAssignToUncategorized(cluster.detectionIds)
                          }
                          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200"
                        >
                          Move all to Uncategorized
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
