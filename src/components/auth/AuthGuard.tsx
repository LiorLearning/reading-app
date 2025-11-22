import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AuthScreen } from './AuthScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  // SSR-safe: Only use auth on client side
  let authResult: ReturnType<typeof useAuth>;
  try {
    authResult = useAuth();
  } catch (error) {
    // During SSR/prerendering, AuthProvider may not be available
    // Return loading state to prevent errors
    if (typeof window === 'undefined') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      );
    }
    throw error;
  }
  const { user, userData, loading } = authResult;
  let previouslySignedIn = false;
  try {
    previouslySignedIn = typeof window !== 'undefined' && (localStorage.getItem('previouslysignedin') === '1');
  } catch {}

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // If the device has a history of signing in with a real account,
  // prefer showing the dedicated auth screen instead of auto-onboarding
  if ((!user || user.isAnonymous) && previouslySignedIn) {
    return <AuthScreen />;
  }

  // If no user (and no previous sign-in), allow anon bootstrap to proceed to normal flow
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Preparing your adventure...</div>
      </div>
    );
  }

  // For authenticated users, always pass through to children
  // The routing logic will handle onboarding vs main app
  return <>{children}</>;
};
