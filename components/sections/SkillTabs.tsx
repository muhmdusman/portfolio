"use client";

import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { usePortfolio } from "@/lib/usePortfolio";
import { store } from "@/lib/store";

interface Tab {
  key: string;
  label: string;
  accent: string;
  count: number;
}

/**
 * Accessible tabs. Panels are rendered on the server; this component only
 * decides which one is visible. The choice is shared with the 3D scene,
 * where the matching icons fly into formation.
 */
export function SkillTabs({ tabs, panels }: { tabs: Tab[]; panels: ReactNode[] }) {
  const active = usePortfolio((s) => s.skillCategory);
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === active));

  const select = (index: number, focus = false) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    store.setState({ skillCategory: tab.key });
    if (focus) listRef.current?.querySelector<HTMLButtonElement>(`#tab-${tab.key}`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowDown: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      ArrowUp: activeIndex - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (e.key in keys) {
      e.preventDefault();
      select(keys[e.key], true);
    }
  };

  return (
    <div className="skills">
      <div ref={listRef} className="skills__tabs" role="tablist" aria-label="Skill categories" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => {
          const selected = i === activeIndex;
          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              type="button"
              role="tab"
              className="skills__tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(i)}
              style={{ "--accent": tab.accent } as CSSProperties}
            >
              <span className="skills__dot" aria-hidden="true" />
              {tab.label}
              <span className="skills__count">{tab.count}</span>
            </button>
          );
        })}
      </div>
      {panels.map((panel, i) => (
        <div
          key={tabs[i].key}
          id={`panel-${tabs[i].key}`}
          role="tabpanel"
          aria-labelledby={`tab-${tabs[i].key}`}
          hidden={i !== activeIndex}
          className="skills__panel"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
