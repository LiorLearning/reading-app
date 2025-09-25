import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AuthScreen } from './AuthScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, userData, loading } = useAuth();

  // Add timeout for loading state to prevent infinite loading in incognito mode
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn('🚨 Auth loading timeout - possible incognito mode issue');
        setLoadingTimeout(true);
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-8 max-w-md mx-auto text-center">
          <div className="text-white text-xl mb-4">⚠️ Loading Issue Detected</div>
          <p className="text-blue-100 mb-4">
            The app is taking longer than usual to load. This might be due to browser privacy settings or incognito mode.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Reload App
          </button>
          <p className="text-sm text-blue-200 mt-4">
            Try using regular browsing mode if the issue persists.
          </p>
        </div>
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
