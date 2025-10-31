import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import React, { Suspense, lazy, useEffect, useState } from "react";
import { useCoins } from "@/pages/coinSystem";
import { PetProgressStorage } from "@/lib/pet-progress-storage";
import { stateStoreApi } from "@/lib/state-store-api";
import { useDeviceGate } from "@/hooks/use-device-gate";
import DeviceGateModal from "@/components/DeviceGateModal";
import MediaPermissionModal from "@/components/MediaPermissionModal";
import analytics from "@/lib/analytics";

const AuthScreen = lazy(() => import("@/components/auth/AuthScreen"));
const Index = lazy(() => import("./pages/Index"));
const Welcome = lazy(() => import("./pages/Welcome"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProgressTracking = lazy(() => import("./pages/ProgressTracking"));
const PetPage = lazy(() => import("./pages/PetPage"));

const PageFallback: React.FC = () => (
  <div className="flex h-full min-h-screen items-center justify-center bg-neutral-950 text-white">
    <span className="animate-pulse text-sm tracking-wide opacity-80">Loading experience…</span>
  </div>
);

const queryClient = new QueryClient();

// Dev-only invisible hotspot to add coins quickly while developing
const DevCoinHotspot: React.FC = () => {
  if (!import.meta.env.DEV) return null;
  const { addAdventureCoins } = useCoins();
  return (
    <button
      aria-label="dev-coin-hotspot"
      title="Add 10 coins"
      onClick={() => addAdventureCoins(10, 'food')}
      className="fixed bottom-2 left-2 h-10 w-10 opacity-0 z-[9999] cursor-pointer"
    />
  );
};

// Dev-only invisible hotspot to increment questions done by 1 for selected pet
const DevQuestionHotspot: React.FC = () => {
  if (!import.meta.env.DEV) return null;
  const { user } = useAuth();
  
  const handleIncrementQuestion = async () => {
    try {
      const currentPetId = PetProgressStorage.getCurrentSelectedPet() || 'dog';
      const petType = PetProgressStorage.getPetType(currentPetId) || currentPetId;
      
      if (user?.uid) {
        await stateStoreApi.updateProgressOnQuestionSolved({
          userId: user.uid,
          pet: petType,
          questionsSolved: 1,
          adventureKey: 'house', // Default to house adventure
        });
        console.log(`🔧 Dev: Incremented questions for pet ${petType} by 1`);
      }
    } catch (error) {
      console.warn('Dev tool: Failed to increment questions:', error);
    }
  };

  return (
    <button
      aria-label="dev-question-hotspot"
      title="Increment questions done by 1 for selected pet"
      onClick={handleIncrementQuestion}
      className="fixed top-2 left-2 h-10 w-10 opacity-0 z-[9999] cursor-pointer"
    />
  );
};

// Unified component that seamlessly switches between pet page and adventure
const UnifiedPetAdventureApp = () => {
  const [isInAdventure, setIsInAdventure] = useState(false);
  const [adventureProps, setAdventureProps] = useState<{
    topicId?: string, 
    mode?: 'new' | 'continue', 
    adventureId?: string, 
    adventureType?: string,
    chatHistory?: any[],
    adventureName?: string,
    comicPanels?: any[],
    cachedImages?: any[]
  } | null>(null);

  const { user, userData, loading } = useAuth();
  const { shouldShowGate, suppressForDays } = useDeviceGate();
  const [gateOpen, setGateOpen] = useState<boolean>(false);
  const [showMediaPrompt, setShowMediaPrompt] = useState<boolean>(false);

  React.useEffect(() => {
    setGateOpen(shouldShowGate);
  }, [shouldShowGate]);

  // One-time microphone+camera prompt for new users
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = localStorage.getItem('media_prompt_seen');
      if (!seen) setShowMediaPrompt(true);
    } catch {}
  }, []);

  const handleMediaPromptClose = React.useCallback(() => {
    setShowMediaPrompt(false);
    try { localStorage.setItem('media_prompt_seen', '1'); } catch {}
  }, []);

  const handleContinueAnyway = React.useCallback(() => {
    suppressForDays(3);
    setGateOpen(false);
  }, [suppressForDays]);

  // Adventure handlers that switch modes seamlessly without route changes
  const handleStartAdventure = (
    topicId: string, 
    mode: 'new' | 'continue' = 'new', 
    adventureType: string = 'food',
      continuationContext?: {
        adventureId: string;
        chatHistory?: any[];
        adventureName?: string;
        comicPanels?: any[];
        cachedImages?: any[];
      }
  ) => {
    console.log('🎯 App.tsx: handleStartAdventure called with:', { topicId, mode, adventureType, continuationContext });
    setAdventureProps({ 
      topicId, 
      mode, 
      adventureType,
      ...continuationContext // Spread the continuation context
    });
    setIsInAdventure(true);
  };

  const handleContinueSpecificAdventure = (adventureId: string) => {
    setAdventureProps({ adventureId });
    setIsInAdventure(true);
  };

  const handleBackToPetPage = () => {
    setIsInAdventure(false);
    setAdventureProps(null);
  };

  // If user is authenticated but we're still loading userData, show loading
  if (user && !userData && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading your profile...</div>
      </div>
    );
  }

  // If user needs onboarding (after signup), route to Index. Skip for anonymous users.
  if (user && !user.isAnonymous && userData && (userData.isFirstTime || !userData.username || !userData.age || !userData.grade)) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Index 
          initialAdventureProps={null}
          onBackToPetPage={handleBackToPetPage}
        />
      </Suspense>
    );
  }

  if (isInAdventure) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Index 
          initialAdventureProps={adventureProps}
          onBackToPetPage={handleBackToPetPage}
        />
      </Suspense>
    );
  }

  return (
    <>
      <DeviceGateModal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onContinueAnyway={handleContinueAnyway}
      />
      <MediaPermissionModal
        open={showMediaPrompt}
        onClose={handleMediaPromptClose}
      />
      <Suspense fallback={<PageFallback />}>
        <PetPage 
          onStartAdventure={handleStartAdventure}
          onContinueSpecificAdventure={handleContinueSpecificAdventure}
        />
      </Suspense>
    </>
  );
};

const App = () => {
  useEffect(() => {
    analytics.init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="h-full w-full overflow-y-auto">
            <Toaster />
            <Sonner position="top-left" />
            <DevCoinHotspot />
            <DevQuestionHotspot />
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  {/* Dedicated auth route for signup/login and upgrade linking */}
                  <Route path="/auth" element={<AuthScreen />} />
                  {/* Welcome is now default */}
                  <Route path="/" element={<Welcome />} />
                  {/* Unified pet page and adventure experience moved under /app */}
                  <Route path="/app" element={
                    <AuthGuard>
                      <UnifiedPetAdventureApp />
                    </AuthGuard>
                  } />
                  {/* Keep adventure route for backward compatibility (redirects to /app) */}
                  <Route path="/adventure" element={
                    <AuthGuard>
                      <UnifiedPetAdventureApp />
                    </AuthGuard>
                  } />
                  {/* Progress Tracking Page */}
                  <Route path="/progress" element={
                    <AuthGuard>
                      <ProgressTracking />
                    </AuthGuard>
                  } />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
