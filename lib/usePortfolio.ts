"use client";

import { useSyncExternalStore } from "react";
import { store, type PortfolioState } from "./store";

const subscribe = (onChange: () => void) => store.subscribe(onChange);

/** Subscribe a component to one slice of the shared store. Return primitives. */
export function usePortfolio<T>(selector: (state: PortfolioState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(store.getState()),
    () => selector(store.getInitialState()),
  );
}
