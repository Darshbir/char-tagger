"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClusterSummary, TaggedDetection } from "@/lib/types";
import { UNCATEGORIZED_CLUSTER_ID } from "@/lib/constants";
import { FaceThumbnail } from "./FaceThumbnail";
import { FullImageThumbnail } from "./FullImageThumbnail";

const DRAG_TYPE = "application/x-char-tagger-detection";
const DRAG_TYPE_CLUSTER = "application/x-char-tagger-cluster";

function getClusterDragData(e: React.DragEvent): number | null {
  const raw = e.dataTransfer.getData(DRAG_TYPE_CLUSTER);
  if (raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/** Auto-scroll when dragging near top/bottom of viewport */
const DRAG_SCROLL_EDGE_THRESHOLD = 80;
const DRAG_SCROLL_SPEED = 14;
const DRAG_SCROLL_THROTTLE_MS = 16;

function getDragData(e: React.DragEvent): { detectionId: string; sourceClusterId: number } | null {
  const raw = e.dataTransfer.getData(DRAG_TYPE);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { detectionId: string; sourceClusterId: number };
    if (typeof data.detectionId !== "string" || typeof data.sourceClusterId !== "number")
      return null;
    return data;
  } catch {
    return null;
  }
}

/** Zoom-directions style four-arrows icon (draggable indicator). */
function DragHandleIcon({ className }: { className?: string }) {
  return (
    <img
      src="/icons/four-arrows.svg"
      alt=""
      className={className}
      width={12}
      height={12}
      draggable={false}
      aria-hidden
    />
  );
}

interface ClusterResultsProps {
  clusters: ClusterSummary[];
  tagged: TaggedDetection[];
  filesById: Map<string, File>;
  /** Image IDs that had no faces detected; shown as full-image thumbnails in Uncategorized */
  imageIdsWithNoFaces?: string[];
  onRename?: (clusterId: number, name: string) => void;
  onMerge?: (sourceClusterId: number, targetClusterId: number) => void;
  onSplit?: (clusterId: number, detectionIdsToMove: string[], targetClusterId?: number) => void;
  onAssignToCluster?: (detectionIds: string[], targetClusterId: number) => void;
}

export function ClusterResults({
  clusters,
  tagged,
  filesById,
  imageIdsWithNoFaces = [],
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
  const [dragOverClusterId, setDragOverClusterId] = useState<number | null>(null);
  const [dragSourceClusterId, setDragSourceClusterId] = useState<number | null>(null);
  const [dragOverCreateNewSide, setDragOverCreateNewSide] = useState<"left" | "right" | null>(null);
  const [dragSourceClusterIdForCard, setDragSourceClusterIdForCard] = useState<number | null>(null);
  const [dragOverClusterIdForCard, setDragOverClusterIdForCard] = useState<number | null>(null);
  const dragScrollLastRef = useRef(0);

  /** Auto-scroll when dragging face or cluster card */
  useEffect(() => {
    const active = dragSourceClusterId !== null || dragSourceClusterIdForCard !== null;
    if (!active) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - dragScrollLastRef.current < DRAG_SCROLL_THROTTLE_MS) return;
      const y = e.clientY;
      const threshold = DRAG_SCROLL_EDGE_THRESHOLD;
      if (y < threshold) {
        dragScrollLastRef.current = now;
        window.scrollBy({ top: -DRAG_SCROLL_SPEED, behavior: "auto" });
      } else if (y > window.innerHeight - threshold) {
        dragScrollLastRef.current = now;
        window.scrollBy({ top: DRAG_SCROLL_SPEED, behavior: "auto" });
      }
    };
    document.addEventListener("dragover", onDragOver, false);
    return () => document.removeEventListener("dragover", onDragOver, false);
  }, [dragSourceClusterId, dragSourceClusterIdForCard]);

  const handleRenameSubmit = useCallback(
    (clusterId: number, value: string) => {
      const trimmed = value.trim();
      if (trimmed && onRename) onRename(clusterId, trimmed);
      setEditingNameId(null);
    },
    [onRename]
  );

  const handleAssignToUncategorized = useCallback(
    (detectionIds: string[]) => {
      if (detectionIds.length === 0 || !onAssignToCluster) return;
      onAssignToCluster(detectionIds, UNCATEGORIZED_CLUSTER_ID);
    },
    [onAssignToCluster]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, detectionId: string, sourceClusterId: number) => {
      e.dataTransfer.setData(
        DRAG_TYPE,
        JSON.stringify({ detectionId, sourceClusterId })
      );
      e.dataTransfer.effectAllowed = "move";
      setDragSourceClusterId(sourceClusterId);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetClusterId: number) => {
      e.preventDefault();
      setDragOverClusterId(null);
      setDragOverCreateNewSide(null);
      setDragSourceClusterId(null);
      const data = getDragData(e);
      if (!data || !onAssignToCluster || data.sourceClusterId === targetClusterId)
        return;
      onAssignToCluster([data.detectionId], targetClusterId);
    },
    [onAssignToCluster]
  );

  const handleDropCreateNew = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverCreateNewSide(null);
      setDragOverClusterId(null);
      setDragSourceClusterId(null);
      const data = getDragData(e);
      if (!data || !onSplit) return;
      onSplit(data.sourceClusterId, [data.detectionId], undefined);
    },
    [onSplit]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetClusterId: number) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes(DRAG_TYPE)) {
        e.dataTransfer.dropEffect = "move";
        setDragOverClusterId(
          dragSourceClusterId !== null && dragSourceClusterId !== targetClusterId
            ? targetClusterId
            : null
        );
      }
    },
    [dragSourceClusterId]
  );

  const handleDragOverCreateNew = useCallback(
    (e: React.DragEvent, side: "left" | "right") => {
      e.preventDefault();
      if (e.dataTransfer.types.includes(DRAG_TYPE)) {
        e.dataTransfer.dropEffect = "move";
        setDragOverCreateNewSide(side);
      }
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverClusterId(null);
      setDragOverClusterIdForCard(null);
    }
  }, []);

  const handleClusterCardDragStart = useCallback(
    (e: React.DragEvent, sourceClusterId: number) => {
      e.dataTransfer.setData(DRAG_TYPE_CLUSTER, String(sourceClusterId));
      e.dataTransfer.effectAllowed = "move";
      setDragSourceClusterIdForCard(sourceClusterId);
      setDragSourceClusterId(null);
      setDragOverCreateNewSide(null);
    },
    []
  );

  const handleClusterCardDragEnd = useCallback(() => {
    setDragSourceClusterIdForCard(null);
    setDragOverClusterIdForCard(null);
  }, []);

  const handleCardDragOver = useCallback(
    (e: React.DragEvent, targetClusterId: number) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes(DRAG_TYPE_CLUSTER)) {
        e.dataTransfer.dropEffect = "move";
        setDragOverClusterIdForCard(
          dragSourceClusterIdForCard !== null && dragSourceClusterIdForCard !== targetClusterId
            ? targetClusterId
            : null
        );
      } else if (e.dataTransfer.types.includes(DRAG_TYPE)) {
        handleDragOver(e, targetClusterId);
      }
    },
    [handleDragOver, dragSourceClusterIdForCard]
  );

  const handleCardDrop = useCallback(
    (e: React.DragEvent, targetClusterId: number) => {
      e.preventDefault();
      setDragOverClusterIdForCard(null);
      const clusterSource = getClusterDragData(e);
      if (clusterSource !== null && clusterSource !== targetClusterId && onMerge) {
        onMerge(clusterSource, targetClusterId);
        setDragSourceClusterIdForCard(null);
        setDragSourceClusterId(null);
        setDragOverCreateNewSide(null);
        return;
      }
      setDragOverClusterId(null);
      setDragOverCreateNewSide(null);
      setDragSourceClusterId(null);
      const data = getDragData(e);
      if (!data || !onAssignToCluster || data.sourceClusterId === targetClusterId) return;
      onAssignToCluster([data.detectionId], targetClusterId);
    },
    [onMerge, onAssignToCluster]
  );

  const handleDragLeaveCreateNew = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node))
      setDragOverCreateNewSide(null);
  }, []);

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
        Drag faces between characters to reclassify. Drag a face to the far left or right of the
        grid to create a new character.
      </p>
      <div className="relative w-full">
        {/* Left drop zone: full width of available space on the left */}
        {isEditable && onSplit && (
          <div
            className={`absolute left-0 top-0 z-10 flex h-full min-h-[200px] w-[max(5rem,(100%-56rem)/2)] flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
              dragSourceClusterId !== null && dragSourceClusterIdForCard === null
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            } ${
              dragSourceClusterId !== null && dragSourceClusterIdForCard === null
                ? dragOverCreateNewSide === "left"
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                  : "border-gray-200 bg-gray-100/50 dark:border-gray-600 dark:bg-gray-800/30"
                : "border-transparent"
            }`}
            onDragOver={(e) => handleDragOverCreateNew(e, "left")}
            onDragLeave={handleDragLeaveCreateNew}
            onDrop={handleDropCreateNew}
            title={dragSourceClusterId !== null && dragSourceClusterIdForCard === null ? "Drop to create new character" : undefined}
          >
            {dragSourceClusterId !== null && dragSourceClusterIdForCard === null && (
              <span className="px-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                {dragOverCreateNewSide === "left"
                  ? "Create new character"
                  : "Drop to create new character"}
              </span>
            )}
          </div>
        )}
        {/* Right drop zone: full width of available space on the right */}
        {isEditable && onSplit && (
          <div
            className={`absolute right-0 top-0 z-10 flex h-full min-h-[200px] w-[max(5rem,(100%-56rem)/2)] flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
              dragSourceClusterId !== null && dragSourceClusterIdForCard === null
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            } ${
              dragSourceClusterId !== null && dragSourceClusterIdForCard === null
                ? dragOverCreateNewSide === "right"
                  ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                  : "border-gray-200 bg-gray-100/50 dark:border-gray-600 dark:bg-gray-800/30"
                : "border-transparent"
            }`}
            onDragOver={(e) => handleDragOverCreateNew(e, "right")}
            onDragLeave={handleDragLeaveCreateNew}
            onDrop={handleDropCreateNew}
            title={dragSourceClusterId !== null && dragSourceClusterIdForCard === null ? "Drop to create new character" : undefined}
          >
            {dragSourceClusterId !== null && dragSourceClusterIdForCard === null && (
              <span className="px-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                {dragOverCreateNewSide === "right"
                  ? "Create new character"
                  : "Drop to create new character"}
              </span>
            )}
          </div>
        )}
        {/* Grid: centered, fixed max width; only add side margin on narrow viewports when panels visible */}
        <div
          className={`max-w-4xl mx-auto transition-all ${
            dragSourceClusterId !== null && dragSourceClusterIdForCard === null
              ? "max-[1055px]:ml-20 max-[1055px]:mr-20"
              : ""
          }`}
        >
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
            const otherClusters = clusters.filter((c) => c.clusterId !== cluster.clusterId);
            const isDropTargetFace =
              isEditable &&
              onAssignToCluster &&
              dragOverClusterId === cluster.clusterId;
            const isDropTargetCard =
              isEditable &&
              onMerge &&
              dragOverClusterIdForCard === cluster.clusterId;
            const isDropTarget = isDropTargetFace || isDropTargetCard;

            return (
              <div
                key={cluster.clusterId}
                className={`rounded-xl border p-4 transition-colors ${
                  isDropTarget
                    ? "border-blue-500 bg-blue-50/80 dark:border-blue-400 dark:bg-blue-950/40"
                    : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                }`}
                onDragOver={(e) => handleCardDragOver(e, cluster.clusterId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleCardDrop(e, cluster.clusterId)}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <div
                    className={`flex min-w-0 flex-1 items-center gap-2 ${
                      isEditable && onMerge && otherClusters.length > 0
                        ? "cursor-grab active:cursor-grabbing"
                        : ""
                    }`}
                    draggable={isEditable && onMerge && otherClusters.length > 0}
                    onDragStart={(e) => {
                      if (isEditable && onMerge && otherClusters.length > 0)
                        handleClusterCardDragStart(e, cluster.clusterId);
                    }}
                    onDragEnd={handleClusterCardDragEnd}
                    title={
                      isEditable && onMerge && otherClusters.length > 0
                        ? "Drag to another character to merge"
                        : undefined
                    }
                  >
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
                    {isEditable && onMerge && otherClusters.length > 0 && (
                      <span
                        className="flex shrink-0 text-gray-400 dark:text-gray-500"
                        aria-hidden
                      >
                        <DragHandleIcon className="h-4 w-4" />
                      </span>
                    )}
                  </div>
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

                <div className="flex flex-wrap gap-2">
                  {detections.map(({ id, file, bbox }) =>
                    isEditable && onAssignToCluster ? (
                      <div
                        key={id}
                        draggable
                        onDragStart={(e) =>
                          handleDragStart(e, id, cluster.clusterId)
                        }
                        onDragEnd={() => {
                          setDragOverClusterId(null);
                          setDragSourceClusterId(null);
                          setDragOverCreateNewSide(null);
                        }}
                        className="relative cursor-grab rounded active:cursor-grabbing"
                        title="Drag to another character or to the sides to create new"
                      >
                        <FaceThumbnail
                          file={file}
                          bbox={bbox}
                          size={56}
                          alt={cluster.name}
                        />
                        <span
                          className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded bg-black/50 text-white"
                          aria-hidden
                        >
                          <DragHandleIcon className="h-3 w-3" />
                        </span>
                      </div>
                    ) : (
                      <FaceThumbnail
                        key={id}
                        file={file}
                        bbox={bbox}
                        size={56}
                        alt={cluster.name}
                      />
                    )
                  )}
                  {isUncategorized &&
                    imageIdsWithNoFaces.map((imageId) => {
                      const file = filesById.get(imageId);
                      if (!file) return null;
                      return (
                        <FullImageThumbnail
                          key={`no-face-${imageId}`}
                          file={file}
                          size={56}
                          alt="No face detected"
                          className="ring-1 ring-gray-300 dark:ring-gray-600"
                        />
                      );
                    })}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {detections.length} face{detections.length !== 1 ? "s" : ""}
                  {isUncategorized && imageIdsWithNoFaces.length > 0 &&
                    `, ${imageIdsWithNoFaces.length} image${imageIdsWithNoFaces.length !== 1 ? "s" : ""} with no face`}
                </p>
                {isEditable && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onMerge && otherClusters.length > 0 && (
                      <select
                        key={clusters.map((c) => c.clusterId).join(",")}
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
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
