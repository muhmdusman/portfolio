"use client";

import { useEffect, useRef } from "react";
import type { SectionId } from "@/content/portfolio";
import { store } from "@/lib/store";

function supportsWebGL2() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

function scrollToSection(id: SectionId, smooth: boolean) {
  document.getElementById(id)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

/**
 * Fixed full-screen WebGL layer behind the page. The Three.js world is a
 * separate chunk that is only fetched once the browser is idle, so the
 * server-rendered content paints (and is interactive) first.
 */
export function Scene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const tip = tipRef.current;
    if (!container || !tip) return;
    const root = document.documentElement;
    const setStatus = (status: "loading" | "ready" | "unsupported" | "error") => {
      root.dataset.scene = status;
      store.setState({ sceneStatus: status });
    };

    if (!supportsWebGL2()) {
      setStatus("unsupported");
      return;
    }

    let disposed = false;
    let world: { dispose(): void } | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The hover label follows the pointer without re-rendering React, and
    // flips to the left of the pointer near the right edge.
    let tipWidth = 0;
    let px = 0;
    let py = 0;
    const placeTip = () => {
      const x = px + 16 + tipWidth > window.innerWidth - 8 ? px - 12 - tipWidth : px + 16;
      tip.style.transform = `translate3d(${x}px, ${py + 18}px, 0)`;
    };
    const onPointerMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      placeTip();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const start = async () => {
      setStatus("loading");
      try {
        await document.fonts.ready;
        const { createWorld } = await import("@/three/World");
        if (disposed) return;
        const css = getComputedStyle(root);
        const created = await createWorld({
          container,
          store,
          reducedMotion,
          fonts: {
            sans: css.getPropertyValue("--ff-sans").trim() || "system-ui, sans-serif",
            mono: css.getPropertyValue("--ff-mono").trim() || "ui-monospace, monospace",
          },
          onHover: (label) => {
            tip.textContent = label ?? "";
            tip.dataset.visible = label ? "true" : "false";
            tipWidth = label ? tip.offsetWidth : 0;
            placeTip();
          },
          onNavigate: (id) => scrollToSection(id, !reducedMotion),
        });
        if (disposed) {
          created.dispose();
          return;
        }
        world = created;
        setStatus("ready");
      } catch (error) {
        console.error("3D scene failed to start", error);
        if (!disposed) setStatus("error");
      }
    };

    // Safari has no requestIdleCallback.
    const hasIdle = typeof window.requestIdleCallback === "function";
    const idle = hasIdle
      ? window.requestIdleCallback(() => void start(), { timeout: 1500 })
      : window.setTimeout(() => void start(), 200);

    return () => {
      disposed = true;
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.removeEventListener("pointermove", onPointerMove);
      world?.dispose();
      world = null;
    };
  }, []);

  return (
    <>
      <div className="scene" aria-hidden="true">
        <div ref={containerRef} className="scene__canvas" />
        <div className="scene__veil" />
      </div>
      <div ref={tipRef} className="scene-tip" data-visible="false" aria-hidden="true" />
    </>
  );
}
