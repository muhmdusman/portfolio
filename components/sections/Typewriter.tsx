"use client";

import { useEffect, useRef, useState } from "react";
import { store } from "@/lib/store";

interface TypewriterProps {
  phrases: string[];
  pauseMs: number;
}

const TYPE_MS = 75;
const DELETE_MS = 38;

/**
 * Types and deletes the hero phrases. Every keystroke is mirrored to the
 * 3D terminal and presses the matching key on the 3D keyboard.
 */
export function Typewriter({ phrases, pauseMs }: TypewriterProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || phrases.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let phrase = 0;
    let length = 0;
    let deleting = false;
    let visible = true;
    let timer = 0;

    const publish = (value: string) => {
      setText(value);
      store.setState({ typed: value });
    };

    const step = () => {
      if (!visible) return;
      const current = phrases[phrase];
      if (reduce) {
        publish(current);
        phrase = (phrase + 1) % phrases.length;
        timer = window.setTimeout(step, pauseMs * 2);
        return;
      }
      if (!deleting) {
        length++;
        const ch = current[length - 1];
        publish(current.slice(0, length));
        if (ch) store.pressKey(ch);
        if (length >= current.length) {
          deleting = true;
          timer = window.setTimeout(step, pauseMs);
          return;
        }
        timer = window.setTimeout(step, TYPE_MS + Math.random() * 60);
      } else {
        length--;
        publish(current.slice(0, Math.max(0, length)));
        store.pressKey("Backspace");
        if (length <= 0) {
          deleting = false;
          phrase = (phrase + 1) % phrases.length;
          timer = window.setTimeout(step, 380);
          return;
        }
        timer = window.setTimeout(step, DELETE_MS);
      }
    };

    // Only type while the hero is on screen.
    const observer = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was) {
        window.clearTimeout(timer);
        timer = window.setTimeout(step, 250);
      }
    });
    observer.observe(el);
    timer = window.setTimeout(step, 900);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [phrases, pauseMs]);

  return (
    <span ref={ref} className="typewriter" aria-hidden="true">
      {text}
      <span className="typewriter__caret" />
    </span>
  );
}
