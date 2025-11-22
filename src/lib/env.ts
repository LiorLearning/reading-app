// Helper to get environment variables that work in both Vite and Next.js
export function getEnv(key: string): string {
  if (typeof window === 'undefined') {
    // Server-side (Next.js)
    return process.env[key] || process.env[`NEXT_PUBLIC_${key.replace('VITE_', '')}`] || '';
  } else {
    // Client-side
    // Try Next.js format first
    if (process.env[`NEXT_PUBLIC_${key.replace('VITE_', '')}`]) {
      return process.env[`NEXT_PUBLIC_${key.replace('VITE_', '')}`] || '';
    }
    // Fallback to Vite format (for compatibility)
    if ((import.meta as any).env?.[key]) {
      return (import.meta as any).env[key];
    }
    // Try process.env (Next.js)
    return process.env[key] || '';
  }
}

// Check if we're in development mode
export function isDev(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'development';
  }
  return process.env.NODE_ENV === 'development' || (import.meta as any).env?.DEV === true;
}
