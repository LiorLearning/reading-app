import posthog from 'posthog-js';

type Primitive = string | number | boolean | null | undefined;
type Props = Record<string, Primitive>;

const SESSION_NUM_KEY_PREFIX = 'lk_session_number_';
let currentUserId: string | null = null;
let currentSessionId: string | null = null;

function getSessionNumberKey(userId: string): string {
  return `${SESSION_NUM_KEY_PREFIX}${userId}`;
}

function getSessionNumber(userId?: string | null): number | null {
  const uid = userId || currentUserId;
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(getSessionNumberKey(uid));
    return raw ? Number(raw) : 0;
  } catch {
    return null;
  }
}

function setSessionNumber(num: number, userId?: string | null): void {
  const uid = userId || currentUserId;
  if (!uid) return;
  try { localStorage.setItem(getSessionNumberKey(uid), String(num)); } catch {}
}

export const analytics = {
  init(): void {
    try {
      const key = import.meta.env.VITE_POSTHOG_KEY;
      const host = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
      if (!key) {
        console.warn('[analytics] POSTHOG key missing; capture will no-op');
        return;
      }
      posthog.init(key, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: true,
        disable_session_recording: true,
        mask_all_text: true,
        mask_all_element_attributes: true,
      });
    } catch (e) {
      console.warn('[analytics] init failed:', e);
    }
  },

  identify(userId: string, properties?: Props): void {
    currentUserId = userId;
    try {
      posthog.identify(userId, properties);
    } catch {}
  },

  setSession(sessionId: string | null): void {
    currentSessionId = sessionId;
    // Increment per-user session number when a new non-null session starts
    if (currentUserId && sessionId) {
      const existing = getSessionNumber(currentUserId) || 0;
      setSessionNumber(existing + 1, currentUserId);
    }
  },

  capture(event: string, props?: Props): void {
    const base: Props = {};
    if (currentSessionId) base.session_id = currentSessionId;
    const sn = getSessionNumber(currentUserId);
    if (sn !== null) base.session_number = sn;
    try {
      posthog.capture(event, { ...base, ...(props || {}) });
    } catch {}
  },
};

export default analytics;


