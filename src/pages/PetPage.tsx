import React, { useState, useEffect } from 'react';
import { useCoins } from '@/pages/coinSystem';
import { ttsService } from '@/lib/tts-service';
import { useTTSSpeaking } from '@/hooks/use-tts-speaking';

type Props = {};

type ActionStatus = 'happy' | 'sad' | 'neutral';

interface ActionButton {
  id: string;
  icon: string;
  status: ActionStatus;
  label: string;
}

export function PetPage({}: Props): JSX.Element {
  // Use shared coin system
  const { coins, spendCoins, hasEnoughCoins, setCoins } = useCoins();
  
  // Pet care system
  const [careLevel, setCareLevel] = useState(0); // 0 to 6 (number of actions performed)
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [previousCoins, setPreviousCoins] = useState(coins);
  const [showPetShop, setShowPetShop] = useState(false);
  const [ownedPets, setOwnedPets] = useState<string[]>(['dog']); // Start with dog
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [lastSpokenMessage, setLastSpokenMessage] = useState('');
  
  // Streak system for dog evolution unlocks - based on consecutive calendar days (US timezone)
  const [currentStreak, setCurrentStreak] = useState(() => {
    try {
      const streakData = localStorage.getItem('pet_feeding_streak_data');
      if (streakData) {
        const parsed = JSON.parse(streakData);
        return Math.max(0, parsed.streak || 0);
      }
      return 0;
    } catch {
      return 0;
    }
  });

  // Get current date in US timezone (Eastern Time)
  const getCurrentUSDate = () => {
    const now = new Date();
    const usDate = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return usDate.toDateString(); // Returns format like "Mon Jan 01 2024"
  };

  // Load and validate streak data
  const getStreakData = () => {
    try {
      const stored = localStorage.getItem('pet_feeding_streak_data');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to parse streak data:', error);
    }
    return { streak: 0, lastFeedDate: null, feedDates: [] };
  };

  // Save streak data to localStorage
  const saveStreakData = (streakData: { streak: number; lastFeedDate: string; feedDates: string[] }) => {
    try {
      localStorage.setItem('pet_feeding_streak_data', JSON.stringify(streakData));
      setCurrentStreak(streakData.streak);
    } catch (error) {
      console.warn('Failed to save streak data:', error);
    }
  };

  // Update streak based on feeding date
  const updateStreak = () => {
    const currentDate = getCurrentUSDate();
    const streakData = getStreakData();
    
    // If already fed today, don't update streak
    if (streakData.lastFeedDate === currentDate) {
      return streakData.streak;
    }

    let newStreak = streakData.streak;
    const feedDates = [...(streakData.feedDates || [])];

    // Add today's date to feed dates
    if (!feedDates.includes(currentDate)) {
      feedDates.push(currentDate);
    }

    // Check if this continues a streak
    if (streakData.lastFeedDate) {
      const lastDate = new Date(streakData.lastFeedDate);
      const today = new Date(currentDate);
      const daysDifference = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDifference === 1) {
        // Consecutive day - increment streak
        newStreak = streakData.streak + 1;
      } else if (daysDifference > 1) {
        // Gap in feeding - reset streak to 1
        newStreak = 1;
      }
      // If daysDifference === 0, it means same day (already handled above)
    } else {
      // First time feeding
      newStreak = 1;
    }

    const newStreakData = {
      streak: newStreak,
      lastFeedDate: currentDate,
      feedDates: feedDates.slice(-30) // Keep last 30 days for performance
    };

    saveStreakData(newStreakData);
    return newStreak;
  };

  // Initialize streak on component mount
  useEffect(() => {
    const streakData = getStreakData();
    if (streakData.lastFeedDate) {
      const currentDate = getCurrentUSDate();
      const lastDate = new Date(streakData.lastFeedDate);
      const today = new Date(currentDate);
      const daysDifference = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // If more than 1 day has passed since last feeding, reset streak
      if (daysDifference > 1) {
        const resetStreakData = {
          streak: 0,
          lastFeedDate: streakData.lastFeedDate,
          feedDates: streakData.feedDates || []
        };
        saveStreakData(resetStreakData);
      }
    }
  }, []);
  
  // TTS message ID for tracking speaking state
  const petMessageId = 'pet-message';
  const isSpeaking = useTTSSpeaking(petMessageId);
  
  // Pet action states
  const [actionStates, setActionStates] = useState<ActionButton[]>([
    { id: 'water', icon: '🍪', status: 'sad', label: 'Food' },
    { id: 'more', icon: '🐾', status: 'neutral', label: 'More' }
  ]);

  const handleActionClick = (actionId: string) => {
    // Don't deduct coins for "More" action - always open pet shop
    if (actionId === 'more') {
      // Stop any current audio when opening pet shop
      ttsService.stop();
      setShowPetShop(true);
      return;
    }

    // Check if player has enough coins for feeding actions
    if (!hasEnoughCoins(10)) {
      alert("Not enough coins! You need 10 coins to perform this action.");
      return;
    }

    // Play feeding sound
    playFeedingSound();

    // Deduct coins and increase care level
    spendCoins(10);
    setCareLevel(prev => Math.min(prev + 1, 6)); // Max 6 actions
    
    // Update streak based on calendar days
    const newStreak = updateStreak();

    // Trigger heart animation
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 1000);

    // Update action status to happy
    setActionStates(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, status: 'happy' }
        : action
    ));
  };

  const getStatusEmoji = (status: ActionStatus) => {
    switch (status) {
      // case 'happy': return '😊';
      // case 'sad': return '😢';
      case 'neutral': return '';
      default: return '';
    }
  };

  // Sound effect functions
  const playFeedingSound = () => {
    try {
      // Create a pleasant "nom nom" eating sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a short, pleasant eating sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Pleasant "crunch" sound frequencies
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.type = 'triangle';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  const playEvolutionSound = () => {
    try {
      // Create a magical "sparkle" evolution sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create multiple tones for a magical effect
      const frequencies = [523, 659, 784, 1047]; // C, E, G, C (major chord)
      
      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + index * 0.1);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + index * 0.1 + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + index * 0.1 + 0.8);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + index * 0.1 + 0.8);
      });
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  const getPetImage = () => {
    // Calculate total coins spent on feeding (10 coins per feeding action)
    const coinsSpentOnFeeding = careLevel * 10;
    
    // Pet images based on coins spent on feeding
    // 0 coins spent: first image, 30+ coins spent: second image, 50+ coins spent: third image
    const currentImage = coinsSpentOnFeeding >= 50 
      ? "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160214_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
      : coinsSpentOnFeeding >= 30 
        ? "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160535_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN"
        : "https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250905_160158_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN";
    
    // Check if pet evolved and play sound based on care level changes
    if (previousCoins !== coins) {
      const previousCareLevel = Math.floor((previousCoins === coins ? careLevel - 1 : careLevel));
      const previousCoinsSpent = Math.max(0, previousCareLevel * 10);
      
      // Play sound when crossing evolution thresholds (spending more coins on feeding)
      if ((previousCoinsSpent < 30 && coinsSpentOnFeeding >= 30) || 
          (previousCoinsSpent < 50 && coinsSpentOnFeeding >= 50)) {
        setTimeout(() => playEvolutionSound(), 400); // Delay to sync with animation
      }
      setPreviousCoins(coins);
    }
    
    return currentImage;
  };

  const handlePetPurchase = (petType: string, cost: number) => {
    if (!hasEnoughCoins(cost)) {
      alert(`Not enough coins! You need ${cost} coins to buy this pet.`);
      return;
    }

    if (ownedPets.includes(petType)) {
      alert("You already own this pet!");
      return;
    }

    // Deduct coins and add pet to owned pets
    spendCoins(cost);
    setOwnedPets(prev => [...prev, petType]);
    
    // Play purchase sound (reuse evolution sound for now)
    playEvolutionSound();
    
    // Special message for Bobo and Feather about arrival time
    if (petType === 'bobo' || petType === 'feather') {
      const petName = petType === 'bobo' ? 'Bobo' : 'Feather';
      alert(`🎉 Congratulations! You bought ${petName}! 🚚 Your new pet will arrive in your pet park within 24 hours!`);
    } else {
      alert(`🎉 Congratulations! You bought a ${petType}!`);
    }
  };

  const availablePets = [
    { id: 'bobo', emoji: '🐵', name: 'Bobo', cost: 60 },
    { id: 'feather', emoji: '🦜', name: 'Feather', cost: 60 }
  ];

  // ElevenLabs Text-to-Speech function using the proper TTS service
  const speakText = async (text: string) => {
    if (!audioEnabled || text === lastSpokenMessage) return;
    
    try {
      // Stop any currently playing audio
      ttsService.stop();
      
      setLastSpokenMessage(text);
      
      // Use the TTS service with a child-friendly voice and appropriate settings
      await ttsService.speak(text, {
        stability: 0.7,
        similarity_boost: 0.8,
        speed: 0.9, // Slightly slower for better comprehension
        messageId: petMessageId,
        voice: 'cgSgspJ2msm6clMCkdW9' // Jessica voice - warm and friendly for children
      });
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  const getPetThought = () => {
    // Calculate total coins spent on feeding (10 coins per feeding action)
    const coinsSpentOnFeeding = careLevel * 10;
    
    // Pet thoughts based on coins spent on feeding
    if (coinsSpentOnFeeding === 0) {
      // No coins spent on feeding yet
      if (coins < 10) {
        return "Hi Callee! I'm April 🐶… my tummy's rumbling! Can you feed me some cookies?";
      } else {
        return "Hi Callee! I'm April 🐶… my tummy's rumbling! Can you feed me some cookies?";
      }
    } else if (coinsSpentOnFeeding < 30) {
      // 10-20 coins spent on feeding (1-2 feedings)
      return "Mmm… yummy! 🍪 More cookies will make me wag my tail even faster!";
    } else if (coinsSpentOnFeeding < 50) {
      // 30-40 coins spent on feeding (3-4 feedings)
      return "Woof woof! I'm growing stronger! 🐶 Keep feeding me - I'm getting bigger!";
    } else {
      // 50+ coins spent on feeding (5+ feedings)
      return "Yippee! 🥳 I feel amazing, Callee! Now… could you get me some friends to play with!";
    }
  };

  // Handle audio playback when message changes
  useEffect(() => {
    const currentMessage = getPetThought();
    
    // Only speak when:
    // 1. Not in pet shop
    // 2. Audio is enabled
    // 3. Message has changed
    // 4. There's no current audio playing
    if (!showPetShop && audioEnabled && currentMessage !== lastSpokenMessage && !isSpeaking) {
      const timer = setTimeout(() => {
        speakText(currentMessage);
      }, 500); // Small delay for smooth UX
      
      return () => clearTimeout(timer);
    }
  }, [coins, careLevel, showPetShop, audioEnabled, lastSpokenMessage, isSpeaking]);

  return (
    <div className="min-h-screen flex flex-col" style={{
      backgroundImage: `url('https://tutor.mathkraft.org/_next/image?url=%2Fapi%2Fproxy%3Furl%3Dhttps%253A%252F%252Fdubeus2fv4wzz.cloudfront.net%252Fimages%252F20250903_181706_image.png&w=3840&q=75&dpl=dpl_2uGXzhZZsLneniBZtsxr7PEabQXN')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      fontFamily: 'Quicksand, system-ui, sans-serif'
    }}>
      {/* Glass overlay for better contrast */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"></div>

      {/* Top UI - Coins and Streak */}
      <div className="absolute top-5 left-1/2 transform -translate-x-1/2 z-20 flex gap-4">
        {/* Coins */}
        <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-3 border border-white/30 shadow-lg">
          <div className="flex items-center gap-2 text-white font-bold text-lg drop-shadow-md">
            <span className="text-xl">🪙</span>
            <span>{coins}</span>
          </div>
        </div>
        
        {/* Streak */}
        <div className="bg-white/20 backdrop-blur-md rounded-xl px-4 py-3 border border-white/30 shadow-lg">
          <div className="flex items-center gap-2 text-white font-bold text-lg drop-shadow-md">
            <span className="text-xl">🔥</span>
            <span>{currentStreak}</span>
          </div>
        </div>
      </div>

      {/* Testing Button - Refill Coins (Development Only) */}
      <div className="absolute bottom-5 left-5 z-20">
        <button
          onClick={() => setCoins(100)}
          className="bg-transparent hover:bg-white/5 px-2 py-1 rounded text-transparent hover:text-white/20 text-xs transition-all duration-300 opacity-5 hover:opacity-30"
          title="Testing: Refill coins to 100"
        >
          🔄
        </button>
      </div>

      {/* Top UI - Heart only */}
      <div className="absolute top-5 right-10 z-20">
        {/* Heart that fills with blood */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center relative bg-white/20 backdrop-blur-sm border-2 border-white/30 shadow-lg">
          <div style={{
            position: 'relative',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Heart outline */}
            <div style={{
              position: 'absolute',
              fontSize: 64,
              color: '#E5E7EB'
            }}>
              🤍
            </div>
            {/* Filled heart (blood) */}
            <div style={{
              position: 'absolute',
              fontSize: 64,
              color: '#DC2626',
              clipPath: `inset(${100 - (careLevel / 6 * 100)}% 0 0 0)`,
              transition: 'clip-path 500ms ease'
            }}>
              ❤️
            </div>
          </div>
        </div>

        {/* Animated hearts moving from pet to main heart */}
        {showHeartAnimation && (
          <>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 20,
              color: '#DC2626',
              animation: 'heartFlyFromPet1 1200ms ease-out forwards',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 16,
              color: '#DC2626',
              animation: 'heartFlyFromPet2 1200ms ease-out forwards',
              animationDelay: '150ms',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              fontSize: 18,
              color: '#DC2626',
              animation: 'heartFlyFromPet3 1200ms ease-out forwards',
              animationDelay: '300ms',
              pointerEvents: 'none',
              zIndex: 30
            }}>
              ❤️
            </div>
          </>
        )}
      </div>

      {/* Main pet area - moved down slightly */}
      <div className="flex-1 flex flex-col items-center justify-center relative pb-20 px-4 z-10 mt-16">
        {/* Pet Thought Bubble - Only show when pet shop is closed, moved down */}
        {!showPetShop && (
          <div className="relative bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl p-5 mb-8 border-3 border-blue-400 shadow-xl max-w-md w-full mx-4 backdrop-blur-sm bg-white/90">
            {/* Speech bubble tail */}
            <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-l-transparent border-r-transparent border-t-blue-400"></div>
            
            {/* Thought bubble dots */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{animationDelay: '0s'}}></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{animationDelay: '0.3s'}}></div>
              <div className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{animationDelay: '0.6s'}}></div>
            </div>

            <div className="text-sm text-slate-800 font-medium leading-relaxed text-center">
              {getPetThought()}
            </div>
          </div>
        )}

        {/* Pet (Custom Image) */}
        <div className="relative drop-shadow-2xl">
          <img 
            src={getPetImage()}
            alt="Pet"
            className="w-80 h-80 object-contain rounded-2xl transition-all duration-700 ease-out hover:scale-105"
            style={{
              animation: careLevel * 10 >= 30 && careLevel * 10 < 50 ? 'petGrow 800ms ease-out' : 
                        careLevel * 10 >= 50 ? 'petEvolve 800ms ease-out' : 'none'
            }}
          />
        </div>
        
        {/* Food bowl */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-20 text-5xl drop-shadow-lg">
          🥣
        </div>
      </div>

      {/* Dog Evolution Display - Right Side */}
      <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-10 flex flex-col gap-4">
        {/* Small Pup - Always available */}
        <div className="flex flex-col items-center">
          <div className="relative p-3 rounded-2xl border-2 transition-all duration-300 bg-gradient-to-br from-blue-100 to-cyan-100 border-blue-400 shadow-lg">
            <div className="text-5xl transition-all duration-300 grayscale-0">
              🐶
            </div>
            <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              ✓
            </div>
          </div>
          <div className="text-xs font-semibold text-center mt-2 text-white drop-shadow-md">
            1 Day 🔥
          </div>
        </div>

        {/* Medium Dog - Unlocks at 2 consecutive days */}
        <div className="flex flex-col items-center">
          <div className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
            currentStreak >= 2 
              ? 'bg-gradient-to-br from-yellow-100 to-orange-100 border-yellow-400 shadow-lg' 
              : 'bg-gray-100 border-gray-300 opacity-60'
          }`}>
            <div className={`text-6xl transition-all duration-300 ${
              currentStreak >= 2 ? 'grayscale-0' : 'grayscale'
            }`}>
              🐕
            </div>
            {currentStreak >= 2 && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                ✓
              </div>
            )}
          </div>
          <div className="text-xs font-semibold text-center mt-2 text-white drop-shadow-md">
            {currentStreak >= 2 ? 'Medium Dog' : '2 Days 🔥'}
          </div>
        </div>

        {/* Large Dog - Unlocks at 3 consecutive days */}
        <div className="flex flex-col items-center">
          <div className={`relative p-4 rounded-2xl border-2 transition-all duration-300 ${
            currentStreak >= 3 
              ? 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-400 shadow-lg' 
              : 'bg-gray-100 border-gray-300 opacity-60'
          }`}>
            <div className={`text-7xl transition-all duration-300 ${
              currentStreak >= 3 ? 'grayscale-0' : 'grayscale'
            }`}>
              🐺
            </div>
            {currentStreak >= 3 && (
              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                ✓
              </div>
            )}
          </div>
          <div className="text-xs font-semibold text-center mt-2 text-white drop-shadow-md">
            {currentStreak >= 3 ? 'Large Dog' : '3 Days 🔥'}
          </div>
        </div>

      </div>

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
        <div className="flex gap-4 px-4 py-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 shadow-xl">
        {actionStates.map((action) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action.id)}
            className="flex flex-col items-center gap-1 p-3 bg-transparent border-none cursor-pointer rounded-xl min-w-16 transition-all duration-200 hover:bg-white/20 hover:-translate-y-1 active:scale-95"
          >
            {/* Status emoji */}
            {getStatusEmoji(action.status) && (
              <div className="absolute -top-2 -right-2 text-lg bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md">
                {getStatusEmoji(action.status)}
              </div>
            )}
            
            {/* Action icon */}
            <div className="text-4xl drop-shadow-lg">
              {action.icon}
            </div>
            
            {/* Action label - small text below */}
            <div className="text-xs font-semibold text-white drop-shadow-md">
              {action.label}
            </div>
            
            {/* Coin cost for Food action */}
            {action.id === 'water' && (
              <div className="text-xs font-semibold text-yellow-300 drop-shadow-md">
                🪙 10
              </div>
            )}
          </button>
        ))}
        </div>
      </div>

      {/* Audio Toggle Button */}
      <button
        onClick={() => {
          setAudioEnabled(!audioEnabled);
          if (isSpeaking) {
            ttsService.stop();
          }
        }}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full border-2 border-white/30 text-2xl flex items-center justify-center shadow-xl z-40 transition-all duration-200 hover:scale-110 active:scale-95 ${
          audioEnabled 
            ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white' 
            : 'bg-gradient-to-br from-red-500 to-red-600 text-white'
        }`}
      >
        {audioEnabled ? '🔊' : '🔇'}
      </button>

      {/* Pet Shop Overlay */}
      {showPetShop && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl p-6 max-w-md w-11/12 max-h-[85vh] overflow-y-auto shadow-2xl relative border-2 border-gray-200">
            {/* Close button */}
            <button
              onClick={() => setShowPetShop(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white border-none cursor-pointer text-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              ×
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                🏪 Pet Shop
              </h2>
              <p className="text-sm text-gray-600 font-medium">
                Adopt new animal friends!
              </p>
            </div>



            {/* Available Pets */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 16
            }}>
              {availablePets.map((pet) => {
                const isOwned = ownedPets.includes(pet.id);
                const canAfford = hasEnoughCoins(pet.cost);
                
                return (
                  <div
                    key={pet.id}
                    style={{
                      background: isOwned 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)',
                      borderRadius: 16,
                      padding: '16px',
                      textAlign: 'center',
                      position: 'relative',
                      cursor: isOwned ? 'default' : canAfford ? 'pointer' : 'not-allowed',
                      transition: 'all 200ms ease',
                      border: '2px solid rgba(255,255,255,0.2)',
                      opacity: isOwned ? 1 : canAfford ? 0.9 : 0.6
                    }}
                    onClick={() => !isOwned && canAfford && handlePetPurchase(pet.id, pet.cost)}
                    onMouseEnter={(e) => {
                      if (!isOwned && canAfford) {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isOwned && canAfford) {
                        e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    {/* Lock overlay for all unowned pets */}
                    {!isOwned && (
                      <div style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 40,
                        height: 40,
                        background: canAfford ? 'rgba(59, 130, 246, 0.9)' : 'rgba(0,0,0,0.7)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        border: '2px solid white',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                      }}>
                        {canAfford ? '💰' : '🔒'}
                      </div>
                    )}

                    {/* Pet emoji */}
                    <div style={{
                      fontSize: 48,
                      marginBottom: 8,
                      filter: isOwned ? 'none' : !canAfford ? 'grayscale(100%) opacity(0.7)' : 'grayscale(50%) opacity(0.9)'
                    }}>
                      {pet.emoji}
                    </div>

                    {/* Pet name */}
                    <h3 style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'white',
                      margin: 0,
                      marginBottom: 6,
                      fontFamily: 'Quicksand, system-ui, sans-serif'
                    }}>
                      {pet.name}
                    </h3>

                    {/* Status/Price */}
                    <div style={{
                      fontSize: 14,
                      color: 'rgba(255,255,255,0.9)',
                      fontWeight: 500
                    }}>
                      {isOwned ? '✅ Owned' : canAfford ? `🪙 ${pet.cost} coins` : `🔒 Need ${pet.cost} coins`}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Current coins display */}
            <div className="text-center p-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl text-white font-semibold text-base shadow-lg">
              💰 Your coins: {coins}
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes petGrow {
            0% {
              opacity: 0.7;
              transform: scale(0.95);
            }
            50% {
              opacity: 0.9;
              transform: scale(1.05);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
          
          @keyframes petEvolve {
            0% {
              opacity: 0.6;
              transform: scale(0.9) rotate(-2deg);
            }
            25% {
              opacity: 0.8;
              transform: scale(1.1) rotate(1deg);
            }
            50% {
              opacity: 0.9;
              transform: scale(0.98) rotate(-0.5deg);
            }
            75% {
              opacity: 0.95;
              transform: scale(1.02) rotate(0.5deg);
            }
            100% {
              opacity: 1;
              transform: scale(1) rotate(0deg);
            }
          }
          
          @keyframes heartbeat {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
          
          @keyframes heartFlyFromPet1 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(200px, -150px) scale(0.8);
              opacity: 0.8;
            }
            100% {
              transform: translate(350px, -280px) scale(0.3);
              opacity: 0;
            }
          }
          
          @keyframes heartFlyFromPet2 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(180px, -120px) scale(0.7);
              opacity: 0.9;
            }
            100% {
              transform: translate(330px, -300px) scale(0.2);
              opacity: 0;
            }
          }
          
          @keyframes heartFlyFromPet3 {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translate(220px, -180px) scale(0.9);
              opacity: 0.7;
            }
            100% {
              transform: translate(370px, -260px) scale(0.4);
              opacity: 0;
            }
          }
          
          @keyframes thoughtBubble {
            0%, 100% {
              transform: scale(1);
              opacity: 0.7;
            }
            50% {
              transform: scale(1.2);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}
