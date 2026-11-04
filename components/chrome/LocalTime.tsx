"use client";

import { useSyncExternalStore } from "react";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(id);
}

const getSnapshot = () => formatter.format(new Date());
const getServerSnapshot = () => "";

/** Usman's local time (PKT). Rendered only in the browser to avoid stale HTML. */
export function LocalTime() {
  const time = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <time className="topbar__time" suppressHydrationWarning>
      <span className="topbar__tz">PKT</span> {time || "--:--"}
    </time>
  );
}
