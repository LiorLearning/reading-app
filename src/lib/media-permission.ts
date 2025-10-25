// Centralized microphone + camera permission helper
// Requests combined audio+video access on a user gesture to trigger a single browser prompt.

export interface MediaPermissionResult {
  micGranted: boolean;
  camGranted: boolean;
}

// Hardcoded flag to disable camera permission
const ENABLE_CAMERA_PERMISSION = false;

/**
 * Request both microphone and camera permissions in one call.
 * Returns true/true if the combined getUserMedia succeeds.
 * On success, any obtained tracks are immediately stopped.
 */
export async function ensureMediaPermissions(): Promise<MediaPermissionResult> {
  if (typeof navigator === 'undefined') return { micGranted: true, camGranted: true };

  // Some browsers provide Permissions API that we can use for fast-path checks
  try {
    const permissions: any = (navigator as any).permissions;
    if (permissions && permissions.query) {
      // Individual checks; do not rely solely on this because Safari may not support it
      const [micStatus, camStatus] = await Promise.allSettled([
        permissions.query({ name: 'microphone' as any }) as Promise<any>,
        ENABLE_CAMERA_PERMISSION ? permissions.query({ name: 'camera' as any }) as Promise<any> : Promise.resolve({ state: 'denied' }),
      ]);

      const micGranted = micStatus.status === 'fulfilled' && (micStatus.value?.state === 'granted');
      const camGranted = ENABLE_CAMERA_PERMISSION && camStatus.status === 'fulfilled' && (camStatus.value?.state === 'granted');

      if (micGranted && (ENABLE_CAMERA_PERMISSION ? camGranted : true)) {
        return { micGranted: true, camGranted: ENABLE_CAMERA_PERMISSION ? camGranted : false };
      }
      // If either is denied explicitly, bail early
      if ((micStatus.status === 'fulfilled' && micStatus.value?.state === 'denied') ||
          (ENABLE_CAMERA_PERMISSION && camStatus.status === 'fulfilled' && camStatus.value?.state === 'denied')) {
        return { micGranted: micGranted, camGranted: ENABLE_CAMERA_PERMISSION ? camGranted : false };
      }
      // Otherwise fall through to real request to trigger prompt
    }
  } catch {
    // Ignore Permissions API errors
  }

  // Trigger the real combined prompt
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true } as MediaTrackConstraints,
      video: ENABLE_CAMERA_PERMISSION ? { facingMode: 'user' } as MediaTrackConstraints : false,
    });

    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch {}

    return { micGranted: true, camGranted: ENABLE_CAMERA_PERMISSION };
  } catch (err) {
    // If combined request fails (e.g., user declined, device missing), attempt to detect partial grants
    // by probing individually without prompting where possible.
    const result: MediaPermissionResult = { micGranted: false, camGranted: false };
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      try { mic.getTracks().forEach((t) => t.stop()); } catch {}
      result.micGranted = true;
    } catch {}
    if (ENABLE_CAMERA_PERMISSION) {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        try { cam.getTracks().forEach((t) => t.stop()); } catch {}
        result.camGranted = true;
      } catch {}
    }
    return result;
  }
}


