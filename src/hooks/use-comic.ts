import { useCallback, useMemo, useReducer } from "react";

export type ComicPanel = {
  id: string;
  image: string;
  text: string;
};

type State = {
  panels: ComicPanel[];
  currentIndex: number;
  past: { panels: ComicPanel[]; currentIndex: number }[];
  future: { panels: ComicPanel[]; currentIndex: number }[];
};

type Action =
  | { type: "SET_CURRENT"; index: number }
  | { type: "ADD_PANEL"; panel: ComicPanel }
  | { type: "UNDO" }
  | { type: "REDO" };

function clonePanels(arr: ComicPanel[]) {
  return arr.map((p) => ({ ...p }));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_CURRENT":
      return { ...state, currentIndex: action.index };
    case "ADD_PANEL": {
      const snapshot = { panels: clonePanels(state.panels), currentIndex: state.currentIndex };
      const newPanels = [...state.panels, action.panel];
      return {
        panels: newPanels,
        currentIndex: newPanels.length - 1,
        past: [...state.past, snapshot],
        future: [],
      };
    }
    case "UNDO": {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      const newPast = state.past.slice(0, -1);
      const futureSnap = { panels: clonePanels(state.panels), currentIndex: state.currentIndex };
      return { panels: prev.panels, currentIndex: prev.currentIndex, past: newPast, future: [futureSnap, ...state.future] };
    }
    case "REDO": {
      const next = state.future[0];
      if (!next) return state;
      const rest = state.future.slice(1);
      const pastSnap = { panels: clonePanels(state.panels), currentIndex: state.currentIndex };
      return { panels: next.panels, currentIndex: next.currentIndex, past: [...state.past, pastSnap], future: rest };
    }
    default:
      return state;
  }
}

export function useComic(initialPanels: ComicPanel[]) {
  const initialState: State = useMemo(
    () => ({ panels: initialPanels, currentIndex: 0, past: [], future: [] }),
    [initialPanels]
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  const setCurrent = useCallback((index: number) => dispatch({ type: "SET_CURRENT", index }), []);
  const addPanel = useCallback((panel: ComicPanel) => dispatch({ type: "ADD_PANEL", panel }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  return { ...state, setCurrent, addPanel, undo, redo };
}
