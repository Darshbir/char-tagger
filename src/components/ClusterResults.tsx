"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import type { ClusterSummary, TaggedDetection } from "@/lib/types";
import { UNCATEGORIZED_CLUSTER_ID } from "@/lib/constants";
import { FaceThumbnail } from "./FaceThumbnail";
import { FullImageThumbnail } from "./FullImageThumbnail";
import { useTouchDrag } from "@/hooks/useTouchDrag";

const DRAG_TYPE = "application/x-char-tagger-detection";
const DRAG_TYPE_CLUSTER = "application/x-char-tagger-cluster";
const IMAGE_DRAG_TYPE = "application/x-char-tagger-image";

const DRAG_SCROLL_EDGE_THRESHOLD = 120;
const DRAG_SCROLL_SPEED = 10;
const DRAG_SCROLL_THROTTLE_MS = 16;

function getDragScrollContainer(): HTMLElement | null {
  return document.querySelector(".tt-screen--results") as HTMLElement | null;
}

function scrollDragContainerBy(delta: number) {
  const container = getDragScrollContainer();
  if (container && container.scrollHeight > container.clientHeight) {
    container.scrollBy({ top: delta, behavior: "auto" });
    return;
  }
  window.scrollBy({ top: delta, behavior: "auto" });
}

function getAutoScrollDelta(clientY: number): number {
  if (!Number.isFinite(clientY)) return 0;

  const clampedTopY = Math.max(0, clientY);

  if (clampedTopY < DRAG_SCROLL_EDGE_THRESHOLD) {
    const intensity = 1 - clampedTopY / DRAG_SCROLL_EDGE_THRESHOLD;
    return -Math.max(8, Math.round(DRAG_SCROLL_SPEED + intensity * 10));
  }

  const bottomThreshold = window.innerHeight - DRAG_SCROLL_EDGE_THRESHOLD;
  if (clientY > bottomThreshold) {
    const intensity = (clientY - bottomThreshold) / DRAG_SCROLL_EDGE_THRESHOLD;
    return Math.max(8, Math.round(DRAG_SCROLL_SPEED + intensity * 10));
  }

  return 0;
}

function getClusterDragData(e: React.DragEvent): number | null {
  const raw = e.dataTransfer.getData(DRAG_TYPE_CLUSTER);
  if (raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

function getDragData(e: React.DragEvent): { detectionId: string; sourceClusterId: number } | null {
  const raw = e.dataTransfer.getData(DRAG_TYPE);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { detectionId: string; sourceClusterId: number };
    if (typeof data.detectionId !== "string" || typeof data.sourceClusterId !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

function DragHandleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="5" r="2.2" />
      <circle cx="9" cy="12" r="2.2" />
      <circle cx="9" cy="19" r="2.2" />
      <circle cx="15" cy="5" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="15" cy="19" r="2.2" />
    </svg>
  );
}

function SmallDragIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="5" r="2.2" />
      <circle cx="9" cy="12" r="2.2" />
      <circle cx="9" cy="19" r="2.2" />
      <circle cx="15" cy="5" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="15" cy="19" r="2.2" />
    </svg>
  );
}

interface ClusterResultsProps {
  clusters: ClusterSummary[];
  tagged: TaggedDetection[];
  filesById: Map<string, File>;
  imageIdsWithNoFaces?: string[];
  imageClusterMap?: Map<string, number>;
  onRename?: (clusterId: number, name: string) => void;
  onMerge?: (sourceClusterId: number, targetClusterId: number) => void;
  onSplit?: (clusterId: number, detectionIdsToMove: string[], targetClusterId?: number) => void;
  onAssignToCluster?: (detectionIds: string[], targetClusterId: number) => void;
  onAssignImageToCluster?: (imageId: string, targetClusterId: number) => void;
  onClearImageAssignment?: (imageId: string) => void;
}

const INITIAL_UNCATEGORIZED_VISIBLE = 60;
const UNCATEGORIZED_VISIBLE_STEP = 60;

type DetectionCardData = {
  id: string;
  file: File;
  bbox: TaggedDetection["bbox"];
};

export const ClusterResults = memo(function ClusterResults({
  clusters,
  tagged,
  filesById,
  imageIdsWithNoFaces = [],
  imageClusterMap = new Map(),
  onRename,
  onMerge,
  onSplit,
  onAssignToCluster,
  onAssignImageToCluster,
  onClearImageAssignment,
}: ClusterResultsProps) {
  const taggedByKey = useMemo(() => {
    const m = new Map<string, TaggedDetection>();
    for (const t of tagged) m.set(`${t.imageId}#${t.detectionIndex}`, t);
    return m;
  }, [tagged]);

  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [duplicateWarnId, setDuplicateWarnId] = useState<number | null>(null);
  const [dragOverClusterId, setDragOverClusterId] = useState<number | null>(null);
  const [dragSourceClusterId, setDragSourceClusterId] = useState<number | null>(null);
  const [dragOverCreateNewSide, setDragOverCreateNewSide] = useState<"left" | "right" | "uncategorized" | null>(null);
  const [dragSourceClusterIdForCard, setDragSourceClusterIdForCard] = useState<number | null>(null);
  const [dragOverClusterIdForCard, setDragOverClusterIdForCard] = useState<number | null>(null);
  const [imageDragSrcId, setImageDragSrcId] = useState<string | null>(null);
  const dragScrollLastRef = useRef(0);
  const dragClientYRef = useRef<number | null>(null);

  const {
    isTouchDraggingFace,
    isTouchDraggingCard,
    touchDragFaceId,
    touchDragCardId,
    touchDragOverClusterId: touchOverClusterId,
    touchDragOverCreateNew: touchOverCreateNew,
    makeFaceTouchHandlers,
    makeCardTouchHandlers,
  } = useTouchDrag({ onAssignToCluster, onMerge, onSplit });

  // Stagger appear animation
  const [appearedSet, setAppearedSet] = useState<Set<number>>(new Set());
  // Expanded face count per cluster (multiples of 20)
  const [expandCountMap, setExpandCountMap] = useState<Map<number, number>>(new Map());
  const [uncategorizedVisibleCount, setUncategorizedVisibleCount] = useState(INITIAL_UNCATEGORIZED_VISIBLE);
  const prevClusterIdsRef = useRef<number[]>([]);
  useEffect(() => {
    const prevIds = new Set(prevClusterIdsRef.current);
    const newOnes = clusters.filter((c) => !prevIds.has(c.clusterId));
    if (newOnes.length > 0) {
      newOnes.forEach((c, i) => {
        setTimeout(() => {
          setAppearedSet((prev) => { const s = new Set(prev); s.add(c.clusterId); return s; });
        }, i * 110);
      });
    }
    prevClusterIdsRef.current = clusters.map((c) => c.clusterId);
  }, [clusters]);

  // Auto-scroll while dragging
  useEffect(() => {
    const active =
      dragSourceClusterId !== null ||
      dragSourceClusterIdForCard !== null ||
      imageDragSrcId !== null;
    if (!active) return;

    const tick = () => {
      const now = Date.now();
      if (now - dragScrollLastRef.current < DRAG_SCROLL_THROTTLE_MS) return;
      const y = dragClientYRef.current;
      if (y == null) return;
      const delta = getAutoScrollDelta(y);
      if (delta !== 0) {
        dragScrollLastRef.current = now;
        scrollDragContainerBy(delta);
      }
    };

    const onDragMove = (e: DragEvent) => {
      if (Number.isFinite(e.clientY)) {
        dragClientYRef.current = e.clientY;
      }
      tick();
    };

    const intervalId = window.setInterval(tick, DRAG_SCROLL_THROTTLE_MS);
    document.addEventListener("dragover", onDragMove, false);
    document.addEventListener("drag", onDragMove, false);

    return () => {
      window.clearInterval(intervalId);
      dragClientYRef.current = null;
      document.removeEventListener("dragover", onDragMove, false);
      document.removeEventListener("drag", onDragMove, false);
    };
  }, [dragSourceClusterId, dragSourceClusterIdForCard, imageDragSrcId]);

  const handleRenameSubmit = useCallback(
    (clusterId: number, value: string) => {
      const trimmed = value.trim();
      if (trimmed && onRename) {
        // Warn if another cluster already uses this name, but allow it
        const isDuplicate = clusters.some(
          (c) => c.clusterId !== clusterId && c.name.toLowerCase() === trimmed.toLowerCase()
        );
        if (isDuplicate) {
          setDuplicateWarnId(clusterId);
          setTimeout(() => setDuplicateWarnId(null), 3000);
        }
        onRename(clusterId, trimmed);
      }
      setEditingNameId(null);
    },
    [onRename, clusters]
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
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ detectionId, sourceClusterId }));
      e.dataTransfer.effectAllowed = "move";
      dragClientYRef.current = e.clientY;
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
      if (!data || !onAssignToCluster || data.sourceClusterId === targetClusterId) return;
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

  // Bottom zone — context-aware: create new person when source is uncategorized, else move to uncategorized
  const handleBottomZoneDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverCreateNewSide(null);
      setDragOverClusterId(null);
      setDragSourceClusterId(null);
      const data = getDragData(e);
      if (!data) return;
      if (data.sourceClusterId === UNCATEGORIZED_CLUSTER_ID) {
        // Already uncategorized → split into a new named person
        if (onSplit) onSplit(data.sourceClusterId, [data.detectionId], undefined);
      } else {
        // Named cluster → send to uncategorized
        if (onAssignToCluster) onAssignToCluster([data.detectionId], UNCATEGORIZED_CLUSTER_ID);
      }
    },
    [onAssignToCluster, onSplit]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetClusterId: number) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes(DRAG_TYPE)) {
        e.dataTransfer.dropEffect = "move";
        setDragOverClusterId(
          dragSourceClusterId !== null && dragSourceClusterId !== targetClusterId ? targetClusterId : null
        );
      }
    },
    [dragSourceClusterId]
  );

  const handleDragOverCreateNew = useCallback((e: React.DragEvent, side: "left" | "right" | "uncategorized") => {
    e.preventDefault();
    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
      e.dataTransfer.dropEffect = "move";
      setDragOverCreateNewSide(side);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverClusterId(null);
      setDragOverClusterIdForCard(null);
    }
  }, []);

  const handleClusterCardDragStart = useCallback((e: React.DragEvent, sourceClusterId: number) => {
    e.dataTransfer.setData(DRAG_TYPE_CLUSTER, String(sourceClusterId));
    e.dataTransfer.effectAllowed = "move";
    dragClientYRef.current = e.clientY;
    setDragSourceClusterIdForCard(sourceClusterId);
    setDragSourceClusterId(null);
    setDragOverCreateNewSide(null);
  }, []);

  const handleClusterCardDragEnd = useCallback(() => {
    dragClientYRef.current = null;
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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCreateNewSide(null);
  }, []);

  const isEditable = Boolean(onRename || onMerge || onSplit || onAssignToCluster);
  const anyDraggingFace =
    (dragSourceClusterId !== null && dragSourceClusterIdForCard === null) || isTouchDraggingFace;

  // Determine if the currently dragged face originates from the uncategorized cluster
  const touchDragSourceClusterId = isTouchDraggingFace && touchDragFaceId
    ? (taggedByKey.get(touchDragFaceId)?.clusterId ?? null)
    : null;
  const dragFromUncategorized =
    dragSourceClusterId === UNCATEGORIZED_CLUSTER_ID ||
    touchDragSourceClusterId === UNCATEGORIZED_CLUSTER_ID;
  const anyDraggingCard = dragSourceClusterIdForCard !== null || isTouchDraggingCard;
  const anyDraggingImage = imageDragSrcId !== null;
  // No-face images that haven't been manually assigned yet
  const unassignedNoFaceIds = imageIdsWithNoFaces.filter((id) => !imageClusterMap.has(id));

  // Separate named clusters from uncategorized
  const namedClusters = clusters.filter((c) => c.clusterId !== UNCATEGORIZED_CLUSTER_ID);
  const uncatCluster = clusters.find((c) => c.clusterId === UNCATEGORIZED_CLUSTER_ID);
  const detectionsByClusterId = useMemo(() => {
    const next = new Map<number, DetectionCardData[]>();

    for (const cluster of clusters) {
      const detections: DetectionCardData[] = [];
      for (const id of cluster.detectionIds) {
        const t = taggedByKey.get(id);
        if (!t) continue;
        const file = filesById.get(t.imageId);
        if (!file) continue;
        detections.push({ id, file, bbox: t.bbox });
      }
      next.set(cluster.clusterId, detections);
    }

    return next;
  }, [clusters, taggedByKey, filesById]);

  const assignedImageIdsByClusterId = useMemo(() => {
    const next = new Map<number, string[]>();
    imageClusterMap.forEach((clusterId, imageId) => {
      const imageIds = next.get(clusterId);
      if (imageIds) {
        imageIds.push(imageId);
      } else {
        next.set(clusterId, [imageId]);
      }
    });
    return next;
  }, [imageClusterMap]);

  const uncategorizedDetections = useMemo(
    () => detectionsByClusterId.get(UNCATEGORIZED_CLUSTER_ID) ?? [],
    [detectionsByClusterId]
  );
  const totalUncategorizedItems = uncategorizedDetections.length + unassignedNoFaceIds.length;

  useEffect(() => {
    setUncategorizedVisibleCount((prev) => Math.min(Math.max(prev, INITIAL_UNCATEGORIZED_VISIBLE), Math.max(totalUncategorizedItems, INITIAL_UNCATEGORIZED_VISIBLE)));
  }, [totalUncategorizedItems]);

  if (clusters.length === 0) return null;

  return (
    <div>
      {/* Drag instruction */}
      {isEditable && (
        <div className="tt-drag-hint">
          <span className="tt-drag-hint--mouse">Drag faces between cards to reclassify · Drag a face to the edges to split into a new person</span>
          <span className="tt-drag-hint--touch">Long-press a face to reassign it · Long-press the ⠿ handle on a card to merge clusters</span>
        </div>
      )}

      <div className="tt-grid-container" style={{ position: "relative" }}>
        {/* Left create-new drop zone */}
        {isEditable && onSplit && (
          <div
            data-create-zone="left"
            className={`tt-create-zone tt-create-zone--left ${anyDraggingFace ? "tt-create-zone--visible" : ""} ${dragOverCreateNewSide === "left" || touchOverCreateNew === "left" ? "tt-create-zone--hover" : ""}`}
            style={{ pointerEvents: anyDraggingFace ? "auto" : "none" }}
            onDragOver={(e) => handleDragOverCreateNew(e, "left")}
            onDragLeave={handleDragLeaveCreateNew}
            onDrop={handleDropCreateNew}
          >
            {anyDraggingFace && (
              <span className="tt-create-zone-label">
                {dragOverCreateNewSide === "left" || touchOverCreateNew === "left" ? "Create new person" : "Drop to split"}
              </span>
            )}
          </div>
        )}

        {/* Right create-new drop zone */}
        {isEditable && onSplit && (
          <div
            data-create-zone="right"
            className={`tt-create-zone tt-create-zone--right ${anyDraggingFace ? "tt-create-zone--visible" : ""} ${dragOverCreateNewSide === "right" || touchOverCreateNew === "right" ? "tt-create-zone--hover" : ""}`}
            style={{ pointerEvents: anyDraggingFace ? "auto" : "none" }}
            onDragOver={(e) => handleDragOverCreateNew(e, "right")}
            onDragLeave={handleDragLeaveCreateNew}
            onDrop={handleDropCreateNew}
          >
            {anyDraggingFace && (
              <span className="tt-create-zone-label">
                {dragOverCreateNewSide === "right" || touchOverCreateNew === "right" ? "Create new person" : "Drop to split"}
              </span>
            )}
          </div>
        )}

        {/* Persons grid */}
        <div
          className="tt-persons-grid"
        >
          {namedClusters.map((cluster) => {
            const detections = detectionsByClusterId.get(cluster.clusterId) ?? [];

            const otherClusters = clusters.filter((c) => c.clusterId !== cluster.clusterId);
            const isDropTarget =
              (isEditable && onAssignToCluster &&
                (dragOverClusterId === cluster.clusterId ||
                  (isTouchDraggingFace && touchOverClusterId === cluster.clusterId))) ||
              (isEditable && onMerge &&
                (dragOverClusterIdForCard === cluster.clusterId ||
                  (isTouchDraggingCard && touchOverClusterId === cluster.clusterId))) ||
              (anyDraggingImage && dragOverClusterId === cluster.clusterId);
            const canMerge = isEditable && onMerge && otherClusters.length > 0;
            // Full images manually assigned to this cluster
            const assignedImageIds = assignedImageIdsByClusterId.get(cluster.clusterId) ?? [];

            // Show up to 6 faces; +N slot only appears when total > 6
            const MOSAIC_SHOW = 6;
            const expandCount = expandCountMap.get(cluster.clusterId) ?? 0;
            const needsTruncation = detections.length > MOSAIC_SHOW;
            // When truncating: show 5 faces + 1 "+N" button; expand adds 20 at a time
            const shownCount = needsTruncation
              ? Math.min(5 + expandCount * 20, detections.length)
              : detections.length;
            const shownDetections = detections.slice(0, shownCount);
            const hasMore = needsTruncation && shownCount < detections.length;
            const remainingCount = detections.length - shownCount;
            const isExpanded = expandCount > 0;

            return (
              <div
                key={cluster.clusterId}
                data-cluster-id={cluster.clusterId}
                className={`tt-pcard ${appearedSet.has(cluster.clusterId) ? "tt-pcard--appeared" : ""} ${isDropTarget ? "tt-pcard--drop-target" : ""}`}
                style={isTouchDraggingCard && touchDragCardId === cluster.clusterId ? { pointerEvents: "none", opacity: 0.5 } : undefined}
                onDragOver={(e) => {
                  handleCardDragOver(e, cluster.clusterId);
                  // Also accept image drops
                  if (e.dataTransfer.types.includes(IMAGE_DRAG_TYPE)) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverClusterId(cluster.clusterId);
                  }
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  // Handle full-image drop first
                  const imgId = e.dataTransfer.getData(IMAGE_DRAG_TYPE);
                  if (imgId) {
                    e.preventDefault();
                    onAssignImageToCluster?.(imgId, cluster.clusterId);
                    setImageDragSrcId(null);
                    setDragOverClusterId(null);
                    return;
                  }
                  handleCardDrop(e, cluster.clusterId);
                }}
              >
                {/* Mosaic header */}
                <div className="tt-pcard-mosaic">

                  {/* Dynamic mosaic cells — one per shown detection */}
                  {shownDetections.map((det) =>
                    isEditable && onAssignToCluster ? (
                      <div key={det.id} className="tt-mosaic-cell">
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, det.id, cluster.clusterId)}
                          onDragEnd={() => { dragClientYRef.current = null; setDragOverClusterId(null); setDragSourceClusterId(null); setDragOverCreateNewSide(null); }}
                          {...makeFaceTouchHandlers(det.id, cluster.clusterId)}
                          style={{ cursor: "grab", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: touchDragFaceId === det.id ? 0.45 : 1, transition: "opacity 0.15s" }}
                        >
                          <FaceThumbnail file={det.file} bbox={det.bbox} size={72} alt={cluster.name} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    ) : (
                      <div key={det.id} className="tt-mosaic-cell">
                        <FaceThumbnail file={det.file} bbox={det.bbox} size={72} alt={cluster.name} className="w-full h-full object-cover" />
                      </div>
                    )
                  )}
                  {/* +N expansion trigger cell — only when >6 faces */}
                  {hasMore && (
                    <div className="tt-mosaic-cell">
                      <button
                        type="button"
                        className="tt-mosaic-more-btn"
                        onClick={() => setExpandCountMap((m) => {
                          const n = new Map(m);
                          n.set(cluster.clusterId, (m.get(cluster.clusterId) ?? 0) + 1);
                          return n;
                        })}
                        title="Show more faces"
                      >
                        +{remainingCount}
                      </button>
                    </div>
                  )}
                  {/* Manually-assigned full images for this cluster */}
                  {assignedImageIds.map((imgId) => {
                    const file = filesById.get(imgId);
                    if (!file) return null;
                    return (
                      <div key={`img-${imgId}`} className="tt-mosaic-cell">
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(IMAGE_DRAG_TYPE, imgId);
                            e.dataTransfer.effectAllowed = "move";
                            dragClientYRef.current = e.clientY;
                            setImageDragSrcId(imgId);
                          }}
                          onDragEnd={() => { dragClientYRef.current = null; setImageDragSrcId(null); setDragOverClusterId(null); }}
                          style={{ cursor: "grab", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: imageDragSrcId === imgId ? 0.45 : 1, transition: "opacity 0.15s" }}
                          title="Drag back to uncategorized"
                        >
                          <FullImageThumbnail file={file} size={72} alt="Assigned photo" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    );
                  })}
                  {/* Full-width collapse row when all faces shown */}
                  {isExpanded && !hasMore && (
                    <div className="tt-mosaic-collapse-cell">
                      <button
                        type="button"
                        className="tt-mosaic-collapse-inline-btn"
                        onClick={() => setExpandCountMap((m) => {
                          const n = new Map(m);
                          n.delete(cluster.clusterId);
                          return n;
                        })}
                      >
                        ▲ show less
                      </button>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="tt-pcard-body">
                  {/* Name row */}
                  <div className="tt-pcard-name-row">
                    {editingNameId === cluster.clusterId && onRename ? (
                      <>
                        <input
                          type="text"
                          className="tt-pcard-name-input"
                          defaultValue={cluster.name}
                          placeholder="Name this person…"
                          onBlur={(e) => handleRenameSubmit(cluster.clusterId, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSubmit(cluster.clusterId, (e.target as HTMLInputElement).value);
                            if (e.key === "Escape") setEditingNameId(null);
                          }}
                          autoFocus
                        />
                      </>
                    ) : (
                      <>
                        {/* Inline drag handle — shows name as ghost when dragging */}
                        {canMerge && (
                          <div
                            className="tt-pcard-drag-handle-inline"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/x-char-tagger-cluster", String(cluster.clusterId));
                              e.dataTransfer.effectAllowed = "move";
                              dragClientYRef.current = e.clientY;
                              const ghost = document.createElement("div");
                              ghost.textContent = cluster.name;
                              ghost.style.cssText = "position:fixed;top:-9999px;left:-9999px;padding:6px 16px;background:var(--surface,#1a1a1a);color:var(--text,#fff);border:1px solid var(--border);border-radius:10px;font-size:0.9rem;font-family:'Playfair Display',serif;white-space:nowrap;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.3);";
                              document.body.appendChild(ghost);
                              e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 20);
                              setTimeout(() => ghost.remove(), 0);
                              setDragSourceClusterIdForCard(cluster.clusterId);
                              setDragSourceClusterId(null);
                              setDragOverCreateNewSide(null);
                            }}
                            onDragEnd={handleClusterCardDragEnd}
                            {...makeCardTouchHandlers(cluster.clusterId)}
                            style={{ opacity: touchDragCardId === cluster.clusterId ? 0.45 : 1, transition: "opacity 0.15s" }}
                            title={`Long-press or drag to merge ${cluster.name}`}
                          >
                            <SmallDragIcon />
                          </div>
                        )}
                        <span
                          className="tt-pcard-name-display"
                          title={cluster.name}
                        >
                          {cluster.name}
                        </span>
                        {isEditable && onRename && (
                          <button
                            type="button"
                            className="tt-pcard-edit-icon"
                            onClick={() => setEditingNameId(cluster.clusterId)}
                            title={`Rename ${cluster.name}`}
                            aria-label={`Rename ${cluster.name}`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Duplicate name warning — shown after rename is confirmed, outside edit mode */}
                  {duplicateWarnId === cluster.clusterId && (
                    <span style={{ fontSize: "0.72rem", color: "var(--accent)", marginTop: "0.15rem", marginBottom: "0.1rem", display: "block", fontFamily: "'DM Mono', monospace" }}
                      title="Another character has this name — it may cause confusion">
                      ⚠ same name as another person — saved anyway
                    </span>
                  )}

                  {/* Meta */}
                  <div className="tt-pcard-meta">
                    {detections.length} photo{detections.length !== 1 ? "s" : ""}
                  </div>

                  {/* Actions */}
                  {isEditable && (
                    <div className="tt-pcard-actions">
                      {onMerge && otherClusters.filter((c) => c.clusterId !== UNCATEGORIZED_CLUSTER_ID).length > 0 && (
                        <select
                          className="tt-merge-select"
                          value=""
                          onChange={(e) => {
                            const target = parseInt(e.target.value, 10);
                            if (!Number.isNaN(target) && onMerge) onMerge(cluster.clusterId, target);
                            e.target.value = "";
                          }}
                          aria-label="Merge into"
                        >
                          <option value="">Merge into…</option>
                          {otherClusters
                            .filter((c) => c.clusterId !== UNCATEGORIZED_CLUSTER_ID)
                            .map((c) => (
                              <option key={c.clusterId} value={c.clusterId}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      )}
                      {onAssignToCluster && detections.length > 0 && (
                        <button
                          type="button"
                          className="tt-btn-sm tt-btn-sm--warn"
                          onClick={() => handleAssignToUncategorized(cluster.detectionIds)}
                          title="Move all faces to Uncategorized"
                        >
                          Move to uncategorized
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom drop zone — visible on both desktop and mobile.
             If drag originates from uncategorized: creates a new person.
             If drag originates from a named cluster: moves face to uncategorized. */}
        {isEditable && (onAssignToCluster || onSplit) && (
          <div
            data-create-zone="uncategorized"
            className={`tt-create-zone tt-create-zone--bottom ${anyDraggingFace ? "tt-create-zone--visible" : ""} ${dragOverCreateNewSide === "uncategorized" || touchOverCreateNew === "uncategorized" ? "tt-create-zone--hover" : ""}`}
            style={{ pointerEvents: anyDraggingFace ? "auto" : "none" }}
            onDragOver={(e) => handleDragOverCreateNew(e, "uncategorized")}
            onDragLeave={handleDragLeaveCreateNew}
            onDrop={handleBottomZoneDrop}
          >
            {anyDraggingFace && (
              <span className="tt-create-zone-label">
                {dragOverCreateNewSide === "uncategorized" || touchOverCreateNew === "uncategorized"
                  ? (dragFromUncategorized ? "Create new person" : "Move to Uncategorized")
                  : (dragFromUncategorized ? "Drop to create new" : "Drop to uncategorize")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Uncategorized section ── */}
      {(uncatCluster || imageIdsWithNoFaces.length > 0) && (() => {
        if (totalUncategorizedItems === 0) return null;

        const visibleUncatDetections = uncategorizedDetections.slice(0, Math.min(uncategorizedVisibleCount, uncategorizedDetections.length));
        const remainingVisibleSlots = Math.max(0, uncategorizedVisibleCount - visibleUncatDetections.length);
        const visibleUnassignedNoFaceIds = unassignedNoFaceIds.slice(0, remainingVisibleSlots);
        const hiddenUncategorizedCount = Math.max(0, totalUncategorizedItems - visibleUncatDetections.length - visibleUnassignedNoFaceIds.length);

        const isUncatDrop =
          uncatCluster &&
          isEditable &&
          onAssignToCluster &&
          (dragOverClusterId === UNCATEGORIZED_CLUSTER_ID ||
            (isTouchDraggingFace && touchOverClusterId === UNCATEGORIZED_CLUSTER_ID));

        return (
          <div
          data-cluster-id={UNCATEGORIZED_CLUSTER_ID}
          className={`tt-unid-section${isUncatDrop || (anyDraggingImage && dragOverClusterId === UNCATEGORIZED_CLUSTER_ID) ? " tt-unid-section--drop" : ""}`}
          onDragOver={(e) => {
            if (uncatCluster) handleDragOver(e, UNCATEGORIZED_CLUSTER_ID);
            if (e.dataTransfer.types.includes(IMAGE_DRAG_TYPE)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOverClusterId(UNCATEGORIZED_CLUSTER_ID);
            }
          }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverClusterId(null); setDragOverClusterIdForCard(null); } }}
          onDrop={(e) => {
            // Drop image back to uncategorized
            const imgId = e.dataTransfer.getData(IMAGE_DRAG_TYPE);
            if (imgId) {
              e.preventDefault();
              onClearImageAssignment?.(imgId);
              setImageDragSrcId(null);
              setDragOverClusterId(null);
              return;
            }
            if (uncatCluster) handleDrop(e, UNCATEGORIZED_CLUSTER_ID);
          }}
          >
            <div className="tt-unid-title">
              Uncategorized
              <span className="tt-unid-count">{totalUncategorizedItems}</span>
            </div>
            <div className="tt-unid-strip">
              {visibleUncatDetections.map(({ id, file, bbox }) => (
                <div
                  key={id}
                  className={`tt-unid-chip ${isUncatDrop ? "tt-unid-chip--drop" : ""}`}
                  title="Unrecognized face"
                >
                  {isEditable && onAssignToCluster ? (
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, id, UNCATEGORIZED_CLUSTER_ID)}
                      onDragEnd={() => { dragClientYRef.current = null; setDragOverClusterId(null); setDragSourceClusterId(null); setDragOverCreateNewSide(null); }}
                      {...makeFaceTouchHandlers(id, UNCATEGORIZED_CLUSTER_ID)}
                      style={{ width: "100%", height: "100%", cursor: "grab", opacity: touchDragFaceId === id ? 0.45 : 1, transition: "opacity 0.15s" }}
                    >
                      <FaceThumbnail file={file} bbox={bbox} size={72} alt="Uncategorized face" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <FaceThumbnail file={file} bbox={bbox} size={72} alt="Uncategorized face" className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
              {visibleUnassignedNoFaceIds.map((imageId) => {
                const file = filesById.get(imageId);
                if (!file) return null;
                return (
                  <div
                    key={`no-face-${imageId}`}
                    className="tt-unid-chip"
                    title="No face detected — drag to a character card to assign"
                    style={{ outline: "1px solid var(--border2)", cursor: "grab" }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(IMAGE_DRAG_TYPE, imageId);
                      e.dataTransfer.effectAllowed = "move";
                        dragClientYRef.current = e.clientY;
                      setImageDragSrcId(imageId);
                    }}
                    onDragEnd={() => { dragClientYRef.current = null; setImageDragSrcId(null); setDragOverClusterId(null); }}
                  >
                    <div style={{ opacity: imageDragSrcId === imageId ? 0.45 : 1, transition: "opacity 0.15s", width: "100%", height: "100%" }}>
                      <FullImageThumbnail file={file} size={72} alt="No face detected" />
                    </div>
                  </div>
                );
              })}
              {hiddenUncategorizedCount > 0 && (
                <button
                  type="button"
                  className="tt-mosaic-more-btn"
                  style={{ minWidth: 72, minHeight: 72 }}
                  onClick={() => {
                    setUncategorizedVisibleCount((prev) => Math.min(prev + UNCATEGORIZED_VISIBLE_STEP, totalUncategorizedItems));
                  }}
                  title="Show more uncategorized items"
                >
                  +{hiddenUncategorizedCount}
                </button>
              )}
              {totalUncategorizedItems > INITIAL_UNCATEGORIZED_VISIBLE && hiddenUncategorizedCount === 0 && (
                <button
                  type="button"
                  className="tt-mosaic-collapse-inline-btn"
                  style={{ alignSelf: "center" }}
                  onClick={() => setUncategorizedVisibleCount(INITIAL_UNCATEGORIZED_VISIBLE)}
                >
                  ▲ show less
                </button>
              )}
            </div>
          </div>
        );  // end inner IIFE
      })()}
    </div>
  );
});
