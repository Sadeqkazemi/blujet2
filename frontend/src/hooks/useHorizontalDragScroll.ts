import { useCallback, useRef, type CSSProperties } from 'react';

type PointerState = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
};

/** Enables finger/mouse drag scrolling inside overflow-x containers (e.g. button rows). */
export function useHorizontalDragScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerState = useRef<PointerState | null>(null);
  const draggedRef = useRef(false);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    pointerState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
    };
    draggedRef.current = false;
    container.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const state = pointerState.current;
    if (!container || !state || event.pointerId !== state.pointerId) return;

    const deltaX = event.clientX - state.startX;
    if (Math.abs(deltaX) > 4) draggedRef.current = true;
    if (!draggedRef.current) return;

    const rtl = getComputedStyle(container).direction === 'rtl';
    container.scrollLeft = rtl ? state.startScrollLeft + deltaX : state.startScrollLeft - deltaX;
  }, []);

  const endPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const state = pointerState.current;
    if (!container || !state || event.pointerId !== state.pointerId) return;
    container.releasePointerCapture(event.pointerId);
    pointerState.current = null;
  }, []);

  const onClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!draggedRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    draggedRef.current = false;
  }, []);

  return {
    containerRef,
    dragScrollProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onClickCapture,
    },
  };
}

export const horizontalScrollStyle: CSSProperties = {
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  touchAction: 'pan-x',
};
