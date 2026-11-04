import type { SectionId } from "@/content/portfolio";

/**
 * A tiny external store shared by the React UI and the lazily loaded
 * Three.js world. React reads it with `useSyncExternalStore`; the world
 * subscribes directly, so neither side has to import the other.
 */

export interface ContactDraft {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactStatus = "idle" | "sending" | "sent" | "error";
export type ContactField = keyof ContactDraft;
export type SceneStatus = "idle" | "loading" | "ready" | "unsupported" | "error";

export interface PortfolioState {
  section: SectionId;
  skillCategory: string;
  projectIndex: number;
  /** Text currently shown by the hero typewriter. Mirrored on the 3D terminal. */
  typed: string;
  contact: ContactDraft;
  contactField: ContactField | null;
  contactStatus: ContactStatus;
  sceneStatus: SceneStatus;
}

type Listener = (state: PortfolioState, prev: PortfolioState) => void;
type KeyListener = (key: string) => void;

const initialState: PortfolioState = {
  section: "home",
  skillCategory: "frontend",
  projectIndex: 0,
  typed: "",
  contact: { name: "", email: "", subject: "", message: "" },
  contactField: null,
  contactStatus: "idle",
  sceneStatus: "idle",
};

function createStore(init: PortfolioState) {
  let state = init;
  const listeners = new Set<Listener>();
  const keyListeners = new Set<KeyListener>();

  return {
    getState: () => state,
    getInitialState: () => init,
    setState(patch: Partial<PortfolioState>) {
      let changed = false;
      for (const key in patch) {
        if (!Object.is(patch[key as keyof PortfolioState], state[key as keyof PortfolioState])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      const prev = state;
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state, prev));
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Fire-and-forget key presses that animate the 3D keyboard. */
    pressKey(key: string) {
      keyListeners.forEach((listener) => listener(key));
    },
    onKey(listener: KeyListener) {
      keyListeners.add(listener);
      return () => {
        keyListeners.delete(listener);
      };
    },
  };
}

export const store = createStore(initialState);
export type PortfolioStore = typeof store;
