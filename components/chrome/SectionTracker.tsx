"use client";

import { useEffect } from "react";
import type { SectionId } from "@/content/portfolio";
import { store } from "@/lib/store";

/** Marks the section that crosses the middle of the viewport as active. */
export function SectionTracker() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const section = entry.target.getAttribute("data-section") as SectionId;
            // CSS hook, e.g. a darker veil while the camera is at the desk
            document.documentElement.dataset.section = section;
            store.setState({ section });
          }
        }
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
