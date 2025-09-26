import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AuthScreen } from './AuthScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  // For authenticated users, always pass through to children
  // The routing logic will handle onboarding vs main app
  return <>{children}</>;
};
