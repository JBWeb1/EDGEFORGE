"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisibleInterval } from "./use-visible-interval";

const POLL_MS = 15_000;
const CHANNEL = "edgeforge-sync";

/** Pages where a refresh could disrupt someone typing; changes wait until they leave. */
const isEditing = (path: string) => /\/(new|edit)$/.test(path);

/**
 * Keeps server-rendered pages current. When this user's data changes in
 * another tab or on another device, the page re-renders with fresh data.
 */
export function LiveSync({ version }: { version: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const known = useRef(version);
  const pending = useRef(false);
  const [status, setStatus] = useState<"live" | "offline">("live");

  const apply = useCallback(
    (next: number) => {
      if (next <= known.current) return;
      known.current = next;
      if (isEditing(window.location.pathname)) pending.current = true;
      else router.refresh();
    },
    [router],
  );

  // This tab's own changes re-render the layout with a newer version: adopt it
  // without refreshing again, and tell other tabs in this browser right away.
  useEffect(() => {
    if (version > known.current) {
      known.current = version;
      try {
        const ch = new BroadcastChannel(CHANNEL);
        ch.postMessage(version);
        ch.close();
      } catch {}
    }
  }, [version]);

  useEffect(() => {
    let ch: BroadcastChannel | undefined;
    try {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = (e) => typeof e.data === "number" && apply(e.data);
    } catch {}
    return () => ch?.close();
  }, [apply]);

  useEffect(() => {
    if (pending.current && !isEditing(pathname)) {
      pending.current = false;
      router.refresh();
    }
  }, [pathname, router]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { version: number };
      setStatus("live");
      apply(data.version);
    } catch {
      setStatus("offline");
    }
  }, [apply]);

  useVisibleInterval(poll, POLL_MS);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-navy-400" title="Pages update automatically when your data changes">
      <span className={status === "live" ? "h-1.5 w-1.5 rounded-full bg-profit" : "h-1.5 w-1.5 rounded-full bg-navy-400"} aria-hidden />
      {status === "live" ? "Live" : "Offline — retrying"}
    </span>
  );
}
