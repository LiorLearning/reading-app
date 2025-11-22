// Generate and persist a per-browser/device identifier
// Stored in localStorage. Different browsers/profiles count as different devices.

const DEVICE_ID_KEY = 'device_id_v1';

export function getOrCreateDeviceId(): string {
	try {
		if (typeof window === 'undefined') return 'server-device';
		const existing = localStorage.getItem(DEVICE_ID_KEY);
		if (existing && existing.length > 0) return existing;
		const id = crypto.randomUUID ? crypto.randomUUID() : `dev-${Math.random().toString(36).slice(2)}-${Date.now()}`;
		localStorage.setItem(DEVICE_ID_KEY, id);
		return id;
	} catch {
		// Fallback non-persistent
		return `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`;
	}
}

export function getDeviceIdUnsafe(): string | null {
	try {
		return localStorage.getItem(DEVICE_ID_KEY);
	} catch {
		return null;
	}
}

export function resetDeviceId(): void {
	try {
		localStorage.removeItem(DEVICE_ID_KEY);
	} catch {
		// ignore
	}
}


