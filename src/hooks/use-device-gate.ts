import * as React from "react"

/**
 * Device gate detection hook
 * - Treats small/narrow, coarse-pointer devices as "phone-like"
 * - Exposes suppression via localStorage to respect user choice
 */
export interface DeviceGateState {
  isPhoneLikely: boolean
  isSuppressed: boolean
  shouldShowGate: boolean
  suppressForDays: (days: number) => void
  clearSuppression: () => void
}

const SUPPRESS_KEY = "device-gate-suppress-until"
const DEFAULT_MIN_DIMENSION_THRESHOLD = 500 // px

function isPhoneLike(threshold = DEFAULT_MIN_DIMENSION_THRESHOLD): boolean {
  if (typeof window === "undefined") return false

  const minDimension = Math.min(window.innerWidth, window.innerHeight)
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false
  const noHover = window.matchMedia?.("(hover: none)").matches ?? false

  // Primary: small/narrow viewport
  if (minDimension < threshold) return true

  // Secondary: coarse pointer AND no hover AND not obviously large viewport
  if (coarsePointer && noHover && minDimension < threshold + 80) return true

  return false
}

function readSuppressedUntil(): number | null {
  try {
    const raw = localStorage.getItem(SUPPRESS_KEY)
    if (!raw) return null
    const ts = parseInt(raw, 10)
    return Number.isFinite(ts) ? ts : null
  } catch {
    return null
  }
}

export function useDeviceGate(): DeviceGateState {
  const [phone, setPhone] = React.useState<boolean>(() => isPhoneLike())
  const [suppressedUntil, setSuppressedUntil] = React.useState<number | null>(() => readSuppressedUntil())

  React.useEffect(() => {
    const update = () => setPhone(isPhoneLike())
    update()
    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", update)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("orientationchange", update)
    }
  }, [])

  React.useEffect(() => {
    const id = setInterval(() => {
      // Keep suppressedUntil fresh from storage in case other tabs change it
      setSuppressedUntil(readSuppressedUntil())
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const isSuppressed = !!(suppressedUntil && suppressedUntil > Date.now())
  const shouldShowGate = phone && !isSuppressed

  const suppressForDays = React.useCallback((days: number) => {
    try {
      const until = Date.now() + days * 24 * 60 * 60 * 1000
      localStorage.setItem(SUPPRESS_KEY, String(until))
      setSuppressedUntil(until)
    } catch {
      // ignore storage failure
    }
  }, [])

  const clearSuppression = React.useCallback(() => {
    try {
      localStorage.removeItem(SUPPRESS_KEY)
      setSuppressedUntil(null)
    } catch {
      // ignore
    }
  }, [])

  return {
    isPhoneLikely: phone,
    isSuppressed,
    shouldShowGate,
    suppressForDays,
    clearSuppression,
  }
}


