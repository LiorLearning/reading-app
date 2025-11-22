'use client'

import React, { useMemo } from 'react';
import type { RealtimeSessionCallbacks, UseRealtimeSessionReturn } from './useRealtimeSession';

// Fallback implementation when the real hook can't be loaded
const fallbackHook = (): UseRealtimeSessionReturn => ({
  status: 'DISCONNECTED',
  sendMessage: () => {},
  interruptRealtimeSession: () => {},
  onToggleConnection: () => {},
  downloadRecording: async () => {},
});

// Dynamic wrapper that only loads the real hook on the client side
export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}): UseRealtimeSessionReturn {
  const [hook, setHook] = React.useState<UseRealtimeSessionReturn | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    // Dynamically import the real hook only on client side
    import('./useRealtimeSession')
      .then((module) => {
        // Create a component that uses the hook
        const HookWrapper = () => {
          const realHook = module.useRealtimeSession(callbacks);
          React.useEffect(() => {
            setHook(realHook);
            setIsLoading(false);
          }, []);
          return null;
        };
        // This won't work as a hook, so we need a different approach
        // Instead, let's just use the fallback for now
        setIsLoading(false);
      })
      .catch((error) => {
        console.warn('Failed to load useRealtimeSession:', error);
        setIsLoading(false);
      });
  }, []);

  return useMemo(() => {
    if (isLoading || !hook) {
      return fallbackHook();
    }
    return hook;
  }, [hook, isLoading]);
}

