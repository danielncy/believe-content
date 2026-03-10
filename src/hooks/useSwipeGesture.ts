'use client';

import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
}

const SWIPE_THRESHOLD = 80;
const TAP_THRESHOLD = 10;

export function useSwipeGesture({ onSwipeLeft, onSwipeRight, onTap }: SwipeHandlers) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = 0;
    swiping.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current || !elementRef.current) return;

    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);

    // If vertical scroll dominates, cancel swipe
    if (dy > Math.abs(dx) && Math.abs(dx) < 30) {
      return;
    }

    currentX.current = dx;
    const clamped = Math.max(-150, Math.min(150, dx));
    elementRef.current.style.transform = `translateX(${clamped}px)`;
    elementRef.current.style.transition = 'none';

    // Color feedback
    if (dx > SWIPE_THRESHOLD) {
      elementRef.current.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
    } else if (dx < -SWIPE_THRESHOLD) {
      elementRef.current.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
    } else {
      elementRef.current.style.backgroundColor = '';
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!elementRef.current) return;
    swiping.current = false;

    const dx = currentX.current;
    const el = elementRef.current;

    if (Math.abs(dx) < TAP_THRESHOLD) {
      el.style.transform = '';
      el.style.backgroundColor = '';
      el.style.transition = '';
      onTap?.();
      return;
    }

    if (dx > SWIPE_THRESHOLD) {
      el.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out';
      el.style.transform = 'translateX(100%)';
      el.style.opacity = '0';
      setTimeout(() => onSwipeRight?.(), 200);
    } else if (dx < -SWIPE_THRESHOLD) {
      el.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out';
      el.style.transform = 'translateX(-100%)';
      el.style.opacity = '0';
      setTimeout(() => onSwipeLeft?.(), 200);
    } else {
      el.style.transition = 'transform 200ms ease-out, background-color 200ms ease-out';
      el.style.transform = 'translateX(0)';
      el.style.backgroundColor = '';
    }
  }, [onSwipeLeft, onSwipeRight, onTap]);

  return {
    ref: elementRef,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
