import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error);
    console.error('🚨 Error Info:', errorInfo);
    
    // Log additional context for debugging
    console.error('🚨 User Agent:', navigator.userAgent);
    console.error('🚨 Is Incognito/Private Mode:', this.isIncognitoMode());
    console.error('🚨 Local Storage Available:', this.isLocalStorageAvailable());
    console.error('🚨 Session Storage Available:', this.isSessionStorageAvailable());
    
    this.setState({
      error,
      errorInfo
    });
  }

  isIncognitoMode(): boolean {
    try {
      // Try to detect incognito mode using various methods
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        return false; // This is a simplistic check
      }
      return false;
    } catch (e) {
      return true;
    }
  }

  isLocalStorageAvailable(): boolean {
    try {
      const test = '__test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  isSessionStorageAvailable(): boolean {
    try {
      const test = '__test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-8 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">🚨 Something went wrong</h2>
            <p className="text-red-100 mb-4">
              The app encountered an unexpected error. This might be due to browser privacy settings.
            </p>
            
            <details className="mb-4">
              <summary className="text-white cursor-pointer hover:text-red-200">
                Technical Details (Click to expand)
              </summary>
              <div className="mt-2 text-sm text-red-200 bg-black/20 p-4 rounded overflow-auto">
                <p><strong>Error:</strong> {this.state.error?.message}</p>
                <p><strong>Incognito Mode:</strong> {this.isIncognitoMode() ? 'Likely' : 'Unlikely'}</p>
                <p><strong>LocalStorage:</strong> {this.isLocalStorageAvailable() ? 'Available' : 'Blocked'}</p>
                <p><strong>SessionStorage:</strong> {this.isSessionStorageAvailable() ? 'Available' : 'Blocked'}</p>
                {this.state.error?.stack && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            </details>

            <div className="space-y-2">
              <button 
                onClick={this.handleReload}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
              >
                Reload App
              </button>
              <p className="text-sm text-red-200 text-center">
                If this persists, try using regular browsing mode instead of incognito/private mode.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
