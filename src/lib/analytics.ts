type Primitive = string | number | boolean | null | undefined;
type Props = Record<string, Primitive>;

const SESSION_NUM_KEY_PREFIX = 'lk_session_number_';
let currentUserId: string | null = null;
let currentSessionId: string | null = null;
let isInitialized = false;
let posthogClient: any | null = null;
let posthogPromise: Promise<any> | null = null;

async function loadPosthog(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).posthog) {
    return (window as any).posthog;
  }
  if (posthogClient) return posthogClient;
  if (!posthogPromise) {
    posthogPromise = import('posthog-js')
      .then((mod) => {
        posthogClient = mod?.default ?? mod;
        return posthogClient;
      })
      .catch((error) => {
        posthogPromise = null;
        throw error;
      });
  }
  return posthogPromise;
}

function withPosthog(callback: (client: any) => void): void {
  try {
    const inlineClient = typeof window !== 'undefined' ? (window as any).posthog : null;
    if (inlineClient) {
      callback(inlineClient);
      return;
    }
    if (posthogClient) {
      callback(posthogClient);
      return;
    }
    loadPosthog().then((client) => {
      try { callback(client); } catch {}
    }).catch(() => {});
  } catch {}
}

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
  async init(): Promise<void> {
    if (isInitialized) return;
    try {
      const key = import.meta.env.VITE_POSTHOG_KEY;
      const host = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
      // If no env key is provided, assume snippet-based init is being used; silently no-op
      if (!key) {
        isInitialized = true;
        return;
      }
      const client = await loadPosthog();
      client.init(key, {
        api_host: host,
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: false,
        mask_all_text: false,
        mask_all_element_attributes: false,
      });
      try { client.startSessionRecording(); } catch {}
      isInitialized = true;
    } catch (e) {
      console.warn('[analytics] init failed:', e);
    }
  },

  identify(userId: string, properties?: Props): void {
    currentUserId = userId;
    withPosthog((client) => {
      try { client.identify(userId, properties); } catch {}
    });
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
    withPosthog((client) => {
      try { client.capture(event, { ...base, ...(props || {}) }); } catch {}
    });
  },
};

export default analytics;


