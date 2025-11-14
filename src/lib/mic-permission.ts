// Centralized microphone permission helper
// Requests mic access on a user gesture and returns whether it is granted.

/**
 * Check microphone permission status without requesting it.
 * Returns true if permission is already granted, false otherwise.
 * This function does not trigger a permission prompt.
 */
export async function checkMicPermissionStatus(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return true;

  // Use Permissions API to check status without requesting
  try {
    const permissions: any = (navigator as any).permissions;
    if (permissions && permissions.query) {
      const status: any = await permissions.query({ name: 'microphone' as any });
      if (status && status.state === 'granted') return true;
      // If explicitly denied, return false
      if (status && status.state === 'denied') return false;
      // If 'prompt', fall through to device enumeration check
    }
  } catch {
    // Permissions API not supported or failed, fall through to device enumeration
  }

  // Check localStorage for explicit permission grant flag
  try {
    const permissionGranted = localStorage.getItem('media_permission_granted');
    if (permissionGranted === '1') {
      // User has explicitly granted permission before, trust that
      return true;
    }
  } catch {}

  // Fallback: Try to enumerate devices
  // If we can enumerate devices and they have labels, permission is likely granted
  // Devices without labels usually means permission hasn't been granted yet
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    // If we have audio input devices with labels, permission is definitely granted
    // (labels are only available after permission is granted)
    if (audioInputs.length > 0 && audioInputs.some(device => device.label)) {
      return true;
    }
    
    // If we have audio devices but no labels, check if user has interacted before
    // Some browsers don't provide labels even after permission is granted
    if (audioInputs.length > 0) {
      try {
        const hasSeenPrompt = localStorage.getItem('media_prompt_seen');
        // If user has seen the prompt before and we have devices, assume permission is granted
        // This handles cases where browsers don't provide labels or Permissions API isn't available
        if (hasSeenPrompt) {
          return true;
        }
      } catch {}
    }
  } catch {
    // Device enumeration failed
  }

  // If we can't determine status, return false to be safe (will show modal)
  return false;
}

export async function ensureMicPermission(): Promise<boolean> {
  if (typeof navigator === 'undefined') return true;

  // Fast path via Permissions API where supported
  try {
    // Some browsers (Safari) don't support Permissions API for microphone
    // Use loose typing to avoid TS lib DOM mismatch across environments
    const permissions: any = (navigator as any).permissions;
    if (permissions && permissions.query) {
      const status: any = await permissions.query({ name: 'microphone' as any });
      if (status && status.state === 'granted') return true;
      if (status && status.state === 'denied') return false;
      // If 'prompt', fall through to request below
    }
  } catch {}

  // Trigger a real getUserMedia prompt on a user gesture
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      // Immediately stop the tracks; we only needed permission
      stream.getTracks().forEach((t) => t.stop());
    } catch {}
    return true;
  } catch (err) {
    console.warn('Microphone permission was not granted:', err);
    return false;
  }
}


