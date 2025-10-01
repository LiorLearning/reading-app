// Centralized microphone permission helper
// Requests mic access on a user gesture and returns whether it is granted.

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


