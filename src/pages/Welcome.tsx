import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserPlus, LogIn, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { playClickSound } from '@/lib/sounds';

// Simple landing screen that matches the app's playful theme
const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const previouslySignedIn = typeof window !== 'undefined' ? (localStorage.getItem('previouslysignedin') === '1') : false;
  const isAuthenticated = !!user && !user.isAnonymous;
  const showSplash = (loading && previouslySignedIn) || isAuthenticated;

  // If already authenticated (non-anonymous), skip selection and go to the app directly
  useEffect(() => {
    if (loading) return;
    if (user && !user.isAnonymous) {
      navigate('/app', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleNewUser = async () => {
    playClickSound();
    try {
      // Ensure any previous session/log-in state does not force auth screen
      try { localStorage.setItem('previouslysignedin', '0'); } catch {}
      // If a non-anonymous user is logged in, sign them out to start fresh
      if (user && !user.isAnonymous) {
        try { await signOut(); } catch {}
      }
    } finally {
      navigate('/app'); // unified app entry
    }
  };

  const handleExistingUser = () => {
    playClickSound();
    navigate('/auth?redirect=/app');
  };

  const teacherDashboardUrl = 'https://dashboard.readkraft.com/teacher/login';

  if (showSplash) {
    return (
      <main className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-white text-xl animate-pulse">
          <img src="/avatars/krafty.png" alt="Krafty" className="h-10 w-10 object-contain" />
          Getting your pet ready...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none select-none opacity-25">
        <img src="/backgrounds/space.png" alt="decor" className="w-full h-full object-cover" />
      </div>
      <Card className="relative z-10 w-full max-w-3xl bg-white/95 backdrop-blur text-gray-900 border-2 border-[#0B0B0B] rounded-3xl shadow-[0_12px_0_#0B0B0B]">
        <CardHeader className="text-center pt-10">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/avatars/krafty.png" alt="Krafty" className="h-14 w-14 object-contain" />
            <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'Fredoka, sniglet, "Comic Sans MS", system-ui, -apple-system, sans-serif' }}>
              Welcome to Pet Academy
            </CardTitle>
          </div>
          <CardDescription className="text-base">
            Choose how you want to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={handleNewUser}
              className="h-16 text-lg font-bold rounded-2xl border-[3px] border-[#0B0B0B] bg-green-500 hover:bg-green-600 text-white shadow-[0_6px_0_#0B0B0B] btn-animate flex items-center justify-center gap-3"
            >
              <Sparkles className="h-5 w-5" />
              New User
            </Button>
            <Button
              onClick={handleExistingUser}
              className="h-16 text-lg font-bold rounded-2xl border-[3px] border-[#0B0B0B] bg-blue-500 hover:bg-blue-600 text-white shadow-[0_6px_0_#0B0B0B] btn-animate flex items-center justify-center gap-3"
            >
              <LogIn className="h-5 w-5" />
              Existing User or A School
            </Button>
            <a
              href={teacherDashboardUrl}
              className="h-16 text-lg font-bold rounded-2xl border-[3px] border-[#0B0B0B] bg-yellow-400 hover:bg-yellow-500 text-[#0B0B0B] shadow-[0_6px_0_#0B0B0B] btn-animate flex items-center justify-center gap-3"
              style={{ display: 'flex' }}
            >
              <GraduationCap className="h-5 w-5" />
              Teacher Dashboard
            </a>
          </div>
          <p className="text-center text-sm text-gray-600 mt-6">Join your pet on their next big quest!</p>
        </CardContent>
      </Card>
    </main>
  );
};

export default Welcome;


