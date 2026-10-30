"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveUpdates({ brandIds }: { brandIds: string[] }) {
  const router = useRouter();
  const primaryBrandId = brandIds.length > 0 ? brandIds[0] : null;
  const previouslyConnected = useRef<string | null>(null);
  const [state, setState] = useState<"connecting" | "connected" | "disconnected" | "empty">(
    primaryBrandId ? "connecting" : "empty",
  );

  useEffect(() => {
    if (!primaryBrandId) {
      return;
    }

    // Only connect to ONE SSE stream at a time to prevent exhausting
    // the browser's HTTP/1.1 6-connection-per-origin limit on localhost.
    const stream = new EventSource(`/api/dashboard/events?brandId=${encodeURIComponent(primaryBrandId)}`);

    stream.onopen = () => {
      const isReconnect = previouslyConnected.current === primaryBrandId;
      previouslyConnected.current = primaryBrandId;
      setState("connected");
      if (isReconnect) router.refresh();
    };

    stream.onerror = () => {
      setState("disconnected");
    };

    stream.addEventListener("dashboard-update", () => router.refresh());
    stream.addEventListener("heartbeat", () => setState("connected"));

    return () => {
      stream.close();
    };
  }, [primaryBrandId, router]);

  const visibleState = primaryBrandId ? state : "empty";
  const label = visibleState === "connected" ? "LIVE SYNC" : visibleState === "disconnected" ? "RECONNECTING" : visibleState === "empty" ? "NO BRAND STREAMS" : "CONNECTING";
  return <span className={`stream-status ${visibleState}`}><i />{label}</span>;
}
