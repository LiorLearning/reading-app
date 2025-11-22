'use client'

import React, { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/use-auth";
import { useCoins } from "@/lib/coinSystem";
import { PetProgressStorage } from "@/lib/pet-progress-storage";
import { stateStoreApi } from "@/lib/state-store-api";
import { useDeviceGate } from "@/hooks/use-device-gate";
import { toast } from "@/hooks/use-toast";
import { checkMicPermissionStatus } from "@/lib/mic-permission";

// Dynamic imports for code splitting - these are large components
const Index = dynamic(() => import("@/components-pages/Index"), {
  loading: () => <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900"><div className="animate-pulse text-white text-xl">Loading adventure...</div></div>,
  ssr: false
});

const PetPage = dynamic(() => import("@/components-pages/PetPage").then(mod => ({ default: mod.PetPage })), {
  loading: () => <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900"><div className="animate-pulse text-white text-xl">Loading...</div></div>,
  ssr: false
});

const DeviceGateModal = dynamic(() => import("@/components/DeviceGateModal"), { ssr: false });
const MediaPermissionModal = dynamic(() => import("@/components/MediaPermissionModal"), { ssr: false });

// Dev-only invisible hotspot to add coins quickly while developing
const DevCoinHotspot: React.FC = () => {
  if (process.env.NODE_ENV !== 'development') return null;
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
  if (process.env.NODE_ENV !== 'development') return null;
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

// Dev-only visible button to shift Firebase time windows by +9h (simulated)
const DevTimeShiftButton: React.FC = () => {
  if (process.env.NODE_ENV !== 'development') return null;
  const { user } = useAuth();

  const onShift = async () => {
    try {
      if (!user?.uid) return;
      await stateStoreApi.devShiftDailyQuestsTime(user.uid, 9);
      toast({ title: "Shifted +9h", description: "Daily windows moved earlier by 9h." });
    } catch (e) {
      toast({ title: "Shift failed", description: "Could not shift time.", variant: "destructive" as any });
    }
  };

  return (
    <button
      aria-label="dev-time-shift"
      title="Time +9h"
      onClick={onShift}
      className="fixed bottom-3 right-3 z-[9999] h-9 px-3 rounded-md bg-black/80 text-white text-xs shadow-md"
    >
      ⏩ +9h
    </button>
  );
};

// Unified component that seamlessly switches between pet page and adventure
export const UnifiedPetAdventureApp = () => {
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
  // Skip if microphone permission already exists
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkAndShowModal = async () => {
      try {
        const seen = localStorage.getItem('media_prompt_seen');
        if (seen) return; // Already shown before
        
        // Check if microphone permission is already granted
        const micGranted = await checkMicPermissionStatus();
        if (micGranted) {
          // Permission already exists, mark as seen and don't show modal
          localStorage.setItem('media_prompt_seen', '1');
          return;
        }
        
        // Permission not granted, show modal
        setShowMediaPrompt(true);
      } catch {
        // On error, show modal to be safe
        setShowMediaPrompt(true);
      }
    };
    
    checkAndShowModal();
  }, []);

  const handleMediaPromptClose = React.useCallback(() => {
    setShowMediaPrompt(false);
    try { localStorage.setItem('media_prompt_seen', '1'); } catch {}
  }, []);

  const handleMediaEnabled = React.useCallback((result: { micGranted: boolean; camGranted: boolean }) => {
    // If microphone permission was granted, mark it so we don't show the modal again
    if (result.micGranted) {
      try {
        localStorage.setItem('media_prompt_seen', '1');
        // Also store that permission was actually granted (not just seen)
        localStorage.setItem('media_permission_granted', '1');
      } catch {}
    }
    setShowMediaPrompt(false);
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
      <>
        <DevCoinHotspot />
        <DevQuestionHotspot />
        <DevTimeShiftButton />
        <Index 
          initialAdventureProps={null}
          onBackToPetPage={handleBackToPetPage}
        />
      </>
    );
  }

  if (isInAdventure) {
    return (
      <>
        <DevCoinHotspot />
        <DevQuestionHotspot />
        <DevTimeShiftButton />
        <Index 
          initialAdventureProps={adventureProps}
          onBackToPetPage={handleBackToPetPage}
        />
      </>
    );
  }

  return (
    <>
      <DevCoinHotspot />
      <DevQuestionHotspot />
      <DevTimeShiftButton />
      <DeviceGateModal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onContinueAnyway={handleContinueAnyway}
      />
      <MediaPermissionModal
        open={showMediaPrompt}
        onClose={handleMediaPromptClose}
        onEnabled={handleMediaEnabled}
      />
      <PetPage 
        onStartAdventure={handleStartAdventure}
        onContinueSpecificAdventure={handleContinueSpecificAdventure}
      />
    </>
  );
};
