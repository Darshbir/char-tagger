"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClusterSummary, TaggedDetection } from "@/lib/types";
import { UNCATEGORIZED_CLUSTER_ID } from "@/lib/constants";
import { FaceThumbnail } from "./FaceThumbnail";
import { FullImageThumbnail } from "./FullImageThumbnail";

const DRAG_TYPE = "application/x-char-tagger-detection";
const DRAG_TYPE_CLUSTER = "application/x-char-tagger-cluster";

const DRAG_SCROLL_EDGE_THRESHOLD = 80;
const DRAG_SCROLL_SPEED = 14;
const DRAG_SCROLL_THROTTLE_MS = 16;

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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="5" r="1.8" />
      <circle cx="9" cy="12" r="1.8" />
      <circle cx="9" cy="19" r="1.8" />
      <circle cx="15" cy="5" r="1.8" />
      <circle cx="15" cy="12" r="1.8" />
      <circle cx="15" cy="19" r="1.8" />
    </svg>
  );
}

function SmallDragIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
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
  for (const t of tagged) taggedByKey.set(`${t.imageId}#${t.detectionIndex}`, t);

  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [dragOverClusterId, setDragOverClusterId] = useState<number | null>(null);
  const [dragSourceClusterId, setDragSourceClusterId] = useState<number | null>(null);
  const [dragOverCreateNewSide, setDragOverCreateNewSide] = useState<"left" | "right" | null>(null);
  const [dragSourceClusterIdForCard, setDragSourceClusterIdForCard] = useState<number | null>(null);
  const [dragOverClusterIdForCard, setDragOverClusterIdForCard] = useState<number | null>(null);
  const dragScrollLastRef = useRef(0);

  // Stagger appear animation
  const [appearedSet, setAppearedSet] = useState<Set<number>>(new Set());
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
    const active = dragSourceClusterId !== null || dragSourceClusterIdForCard !== null;
    if (!active) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - dragScrollLastRef.current < DRAG_SCROLL_THROTTLE_MS) return;
      const y = e.clientY;
      if (y < DRAG_SCROLL_EDGE_THRESHOLD) {
        dragScrollLastRef.current = now;
        window.scrollBy({ top: -DRAG_SCROLL_SPEED, behavior: "auto" });
      } else if (y > window.innerHeight - DRAG_SCROLL_EDGE_THRESHOLD) {
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
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ detectionId, sourceClusterId }));
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

  const handleDragOverCreateNew = useCallback((e: React.DragEvent, side: "left" | "right") => {
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
    setDragSourceClusterIdForCard(sourceClusterId);
    setDragSourceClusterId(null);
    setDragOverCreateNewSide(null);
  }, []);

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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCreateNewSide(null);
  }, []);

  if (clusters.length === 0) return null;

  const isEditable = Boolean(onRename || onMerge || onSplit || onAssignToCluster);
  const anyDraggingFace = dragSourceClusterId !== null && dragSourceClusterIdForCard === null;

  // Separate named clusters from uncategorized
  const namedClusters = clusters.filter((c) => c.clusterId !== UNCATEGORIZED_CLUSTER_ID);
  const uncatCluster = clusters.find((c) => c.clusterId === UNCATEGORIZED_CLUSTER_ID);

  return (
    <div>
      {/* Drag instruction */}
      {isEditable && (
        <div className="tt-drag-hint">
          Drag faces between cards to reclassify Â· Drag a face to the edges to split into new
        </div>
      )}

      <div className="tt-grid-container" style={{ position: "relative" }}>
        {/* Left create-new drop zone */}
        {isEditable && onSplit && (
          <div
            className={`tt-create-zone tt-create-zone--left ${anyDraggingFace ? "tt-create-zone--visible" : ""} ${dragOverCreateNewSide === "left" ? "tt-create-zone--hover" : ""}`}
            style={{ pointerEvents: anyDraggingFace ? "auto" : "none" }}
            onDragOver={(e) => handleDragOverCreateNew(e, "left")}
            onDragLeave={handleDragLeaveCreateNew}
            onDrop={handleDropCreateNew}
          >
            {anyDraggingFace && (
              <span className="tt-create-zone-label">
                {dragOverCreateNewSide === "left" ? "Create new person" : "Drop to split"}
              </span>
            )}
          </div>
        )}

        {/* Right create-new drop zone */}
        {isEditable && onSplit && (
          <div
            className={`tt-create-zone tt-create-zone--right ${anyDraggingFace ? "tt-create-zone--visible" : ""} ${dragOverCreateNewSide === "right" ? "tt-create-zone--hover" : ""}`}
            style={{ pointerEvents: anyDraggingFace ? "auto" : "none" }}
            onDragOver={(e) => handleDragOverCreateNew(e, "right")}
            onDragLeave={handleDragLeaveCreateNew}
            onDrop={handleDropCreateNew}
          >
            {anyDraggingFace && (
              <span className="tt-create-zone-label">
                {dragOverCreateNewSide === "right" ? "Create new person" : "Drop to split"}
              </span>
            )}
          </div>
        )}

        {/* Persons grid */}
        <div
          className="tt-persons-grid"
          style={anyDraggingFace ? { paddingLeft: "max(70px, calc((100% - 900px) / 2))", paddingRight: "max(70px, calc((100% - 900px) / 2))" } : undefined}
        >
          {namedClusters.map((cluster) => {
            const detections = cluster.detectionIds
              .map((id) => {
                const t = taggedByKey.get(id);
                if (!t) return null;
                const file = filesById.get(t.imageId);
                if (!file) return null;
                return { id, file, bbox: t.bbox };
              })
              .filter((d): d is NonNullable<typeof d> => d !== null);

            const otherClusters = clusters.filter((c) => c.clusterId !== cluster.clusterId);
            const isDropTarget =
              (isEditable && onAssignToCluster && dragOverClusterId === cluster.clusterId) ||
              (isEditable && onMerge && dragOverClusterIdForCard === cluster.clusterId);
            const canMerge = isEditable && onMerge && otherClusters.length > 0;

            // Mosaic: first 3, strip: 4+
            const mosaicFaces = detections.slice(0, 3);
            const stripFaces = detections.slice(3, 11);
            const hiddenCount = Math.max(0, detections.length - 11);

            return (
              <div
                key={cluster.clusterId}
                className={`tt-pcard ${appearedSet.has(cluster.clusterId) ? "tt-pcard--appeared" : ""} ${isDropTarget ? "tt-pcard--drop-target" : ""}`}
                onDragOver={(e) => handleCardDragOver(e, cluster.clusterId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleCardDrop(e, cluster.clusterId)}
              >
                {/* Mosaic header */}
                <div className="tt-pcard-mosaic">
                  {/* Drag handle (top-left) â€” drags the entire card */}
                  {canMerge && (
                    <div
                      className="tt-pcard-drag-handle"
                      draggable
                      onDragStart={(e) => handleClusterCardDragStart(e, cluster.clusterId)}
                      onDragEnd={handleClusterCardDragEnd}
                      title="Drag onto another card to merge"
                    >
                      <DragHandleIcon />
                    </div>
                  )}

                  {/* Face count badge */}
                  <div className="tt-pcard-count-badge">{detections.length} face{detections.length !== 1 ? "s" : ""}</div>

                  {/* Mosaic cell 0 â€” spans 2 rows */}
                  <div className="tt-mosaic-cell">
                    {mosaicFaces[0] ? (
                      isEditable && onAssignToCluster ? (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, mosaicFaces[0].id, cluster.clusterId)}
                          onDragEnd={() => { setDragOverClusterId(null); setDragSourceClusterId(null); setDragOverCreateNewSide(null); }}
                          style={{ cursor: "grab", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <FaceThumbnail file={mosaicFaces[0].file} bbox={mosaicFaces[0].bbox} size={130} alt={cluster.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <FaceThumbnail file={mosaicFaces[0].file} bbox={mosaicFaces[0].bbox} size={130} alt={cluster.name} className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "var(--bg3)" }} />
                    )}
                  </div>

                  {/* Mosaic cell 1 */}
                  <div className="tt-mosaic-cell">
                    {mosaicFaces[1] ? (
                      isEditable && onAssignToCluster ? (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, mosaicFaces[1].id, cluster.clusterId)}
                          onDragEnd={() => { setDragOverClusterId(null); setDragSourceClusterId(null); setDragOverCreateNewSide(null); }}
                          style={{ cursor: "grab", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <FaceThumbnail file={mosaicFaces[1].file} bbox={mosaicFaces[1].bbox} size={65} alt={cluster.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <FaceThumbnail file={mosaicFaces[1].file} bbox={mosaicFaces[1].bbox} size={65} alt={cluster.name} className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "var(--bg3)" }} />
                    )}
                  </div>

                  {/* Mosaic cell 2 */}
                  <div className="tt-mosaic-cell">
                    {mosaicFaces[2] ? (
                      isEditable && onAssignToCluster ? (
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, mosaicFaces[2].id, cluster.clusterId)}
                          onDragEnd={() => { setDragOverClusterId(null); setDragSourceClusterId(null); setDragOverCreateNewSide(null); }}
                          style={{ cursor: "grab", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <FaceThumbnail file={mosaicFaces[2].file} bbox={mosaicFaces[2].bbox} size={65} alt={cluster.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <FaceThumbnail file={mosaicFaces[2].file} bbox={mosaicFaces[2].bbox} size={65} alt={cluster.name} className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "var(--bg3)" }} />
                    )}
                  </div>
                </div>

                {/* Card body */}
                <div className="tt-pcard-body">
                  {/* Name row */}
                  <div className="tt-pcard-name-row">
                    {editingNameId === cluster.clusterId && onRename ? (
                      <input
                        type="text"
                        className="tt-pcard-name-input"
                        defaultValue={cluster.name}
                        placeholder="Name this personâ€¦"
                        onBlur={(e) => handleRenameSubmit(cluster.clusterId, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSubmit(cluster.clusterId, (e.target as HTMLInputElement).value);
                          if (e.key === "Escape") setEditingNameId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <>
                        <span
                          className="tt-pcard-name-display"
                          title={cluster.name}
                        >
                          {cluster.name}
                        </span>
                        {isEditable && onRename && (
                          <button
                            type="button"
                            className="tt-pcard-rename-btn"
                            onClick={() => setEditingNameId(cluster.clusterId)}
                          >
                            rename
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Face thumb strip (faces 4+) */}
                  {(stripFaces.length > 0 || hiddenCount > 0) && (
                    <div className="tt-pcard-thumb-strip">
                      {stripFaces.map(({ id, file, bbox }) =>
                        isEditable && onAssignToCluster ? (
                          <div
                            key={id}
                            className="tt-face-thumb-wrap"
                            draggable
                            onDragStart={(e) => handleDragStart(e, id, cluster.clusterId)}
                            onDragEnd={() => { setDragOverClusterId(null); setDragSourceClusterId(null); setDragOverCreateNewSide(null); }}
                            title="Drag to reassign"
                          >
                            <FaceThumbnail file={file} bbox={bbox} size={44} alt={cluster.name} />
                            <span
                              style={{ position: "absolute", bottom: 2, right: 2, background: "rgba(0,0,0,0.4)", borderRadius: 4, padding: "1px 2px", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.8)" }}
                              aria-hidden
                            >
                              <SmallDragIcon />
                            </span>
                          </div>
                        ) : (
                          <FaceThumbnail key={id} file={file} bbox={bbox} size={44} alt={cluster.name} />
                        )
                      )}
                      {hiddenCount > 0 && (
                        <div className="tt-thumb-more">+{hiddenCount}</div>
                      )}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="tt-pcard-meta">
                    {detections.length} face{detections.length !== 1 ? "s" : ""} detected
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
                          <option value="">Merge intoâ€¦</option>
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
      </div>

      {/* â”€â”€ Uncategorized section â”€â”€ */}
      {(uncatCluster || imageIdsWithNoFaces.length > 0) && (() => {
        const uncatDetections = (uncatCluster?.detectionIds ?? [])
          .map((id) => {
            const t = taggedByKey.get(id);
            if (!t) return null;
            const file = filesById.get(t.imageId);
            if (!file) return null;
            return { id, file, bbox: t.bbox };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null);

        const totalUncat = uncatDetections.length + imageIdsWithNoFaces.length;
        if (totalUncat === 0) return null;

        const isUncatDrop =
          uncatCluster &&
          isEditable &&
          onAssignToCluster &&
          dragOverClusterId === UNCATEGORIZED_CLUSTER_ID;

        return (
          <div
            className="tt-unid-section"
            onDragOver={uncatCluster ? (e) => handleDragOver(e, UNCATEGORIZED_CLUSTER_ID) : undefined}
            onDragLeave={uncatCluster ? handleDragLeave : undefined}
            onDrop={uncatCluster ? (e) => handleDrop(e, UNCATEGORIZED_CLUSTER_ID) : undefined}
            style={isUncatDrop ? { borderTopColor: "var(--accent3)" } : undefined}
          >
            <div className="tt-unid-title">
              Uncategorized
              <span className="tt-unid-count">{totalUncat}</span>
            </div>
            <div className="tt-unid-strip">
              {uncatDetections.map(({ id, file, bbox }) => (
                <div
                  key={id}
                  className={`tt-unid-chip ${isUncatDrop ? "tt-unid-chip--drop" : ""}`}
                  title="Unrecognized face"
                >
                  {isEditable && onAssignToCluster ? (
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, id, UNCATEGORIZED_CLUSTER_ID)}
                      onDragEnd={() => { setDragOverClusterId(null); setDragSourceClusterId(null); setDragOverCreateNewSide(null); }}
                      style={{ width: "100%", height: "100%", cursor: "grab" }}
                    >
                      <FaceThumbnail file={file} bbox={bbox} size={48} alt="Uncategorized face" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <FaceThumbnail file={file} bbox={bbox} size={48} alt="Uncategorized face" className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
              {imageIdsWithNoFaces.map((imageId) => {
                const file = filesById.get(imageId);
                if (!file) return null;
                return (
                  <div
                    key={`no-face-${imageId}`}
                    className="tt-unid-chip"
                    title="No face detected"
                    style={{ outline: "1px solid var(--border2)" }}
                  >
                    <FullImageThumbnail file={file} size={48} alt="No face detected" />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
