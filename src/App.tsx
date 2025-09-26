import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { ProgressTracking } from "./pages/ProgressTracking";
// Import PetPage and Index for seamless adventure functionality
import { PetPage } from "./pages/PetPage";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCoins } from "@/pages/coinSystem";

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

  // If user needs onboarding (first time or missing grade), route to Index for proper onboarding flow
  if (userData && (userData.isFirstTime || !userData.grade)) {
    return (
      <Index 
        initialAdventureProps={null}
        onBackToPetPage={handleBackToPetPage}
      />
    );
  }

  if (isInAdventure) {
    return (
      <Index 
        initialAdventureProps={adventureProps}
        onBackToPetPage={handleBackToPetPage}
      />
    );
  }

  return (
    <PetPage 
      onStartAdventure={handleStartAdventure}
      onContinueSpecificAdventure={handleContinueSpecificAdventure}
    />
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <div className="h-full w-full overflow-hidden">
          <Toaster />
          <Sonner />
          <DevCoinHotspot />
          <BrowserRouter>
            <Routes>
              {/* Unified pet page and adventure experience */}
              <Route path="/" element={
                <AuthGuard>
                  <UnifiedPetAdventureApp />
                </AuthGuard>
              } />
              {/* Keep adventure route for backward compatibility (redirects to home) */}
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
          </BrowserRouter>
        </div>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
