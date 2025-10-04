import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ChatAvatar from '@/components/comic/ChatAvatar';
import { ttsService } from '@/lib/tts-service';
import { Volume2 } from 'lucide-react';

interface PetOption {
  id: string;
  name: string;
  emoji: string;
  imageUrl?: string;
  description: string;
  defaultNames: string[];
}

interface PetSelectionFlowProps {
  onPetSelected: (petId: string, petName: string) => void;
  userName?: string;
  // Dev-only overrides to force a step for testing on PetPage
  devForceStep?: 'selection' | 'naming' | 'dailyIntro';
  devForcePetId?: string;
}

const PET_OPTIONS: PetOption[] = [
  {
    id: 'dog',
    name: 'Dog',
    emoji: '🐕',
    imageUrl: 'https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250906_000902_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN',
    description: '',
    defaultNames: ['Buddy', 'Max', 'Luna', 'Charlie', 'Bella']
  },
  {
    id: 'cat',
    name: 'Cat',
    emoji: '🐱',
    imageUrl: 'https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250909_234441_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN',
    description: '',
    defaultNames: ['Whiskers', 'Shadow', 'Mittens', 'Felix', 'Cleo']
  },
  {
    id: 'hamster',
    name: 'Hamster',
    emoji: '🐹',
    imageUrl: 'https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250915_163423_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN',
    description: '',
    defaultNames: ['Peanut', 'Nibbles', 'Squeaky', 'Hazel', 'Pip']
  }
];

export function PetSelectionFlow({ onPetSelected, userName, devForceStep, devForcePetId }: PetSelectionFlowProps) {
  const [step, setStep] = useState<'selection' | 'naming' | 'dailyIntro'>('selection');
  const [selectedPet, setSelectedPet] = useState<PetOption | null>(null);
  const [petName, setPetName] = useState('');
  const hasSpokenRef = useRef(false);
  const hasNamingSpokenRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const welcomeText = `Welcome to Pet Academy! I’m Krafty, and I’ll help you become the best Pet Master ever. First, let's choose a pet!`;
  const namingText = selectedPet ? `Awesome, what would you like to call your ${selectedPet.name.toLowerCase()}?` : '';
  const dailyIntroText = `It’s important to check up on your pets daily! Let’s check how your pet is feeling right now!`;

  // Auto-play TTS once when entering the selection step
  useEffect(() => {
    if (step === 'selection' && !hasSpokenRef.current) {
      try { ttsService.speakAIMessage(welcomeText, 'krafty-pet-select'); } catch {}
      hasSpokenRef.current = true;
    }
    return () => {
      try { ttsService.stop(); } catch {}
    };
  }, [step]);

  // Track speaking state for toggle UI
  useEffect(() => {
    const listener = (messageId: string | null) => setSpeakingMessageId(messageId);
    try { ttsService.addSpeakingStateListener(listener); } catch {}
    return () => { try { ttsService.removeSpeakingStateListener(listener); } catch {} };
  }, []);

  // Auto-play TTS once when entering the naming step; focus input to show caret
  useEffect(() => {
    if (step === 'naming' && selectedPet && !hasNamingSpokenRef.current) {
      const timer = setTimeout(() => {
        try { ttsService.speakAIMessage(namingText, 'krafty-pet-naming'); } catch {}
      }, 200);
      // focus input and move caret to end so the blinking caret is visible
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          const val = el.value; // move caret to end
          el.value = '';
          el.value = val;
        }
      });
      hasNamingSpokenRef.current = true;
      return () => { clearTimeout(timer); try { ttsService.stop(); } catch {} };
    }
  }, [step, selectedPet, namingText]);

  // Dev-only: allow parent to force a specific step (useful for quick testing)
  useEffect(() => {
    if ((import.meta as any)?.env?.DEV && devForceStep) {
      if (devForceStep === 'naming' || devForceStep === 'dailyIntro') {
        const petId = devForcePetId || PET_OPTIONS[0]?.id;
        const pet = PET_OPTIONS.find(p => p.id === petId) || PET_OPTIONS[0] || null;
        if (pet) {
          setSelectedPet(pet);
          setPetName(pet.defaultNames[0] || '');
          setStep(devForceStep === 'dailyIntro' ? 'dailyIntro' : 'naming');
        }
      } else if (devForceStep === 'selection') {
        setSelectedPet(null);
        setPetName('');
        setStep('selection');
      }
    }
  }, [devForceStep, devForcePetId]);

  const handlePetChoice = (pet: PetOption) => {
    setSelectedPet(pet);
    setPetName(pet.defaultNames[0]); // Set first default name
    setStep('naming');
  };

  const handleNameSubmit = () => {
    if (selectedPet && petName.trim()) {
      // Move to step 3 (daily intro) instead of finishing immediately
      setStep('dailyIntro');
      try { ttsService.stop(); } catch {}
      setTimeout(() => { try { ttsService.speakAIMessage(dailyIntroText, 'krafty-daily-intro'); } catch {} }, 150);
    }
  };

  const handleSampleNameClick = (name: string) => {
    setPetName(name);
  };

  if (step === 'selection') {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-kids">
        {/* Krafty assistant outside the modal, bottom-left */}
        <div className="absolute left-4 bottom-4 z-10 flex items-start gap-5">
          <div className="shrink-0 rounded-full border-4 border-primary/30 bg-gradient-to-b from-muted/60 to-background p-1.5">
            <div className="h-24 w-24 rounded-full overflow-hidden">
              <ChatAvatar size="responsive" />
            </div>
          </div>
          <div className="max-w-2xl">
            <div className="bg-card border rounded-2xl px-7 py-6 flex items-start gap-4 shadow-md">
              <p className="flex-1 text-base sm:text-lg md:text-xl leading-relaxed font-kids">
                {welcomeText}
              </p>
              <Button aria-label="Play message" variant="ghost" size="icon" className="h-10 w-10 text-primary" onClick={() => {
                try { ttsService.speakAIMessage(welcomeText, 'krafty-pet-select'); } catch {}
              }}>
                <Volume2 className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Center modal with header and pet cards */}
        <Card className="relative w-full max-w-3xl bg-card/90 backdrop-blur text-card-foreground overflow-hidden border border-border shadow-2xl ring-1 ring-primary/10 font-kids">
          {/* Modal-only decorative background */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <img src="/backgrounds/space.png" alt="decorative background" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-primary/5" />
          </div>
          <div className="px-8 pt-8 pb-4 text-center">
            <h2 className="text-3xl font-extrabold tracking-wide drop-shadow-sm">Choose your pet</h2>
            <p className="mt-2 text-muted-foreground"></p>
          </div>
          <CardContent className="pt-2 pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6" role="radiogroup" aria-label="Choose your pet">
              {PET_OPTIONS.map((pet) => (
                <Card
                  key={pet.id}
                  className="group cursor-pointer border border-border bg-card rounded-2xl shadow-2xl hover:shadow-[0_20px_60px_rgba(0,0,0,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 focus-visible:ring-offset-2 h-72 font-kids"
                  onClick={() => handlePetChoice(pet)}
                >
                  <CardContent className="p-6 text-center h-full flex flex-col justify-center" role="radio" aria-checked={false} aria-label={pet.name}>
                    <div className="mb-4 mx-auto aspect-square w-24 sm:w-28 md:w-32 rounded-xl overflow-hidden">
                      {pet.imageUrl ? (
                        <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105 drop-shadow-md" />
                      ) : (
                        <div className="text-6xl">{pet.emoji}</div>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-card-foreground mb-1 font-kids">{pet.name}</h3>
                    <p className="text-sm text-muted-foreground font-kids">{pet.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'naming' && selectedPet) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-kids">
        {/* Krafty assistant bottom-left with auto-spoken prompt */}
        <div className="absolute left-4 bottom-4 z-10 flex items-start gap-5">
          <div className="shrink-0 rounded-full border-4 border-primary/30 bg-gradient-to-b from-muted/60 to-background p-1.5">
            <div className="h-24 w-24 rounded-full overflow-hidden">
              <ChatAvatar size="responsive" />
            </div>
          </div>
          <div className="max-w-2xl">
            <div className="bg-card border rounded-2xl px-7 py-6 flex items-start gap-4 shadow-md">
              <p className="flex-1 text-base sm:text-lg md:text-xl leading-relaxed font-kids">
                {namingText}
              </p>
              <Button
                aria-label={speakingMessageId === 'krafty-pet-naming' ? 'Pause message' : 'Play message'}
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-primary"
                onClick={() => {
                  try {
                    if (speakingMessageId === 'krafty-pet-naming') {
                      ttsService.stop();
                    } else {
                      ttsService.speakAIMessage(namingText, 'krafty-pet-naming');
                    }
                  } catch {}
                }}
              >
                <Volume2 className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Minimal naming modal: image + input + suggestion chips */}
        <Card className="relative w-full max-w-md bg-card/90 backdrop-blur text-card-foreground overflow-hidden border border-border shadow-2xl ring-1 ring-primary/10 font-kids">
          <CardContent className="pt-8 space-y-6">
            <div className="mx-auto aspect-square w-24 sm:w-28 md:w-32 rounded-xl overflow-hidden">
              {selectedPet.imageUrl ? (
                <img src={selectedPet.imageUrl} alt={selectedPet.name} className="w-full h-full object-contain" />
              ) : (
                <div className="text-6xl text-center">{selectedPet.emoji}</div>
              )}
            </div>

            <div>
              <Input
                ref={inputRef}
                type="text"
                value={petName}
                onChange={(e) => { try { ttsService.stop(); } catch {}; setPetName(e.target.value); }}
                className="text-center text-lg font-medium caret-primary border-input focus-visible:ring-primary focus-visible:ring-offset-2 focus:border-primary"
                maxLength={20}
                autoFocus
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {selectedPet.defaultNames.map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSampleNameClick(name)}
                  className={`${petName === name ? 'bg-destructive text-destructive-foreground border-destructive shadow-sm' : 'border-primary/30 text-primary hover:bg-primary/5'}`}
                >
                  {name}
                </Button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { try { ttsService.stop(); } catch {}; setStep('selection'); hasNamingSpokenRef.current = false; }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleNameSubmit}
                disabled={!petName.trim()}
                variant="default"
                className="flex-1"
              >
                Choose {petName || 'Pet'}!
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Daily check intro with Krafty; Next finalizes selection
  if (step === 'dailyIntro' && selectedPet) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 p-4 font-kids">
        <div className="absolute left-4 bottom-4 z-10 flex items-start gap-5">
          <div className="shrink-0 rounded-full border-4 border-destructive/60 bg-gradient-to-b from-muted/60 to-background p-1.5">
            <div className="h-24 w-24 rounded-full overflow-hidden">
              <ChatAvatar size="responsive" />
            </div>
          </div>
          <div className="max-w-2xl">
            <div className="bg-card border-2 border-destructive/60 rounded-2xl px-7 py-6 flex items-center gap-4 shadow-sm">
              <p className="flex-1 text-base sm:text-lg md:text-xl leading-relaxed font-kids">
                {dailyIntroText}
              </p>
              <Button
                className="px-5"
                onClick={() => {
                  try { ttsService.stop(); } catch {}
                  onPetSelected(selectedPet.id, petName.trim());
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
