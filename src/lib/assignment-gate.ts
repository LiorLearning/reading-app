import { ASSIGNMENT_WHITEBOARD_QUESTION_THRESHOLD } from './constants';

const STORAGE_KEY = 'assignment_gate_state';

export interface AssignmentGateState {
  active: boolean;
  answeredCount: number; // counts first-attempt answers only
  startedAt: number;
}

const load = (): AssignmentGateState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.active !== 'boolean') return null;
    if (typeof parsed.answeredCount !== 'number') return null;
    if (typeof parsed.startedAt !== 'number') return null;
    return parsed as AssignmentGateState;
  } catch {
    return null;
  }
};

const save = (state: AssignmentGateState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
};

export const startAssignmentGate = (): AssignmentGateState => {
  const state: AssignmentGateState = {
    active: true,
    answeredCount: 0,
    startedAt: Date.now(),
  };
  save(state);
  return state;
};

export const getAssignmentGate = (): AssignmentGateState | null => load();

export const isAssignmentGateActive = (threshold: number = ASSIGNMENT_WHITEBOARD_QUESTION_THRESHOLD): boolean => {
  const s = load();
  if (!s) return false;
  if (!s.active) return false;
  return s.answeredCount < threshold;
};

export const incrementAssignmentGate = (countThisAnswer: boolean): AssignmentGateState | null => {
  const s = load();
  if (!s || !s.active) return s;
  if (countThisAnswer) {
    const next: AssignmentGateState = { ...s, answeredCount: s.answeredCount + 1 };
    save(next);
    return next;
  }
  return s;
};

export const completeAssignmentGate = (): AssignmentGateState | null => {
  const s = load();
  if (!s) return null;
  const next: AssignmentGateState = { ...s, active: false };
  save(next);
  return next;
};


