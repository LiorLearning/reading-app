import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { playClickSound } from '@/lib/sounds';
import { BookOpen, Mail, Lock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn, isIOSDevice } from '@/lib/utils';
import { getFriendlyAuthError } from '@/lib/firebase-auth-errors';

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, initializeOneTapSignIn, hasGoogleAccount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmailAuth, setShowEmailAuth] = useState(false);

  // Sign in form state
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  // Sign up form state (email + password only)
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: ''
  });

  // Initialize One Tap Sign-in when component mounts
  useEffect(() => {
    // Wait for Google Identity Services to load
    const initOneTap = () => {
      if (window.google) {
        initializeOneTapSignIn();
      } else {
        // Retry after a short delay
        setTimeout(initOneTap, 100);
      }
    };
    
    // Small delay to ensure the script has loaded
    const timer = setTimeout(initOneTap, 500);
    
    return () => clearTimeout(timer);
  }, [initializeOneTapSignIn]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    playClickSound();
    
    try {
      await signInWithGoogle();
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || '/';
      navigate(redirect);
    } catch (error: any) {
      setError(getFriendlyAuthError(error, 'google'));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    // Prevent multiple simultaneous sign-in attempts
    if (loading) {
      return;
    }
    
    setLoading(true);
    setError('');
    playClickSound();
    
    try {
      await signInWithApple();
      // Only navigate if sign-in was successful
      // Don't navigate if user cancelled (popup closed)
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || '/app';
      navigate('/app');
    } catch (error: any) {
      // Don't show error if user cancelled
      if (error.message && error.message.includes('cancelled')) {
        setError('');
      } else {
        setError(getFriendlyAuthError(error, 'apple') || error.message || 'Failed to sign in with Apple');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    playClickSound();

    try {
      await signInWithEmail(signInData.email, signInData.password);
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || '/';
      navigate(redirect);
    } catch (error: any) {
      setError(getFriendlyAuthError(error, 'signin'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    playClickSound();

    try {
      await signUpWithEmail(signUpData.email, signUpData.password);
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect') || '/';
      navigate(redirect);
    } catch (error: any) {
      setError(getFriendlyAuthError(error, 'signup'));
    } finally {
      setLoading(false);
    }
  };

  // Google Icon Component
  const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" className="mr-3">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col justify-center p-4 overflow-y-auto">
      <a href="https://dashboard.readkraft.com/teacher/login" className="fixed top-4 right-4 z-50 bg-white text-gray-800 px-4 py-2 rounded shadow hover:bg-gray-100">Track Progress</a>
      <div className="w-full max-w-md mx-auto my-8">
        {/* App Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-full p-4">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">ReadKraft</h1>
          <p className="text-blue-100">Interactive Reading Adventures</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-white">Log In / Sign Up</CardTitle>
            <CardDescription className="text-center text-blue-100">
              Let's get you started on your reading journey!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-100 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Primary Google Sign-In Button */}
            <Button 
              type="button"
              onClick={handleGoogleSignIn}
              size="lg"
              className="w-full h-14 bg-white text-gray-700 hover:bg-gray-50 border-0 text-lg font-medium shadow-md"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  {hasGoogleAccount ? 'Welcome back! Sign in with Google' : 'Continue with Google'}
                </>
              )}
            </Button>
            
            {hasGoogleAccount && (
              <p className="text-center text-sm text-blue-200">
                We detected you've used Google sign-in before
              </p>
            )}

            {/* Apple Sign-In Button - Only show on iOS/iPad */}
            {isIOSDevice() && (
              <Button 
                type="button"
                onClick={handleAppleSignIn}
                size="lg"
                className="w-full h-14 bg-black text-white hover:bg-gray-900 border-0 text-lg font-medium shadow-md"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Continue with Apple
                  </>
                )}
              </Button>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/20" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-transparent px-3 text-gray-300">or</span>
              </div>
            </div>

            {/* Email Sign-In Toggle */}
            <Button
              onClick={() => {
                setShowEmailAuth(!showEmailAuth);
                playClickSound();
              }}
              variant="ghost"
              className="w-full text-blue-200 hover:text-white hover:bg-white/10"
            >
              <Mail className="mr-2 h-4 w-4" />
              Log in / Sign up with Email
              {showEmailAuth ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-2 h-4 w-4" />
              )}
            </Button>

            {/* Collapsible Email/Password Form */}
            {showEmailAuth && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <Tabs defaultValue="signup" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/10 border border-white/20 rounded-md p-1">
                    <TabsTrigger 
                      value="signin"
                      className="text-sm font-semibold text-blue-100 rounded md:rounded px-3 py-2 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-blue-300"
                    >
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger 
                      value="signup"
                      className="text-sm font-semibold text-blue-100 rounded md:rounded px-3 py-2 transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-blue-300"
                    >
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="signin" className="space-y-4">
                    <form onSubmit={handleEmailSignIn} className="space-y-4">
                      <div className="space-y-3">
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="Email"
                            value={signInData.email}
                            onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                            required
                          />
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="password"
                            placeholder="Password"
                            value={signInData.password}
                            onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                            required
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={loading}
                        aria-busy={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          'Sign In with Email'
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    <form onSubmit={handleEmailSignUp} className="space-y-4">
                      <div className="space-y-3">
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="Email"
                            value={signUpData.email}
                            onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                            required
                          />
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="password"
                            placeholder="Password"
                            value={signUpData.password}
                            onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                            required
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={loading}
                        aria-busy={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Account'
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
