"use client";

import { useCallback, useState } from "react";
import { useVisibleInterval } from "./use-visible-interval";

const CHECK_EVERY_MS = 5 * 60_000;

/** Tells a long-open tab that a newer version of EDGEFORGE has been deployed. */
export function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async () => {
    if (available) return;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { buildId } = (await res.json()) as { buildId?: string };
      if (buildId && buildId !== process.env.APP_BUILD_ID) setAvailable(true);
    } catch {
      // Offline or mid-deploy: try again next time.
    }
  }, [available]);

  useVisibleInterval(check, CHECK_EVERY_MS);

  if (!available || dismissed) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg flex-wrap items-center gap-3 rounded-xl border border-electric/50 bg-navy-850/95 px-4 py-3 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-6"
    >
      <span className="h-2 w-2 shrink-0 rounded-full brand-gradient" aria-hidden />
      <p className="flex-1 text-sm text-white">A new version of EDGEFORGE is available.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-electric px-3 py-1.5 text-sm font-medium text-white hover:bg-electric-soft"
      >
        Reload
      </button>
      <button type="button" onClick={() => setDismissed(true)} className="text-sm text-navy-300 hover:text-white">
        Later
      </button>
    </div>
  );
}
