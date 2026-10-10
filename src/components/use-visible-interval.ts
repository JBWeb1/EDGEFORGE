"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `ms` while the tab is visible, and immediately when
 * the tab becomes visible or regains focus. Paused in background tabs.
 * With `immediate`, also runs once on mount.
 */
export function useVisibleInterval(callback: () => void, ms: number, { immediate = false } = {}) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => saved.current();
    const start = () => {
      clearInterval(timer);
      timer = setInterval(tick, ms);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        clearInterval(timer);
      }
    };
    if (document.visibilityState === "visible") start();
    if (immediate) tick();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", tick);
    };
  }, [ms, immediate]);
}
