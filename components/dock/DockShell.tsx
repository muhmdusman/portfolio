"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { store } from "@/lib/store";

const MAX_SCALE = 1.75;
const RANGE = 150;

/**
 * Behaviour for the server-rendered dock: magnification that follows the
 * pointer (rAF-driven CSS variables, no React re-renders), the active
 * section indicator and a launch bounce on click.
 */
export function DockShell({ children }: { children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>("[data-dock-item]"));
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scales = items.map(() => 1);
    let pointerX: number | null = null;
    let frame = 0;

    const tick = () => {
      const centers = items.map((el) => {
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2;
      });
      let moving = false;
      items.forEach((el, i) => {
        let target = 1;
        if (pointerX !== null) {
          const d = Math.abs(pointerX - centers[i]);
          if (d < RANGE) target = 1 + (MAX_SCALE - 1) * Math.cos(((d / RANGE) * Math.PI) / 2) ** 2;
        }
        const next = scales[i] + (target - scales[i]) * 0.3;
        scales[i] = Math.abs(target - next) < 0.002 ? target : next;
        if (scales[i] !== target) moving = true;
        el.style.setProperty("--scale", scales[i].toFixed(3));
      });
      frame = moving ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (!fine.matches || reduce.matches || e.pointerType !== "mouse") return;
      pointerX = e.clientX;
      kick();
    };
    const onLeave = () => {
      pointerX = null;
      kick();
    };
    const onClick = (e: MouseEvent) => {
      const item = (e.target as Element).closest<HTMLElement>("[data-dock-item]");
      if (!item || reduce.matches) return;
      item.classList.remove("is-launching");
      // restart the animation
      void item.offsetWidth;
      item.classList.add("is-launching");
    };
    const onAnimationEnd = (e: AnimationEvent) => {
      (e.target as Element).closest("[data-dock-item]")?.classList.remove("is-launching");
    };

    const links = items.filter((el) => el.dataset.sectionLink);
    const markActive = (section: string) => {
      for (const link of links) {
        if (link.dataset.sectionLink === section) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      }
    };
    markActive(store.getState().section);
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.section !== prev.section) markActive(state.section);
    });

    panel.addEventListener("pointermove", onMove);
    panel.addEventListener("pointerleave", onLeave);
    panel.addEventListener("click", onClick);
    panel.addEventListener("animationend", onAnimationEnd);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      panel.removeEventListener("pointermove", onMove);
      panel.removeEventListener("pointerleave", onLeave);
      panel.removeEventListener("click", onClick);
      panel.removeEventListener("animationend", onAnimationEnd);
    };
  }, []);

  return (
    <div ref={panelRef} className="dock__panel">
      {children}
    </div>
  );
}
