import { getOrCreateDeviceId } from "./device-id";

// Local, privacy-friendly per-user per-device mic verification cache
// Increase VERSION to force re-verification across the fleet.
const VERSION = 1;
const DEFAULT_TTL_DAYS = 90;

function keyFor(userId: string, deviceId: string) {
	return `mic_verified_v${VERSION}::${userId}::${deviceId}`;
}

export function isMicVerified(userId: string, now: number = Date.now()): boolean {
	try {
		const deviceId = getOrCreateDeviceId();
		const raw = localStorage.getItem(keyFor(userId, deviceId));
		if (!raw) return false;
		const obj = JSON.parse(raw) as { verifiedAt: number; expiresAt?: number };
		if (!obj?.verifiedAt) return false;
		if (obj.expiresAt && now > obj.expiresAt) return false;
		return true;
	} catch {
		return false;
	}
}

export function setMicVerified(userId: string, ttlDays: number = DEFAULT_TTL_DAYS): void {
	try {
		const deviceId = getOrCreateDeviceId();
		const now = Date.now();
		const expiresAt = now + ttlDays * 24 * 60 * 60 * 1000;
		const payload = JSON.stringify({ verifiedAt: now, expiresAt });
		localStorage.setItem(keyFor(userId, deviceId), payload);
	} catch {
		// ignore
	}
}

export function clearMicVerified(userId: string): void {
	try {
		const deviceId = getOrCreateDeviceId();
		localStorage.removeItem(keyFor(userId, deviceId));
	} catch {
		// ignore
	}
}

export function getMicVerificationVersion(): number {
	return VERSION;
}


