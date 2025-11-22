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
      // If no env key is provided, assume snippet-based init is being used; silently no-op
      if (!key) return;
      // Env-based init (used when snippet is not present)
      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: false,
        mask_all_text: false,
        mask_all_element_attributes: false,
      });
      try { posthog.startSessionRecording(); } catch {}
    } catch (e) {
      console.warn('[analytics] init failed:', e);
    }
  },

  identify(userId: string, properties?: Props): void {
    currentUserId = userId;
    try {
      const ph: any = (typeof window !== 'undefined' && (window as any).posthog) || posthog;
      ph.identify(userId, properties);
    } catch {}
  },

  reset(): void {
    // Clear cached ids and reset PostHog identity so a fresh anonymous id is issued
    currentUserId = null;
    currentSessionId = null;
    try {
      const ph: any = (typeof window !== 'undefined' && (window as any).posthog) || posthog;
      if (ph && typeof ph.reset === 'function') {
        ph.reset();
      }
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
      const ph: any = (typeof window !== 'undefined' && (window as any).posthog) || posthog;
      ph.capture(event, { ...base, ...(props || {}) });
    } catch {}
  },
};

export default analytics;


