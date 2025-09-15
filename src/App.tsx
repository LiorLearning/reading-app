import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CameraWidget } from "@/components/CameraWidget";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
// Import PetPage and Index for seamless adventure functionality
import { PetPage } from "./pages/PetPage";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const queryClient = new QueryClient();

// Unified component that seamlessly switches between pet page and adventure
const UnifiedPetAdventureApp = () => {
  const [isInAdventure, setIsInAdventure] = useState(false);
  const [adventureProps, setAdventureProps] = useState<{topicId?: string, mode?: 'new' | 'continue', adventureId?: string} | null>(null);

  // Adventure handlers that switch modes seamlessly without route changes
  const handleStartAdventure = (topicId: string, mode: 'new' | 'continue' = 'new') => {
    setAdventureProps({ topicId, mode });
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
          <CameraWidget />
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
