"use client";

import { useCallback, useRef, useState } from "react";
import { UNCATEGORIZED_CLUSTER_ID } from "@/lib/constants";

/**
 * Long-press threshold before drag mode activates (ms).
 * 400 ms is long enough to distinguish from a tap but short enough to feel snappy.
 */
const LONG_PRESS_MS = 400;

/**
 * Finger movement budget before the gesture is treated as a scroll rather than
 * a drag initiation (pixels, Euclidean distance).
 */
const SCROLL_CANCEL_PX = 8;
const TOUCH_DRAG_SCROLL_EDGE_THRESHOLD = 240;
const TOUCH_DRAG_SCROLL_BASE_SPEED = 20;

function getTouchDragScrollContainer(): HTMLElement | null {
  return document.querySelector(".tt-screen--results") as HTMLElement | null;
}

function scrollTouchDragContainerBy(delta: number) {
  const container = getTouchDragScrollContainer();
  if (container && container.scrollHeight > container.clientHeight) {
    container.scrollBy({ top: delta, behavior: "auto" });
    return;
  }
  window.scrollBy({ top: delta, behavior: "auto" });
}

function getTouchAutoScrollDelta(clientY: number): number {
  if (!Number.isFinite(clientY)) return 0;

  const clampedTopY = Math.max(0, clientY);

  if (clampedTopY < TOUCH_DRAG_SCROLL_EDGE_THRESHOLD) {
    const intensity = 1 - clampedTopY / TOUCH_DRAG_SCROLL_EDGE_THRESHOLD;
    return -Math.max(14, Math.round(TOUCH_DRAG_SCROLL_BASE_SPEED + intensity * 18));
  }

  const bottomThreshold = window.innerHeight - TOUCH_DRAG_SCROLL_EDGE_THRESHOLD;
  if (clientY > bottomThreshold) {
    const intensity = (clientY - bottomThreshold) / TOUCH_DRAG_SCROLL_EDGE_THRESHOLD;
    return Math.max(14, Math.round(TOUCH_DRAG_SCROLL_BASE_SPEED + intensity * 18));
  }

  return 0;
}

interface TouchDragCallbacks {
  onAssignToCluster?: (detectionIds: string[], targetClusterId: number) => void;
  onMerge?: (sourceClusterId: number, targetClusterId: number) => void;
  onSplit?: (
    clusterId: number,
    detectionIdsToMove: string[],
    targetClusterId?: number
  ) => void;
}

export interface TouchDragReturn {
  /** True while a face-thumbnail long-press drag is active. */
  isTouchDraggingFace: boolean;
  /** True while a cluster-card long-press drag is active. */
  isTouchDraggingCard: boolean;
  /** The detectionId of the face currently being touch-dragged, or null. */
  touchDragFaceId: string | null;
  /** The clusterId of the card currently being touch-dragged, or null. */
  touchDragCardId: number | null;
  /** The cluster card currently hovered during a touch drag, or null. */
  touchDragOverClusterId: number | null;
  /** The create-new zone side currently hovered during a face touch drag, or null. */
  touchDragOverCreateNew: "left" | "right" | "uncategorized" | null;
  /**
   * Returns event handlers to attach to the draggable wrapper of a face thumbnail.
   * Memoised — safe to call inside render.
   */
  makeFaceTouchHandlers: (
    detectionId: string,
    sourceClusterId: number
  ) => {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  /**
   * Returns event handlers to attach to a cluster-card drag handle (for merging).
   */
  makeCardTouchHandlers: (clusterId: number) => {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

/**
 * Touch-based long-press drag for face reassignment and cluster merging.
 *
 * DOM elements that should act as drop targets MUST carry:
 *   - `data-cluster-id="<number>"` on cluster-card roots, and
 *   - `data-create-zone="left|right|bottom"` on create-new zone roots.
 *
 * The hook attaches a single non-passive `touchmove` listener to `document`
 * while a drag is active so it can call `preventDefault()` and suppress native
 * scrolling during the gesture.
 */
export function useTouchDrag({
  onAssignToCluster,
  onMerge,
  onSplit,
}: TouchDragCallbacks): TouchDragReturn {
  // ── Reactive state (drives renders) ──────────────────────────────────────
  const [isTouchDraggingFace, setIsTouchDraggingFace] = useState(false);
  const [isTouchDraggingCard, setIsTouchDraggingCard] = useState(false);
  const [touchDragFaceId, setTouchDragFaceId] = useState<string | null>(null);
  const [touchDragCardId, setTouchDragCardId] = useState<number | null>(null);
  const [touchDragOverClusterId, setTouchDragOverClusterId] = useState<
    number | null
  >(null);
  const [
    touchDragOverCreateNew,
    setTouchDragOverCreateNew,
  ] = useState<"left" | "right" | "uncategorized" | null>(null);

  // Throttle auto-scroll during touch drag
  const lastScrollRef = useRef(0);

  // ── Refs (read inside handlers — avoids stale closures) ──────────────────
  const isFaceActiveRef = useRef(false);
  const isCardActiveRef = useRef(false);
  const overClusterIdRef = useRef<number | null>(null);
  const overCreateNewRef = useRef<"left" | "right" | "uncategorized" | null>(null);
  const faceDragDataRef = useRef<{
    detectionId: string;
    sourceClusterId: number;
  } | null>(null);
  const cardDragDataRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keep callback refs fresh so handlers never need to re-create
  const cbRef = useRef({ onAssignToCluster, onMerge, onSplit });
  cbRef.current = { onAssignToCluster, onMerge, onSplit };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stable reference used for both add + remove of the global listener
  const preventScrollRef = useRef<(e: TouchEvent) => void>();
  preventScrollRef.current = (e: TouchEvent) => {
    if (isFaceActiveRef.current || isCardActiveRef.current) {
      e.preventDefault();
    }
  };

  // Stable wrapper so add/remove see the same function reference
  const stablePreventScroll = useRef((e: TouchEvent) => {
    preventScrollRef.current?.(e);
  });

  const resetAll = useCallback(() => {
    isFaceActiveRef.current = false;
    isCardActiveRef.current = false;
    overClusterIdRef.current = null;
    overCreateNewRef.current = null;
    faceDragDataRef.current = null;
    cardDragDataRef.current = null;
    setIsTouchDraggingFace(false);
    setIsTouchDraggingCard(false);
    setTouchDragFaceId(null);
    setTouchDragCardId(null);
    setTouchDragOverClusterId(null);
    setTouchDragOverCreateNew(null);
    document.removeEventListener(
      "touchmove",
      stablePreventScroll.current,
    );
  }, []);

  const updateHover = useCallback((clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;

    if (!el) {
      overClusterIdRef.current = null;
      overCreateNewRef.current = null;
      setTouchDragOverClusterId(null);
      setTouchDragOverCreateNew(null);
      return;
    }

    const createZoneEl = el.closest("[data-create-zone]") as HTMLElement | null;
    const clusterEl = el.closest("[data-cluster-id]") as HTMLElement | null;

    if (createZoneEl) {
      const side = createZoneEl.getAttribute(
        "data-create-zone"
      ) as "left" | "right" | "uncategorized";
      overCreateNewRef.current = side;
      overClusterIdRef.current = null;
      setTouchDragOverCreateNew(side);
      setTouchDragOverClusterId(null);
    } else if (clusterEl) {
      const id = parseInt(
        clusterEl.getAttribute("data-cluster-id") ?? "",
        10
      );
      if (!Number.isNaN(id)) {
        overClusterIdRef.current = id;
        overCreateNewRef.current = null;
        setTouchDragOverClusterId(id);
        setTouchDragOverCreateNew(null);
      }
    } else {
      overClusterIdRef.current = null;
      overCreateNewRef.current = null;
      setTouchDragOverClusterId(null);
      setTouchDragOverCreateNew(null);
    }
  }, []);

  // ── Face drag handlers ────────────────────────────────────────────────────
  const makeFaceTouchHandlers = useCallback(
    (detectionId: string, sourceClusterId: number) => ({
      onTouchStart: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        startPosRef.current = { x: touch.clientX, y: touch.clientY };
        faceDragDataRef.current = { detectionId, sourceClusterId };
        cancelTimer();
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          isFaceActiveRef.current = true;
          setIsTouchDraggingFace(true);
          setTouchDragFaceId(detectionId);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(40);
          }
          document.addEventListener(
            "touchmove",
            stablePreventScroll.current,
            { passive: false }
          );
        }, LONG_PRESS_MS);
      },
      onTouchMove: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (timerRef.current !== null) {
          // Timer still pending — cancel if the finger has moved (= scroll intent)
          const dx = touch.clientX - startPosRef.current.x;
          const dy = touch.clientY - startPosRef.current.y;
          if (dx * dx + dy * dy > SCROLL_CANCEL_PX * SCROLL_CANCEL_PX) {
            cancelTimer();
            faceDragDataRef.current = null;
          }
          return;
        }
        if (!isFaceActiveRef.current) return;
        updateHover(touch.clientX, touch.clientY);
        // Auto-scroll near viewport edges
        const now = Date.now();
        if (now - lastScrollRef.current >= 16) {
          lastScrollRef.current = now;
          const delta = getTouchAutoScrollDelta(touch.clientY);
          if (delta !== 0) scrollTouchDragContainerBy(delta);
        }
      },
      onTouchEnd: () => {
        cancelTimer();
        if (!isFaceActiveRef.current || !faceDragDataRef.current) {
          resetAll();
          return;
        }
        const data = faceDragDataRef.current;
        if (overCreateNewRef.current === "uncategorized") {
          // Bottom zone: create new person if source is already uncategorized, else move to uncategorized
          if (data.sourceClusterId === UNCATEGORIZED_CLUSTER_ID) {
            cbRef.current.onSplit?.(data.sourceClusterId, [data.detectionId], undefined);
          } else {
            cbRef.current.onAssignToCluster?.([data.detectionId], UNCATEGORIZED_CLUSTER_ID);
          }
        } else if (overCreateNewRef.current) {
          // Left / right zones — create new character
          cbRef.current.onSplit?.(
            data.sourceClusterId,
            [data.detectionId],
            undefined
          );
        } else if (
          overClusterIdRef.current !== null &&
          overClusterIdRef.current !== data.sourceClusterId
        ) {
          cbRef.current.onAssignToCluster?.(
            [data.detectionId],
            overClusterIdRef.current
          );
        }
        resetAll();
      },
    }),
    [cancelTimer, updateHover, resetAll]
  );

  // ── Card drag handlers ────────────────────────────────────────────────────
  const makeCardTouchHandlers = useCallback(
    (clusterId: number) => ({
      onTouchStart: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        startPosRef.current = { x: touch.clientX, y: touch.clientY };
        cardDragDataRef.current = clusterId;
        cancelTimer();
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          isCardActiveRef.current = true;
          setIsTouchDraggingCard(true);
          setTouchDragCardId(clusterId);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(40);
          }
          document.addEventListener(
            "touchmove",
            stablePreventScroll.current,
            { passive: false }
          );
        }, LONG_PRESS_MS);
      },
      onTouchMove: (e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (timerRef.current !== null) {
          const dx = touch.clientX - startPosRef.current.x;
          const dy = touch.clientY - startPosRef.current.y;
          if (dx * dx + dy * dy > SCROLL_CANCEL_PX * SCROLL_CANCEL_PX) {
            cancelTimer();
            cardDragDataRef.current = null;
          }
          return;
        }
        if (!isCardActiveRef.current) return;
        updateHover(touch.clientX, touch.clientY);
        // Auto-scroll near viewport edges
        const now = Date.now();
        if (now - lastScrollRef.current >= 16) {
          lastScrollRef.current = now;
          const delta = getTouchAutoScrollDelta(touch.clientY);
          if (delta !== 0) scrollTouchDragContainerBy(delta);
        }
      },
      onTouchEnd: () => {
        cancelTimer();
        if (!isCardActiveRef.current || cardDragDataRef.current === null) {
          resetAll();
          return;
        }
        const source = cardDragDataRef.current;
        if (
          overClusterIdRef.current !== null &&
          overClusterIdRef.current !== source
        ) {
          cbRef.current.onMerge?.(source, overClusterIdRef.current);
        }
        resetAll();
      },
    }),
    [cancelTimer, updateHover, resetAll]
  );

  return {
    isTouchDraggingFace,
    isTouchDraggingCard,
    touchDragFaceId,
    touchDragCardId,
    touchDragOverClusterId,
    touchDragOverCreateNew,
    makeFaceTouchHandlers,
    makeCardTouchHandlers,
  };
}
