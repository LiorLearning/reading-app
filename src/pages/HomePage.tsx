import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { playClickSound } from "@/lib/sounds";
import { Sparkles, Plus, Rocket } from "lucide-react";
import { loadUserProgress, getNextTopic, hasUserProgress, UserProgress, loadAdventureSummaries, AdventureSummary } from "@/lib/utils";
import { loadAdventureSummariesHybrid } from "@/lib/firebase-adventure-cache";
import { sampleMCQData } from "../data/mcq-questions";
import { useAuth } from "@/hooks/use-auth";

interface UserData {
  username: string;
  grade: string;
  gradeDisplayName: string;
  level: string;
  levelDisplayName: string;
  isFirstTime: boolean;
}

interface HomePageProps {
  userData: UserData;
  onNavigate: (path: 'start' | 'middle' | 'topics') => void;
  onStartAdventure: (topicId: string, mode: 'new' | 'continue') => void;
  onContinueSpecificAdventure?: (adventureId: string) => void;
  selectedTopicFromPreference?: string | null;
}

// Sample adventure data template
const userAdventureTemplate = {
  id: "current-adventure",
  pages: "16 pages",
  image: "/lovable-uploads/d7e6abca-63c5-44c6-ad2b-3b7f0715a215.png",
  badge: "Publish Story",
  badgeColor: "bg-green-500"
};

// Top picks data
const topPicks = [
  {
    id: "stella-tiny-frog", 
    title: "Stella and the Tiny Frog",
    author: "by Irene, 2nd grade",
    pages: "12 pages",
    image: "/stories/stella-tiny-frog.jpg",
    badge: "Best Friend!",
    badgeColor: "bg-orange-500"
  },
  {
    id: "captain-asher-time-stranglers",
    title: "Captain Asher and the Time Stranglers",
    author: "by Asher Elliman, 3rd grade",
    pages: "16 pages", 
    image: "/stories/captain-asher-time-stranglers.jpg",
    badge: "Top Pick!",
    badgeColor: "bg-yellow-500"
  }
];

const HomePage: React.FC<HomePageProps> = ({ userData, onNavigate, onStartAdventure, onContinueSpecificAdventure, selectedTopicFromPreference }) => {
  // Get Firebase authenticated user
  const { user } = useAuth();
  
  // Progress tracking state
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [nextTopicId, setNextTopicId] = useState<string | null>(null);
  const [savedAdventures, setSavedAdventures] = useState<AdventureSummary[]>([]);
  
  // Load user progress and saved adventures on component mount
  useEffect(() => {
    const progress = loadUserProgress();
    setUserProgress(progress);
    
    // Get all available topic IDs from MCQ data
    const allTopicIds = Object.keys(sampleMCQData.topics);
    const nextTopic = getNextTopic(allTopicIds);
    setNextTopicId(nextTopic);
  }, [userData]);

  useEffect(() => {
    if (user) {
      refreshSavedAdventures();
    } else {
      // Load from localStorage as fallback when not authenticated
      const adventures = loadAdventureSummaries();
      setSavedAdventures(adventures);
    }
  }, [user]);

  // Function to refresh saved adventures (call this from parent when new adventure is saved)
  const refreshSavedAdventures = async () => {
    const adventures = await loadAdventureSummariesHybrid(user?.uid || null);
    setSavedAdventures(adventures);
  };

  // Expose refresh function to parent component via ref or callback
  React.useEffect(() => {
    // Set up a polling mechanism to check for new adventures and progress updates
    const interval = setInterval(async () => {
      if (user) {
        const currentAdventures = await loadAdventureSummariesHybrid(user.uid);
        if (currentAdventures.length !== savedAdventures.length) {
          setSavedAdventures(currentAdventures);
        }
      }
      
      // Also refresh user progress to get immediate updates
      const currentProgress = loadUserProgress();
      const currentNextTopic = getNextTopic(Object.keys(sampleMCQData.topics));
      if (currentProgress && (currentProgress.totalTopicsCompleted !== userProgress?.totalTopicsCompleted || currentNextTopic !== nextTopicId)) {
        setUserProgress(currentProgress);
        setNextTopicId(currentNextTopic);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [savedAdventures.length, userProgress?.totalTopicsCompleted, nextTopicId]);
  
  const handleCreateNewStory = () => {
    playClickSound();
    onNavigate('topics');
  };

  const handleContinueAdventure = (adventureId: string) => {
    playClickSound();
    if (onContinueSpecificAdventure) {
      onContinueSpecificAdventure(adventureId);
    } else {
      // Fallback to continue mode with next topic
      if (nextTopicId) {
        onStartAdventure(nextTopicId, 'continue');
      }
    }
  };

  const handleTopPick = (adventureId: string) => {
    playClickSound();
    // Navigate to specific adventure 
    onNavigate('topics');
  };

  const handleStartAdventure = (mode: 'new' | 'continue') => {
    playClickSound();
    
    // Prioritize selected topic from preference, fallback to default next topic
    const topicToUse = selectedTopicFromPreference || nextTopicId;
    
    if (topicToUse) {
      onStartAdventure(topicToUse, mode);
    }
  };



  // Create user adventure with current user data
  const currentUserAdventure = {
    ...userAdventureTemplate,
    title: `${userData.username} and the Time Stranglers`,
    author: `by ${userData.username} Elliman, ${userData.gradeDisplayName}`
  };

  return (
    <main 
      className="flex-1 flex flex-col min-h-0 overflow-auto px-4 py-6 lg:px-8"
      style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 50%, #fdf2f8 100%)'
      }}
    >
      {/* Main Content Container */}
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        {/* Adventure Buttons Section - Only show if user has progress or can start a topic */}
        {nextTopicId && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🚀</span>
              <h2 className="text-2xl font-bold text-gray-800">
                Your Adventure Awaits
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Start New Adventure Button - spans full width on mobile, single column on larger screens */}
              <div 
                onClick={() => handleStartAdventure('new')}
                className="group cursor-pointer md:col-span-2"
              >
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-8 text-white text-center hover:from-purple-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 hover:shadow-xl"
                     style={{ minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="mb-4">
                    <Plus className="h-12 w-12 mx-auto mb-3" />
                    <Sparkles className="h-6 w-6 mx-auto" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">
                    START NEW ADVENTURE
                  </h3>
                  <p className="text-purple-100 text-sm mb-1">
                    Begin a fresh new adventure
                  </p>
                  {selectedTopicFromPreference ? (
                    <p className="text-purple-200 text-xs">
                      Ready to start with topic: {selectedTopicFromPreference} ✨
                    </p>
                  ) : (
                    <p className="text-purple-200 text-xs">
                      Ready to start your next topic!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
        


        {/* Your Adventures Section */}
        {savedAdventures.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🎯</span>
              <h2 className="text-2xl font-bold text-gray-800">Your Adventures</h2>
              <span className="bg-primary text-primary-foreground px-2 py-1 rounded-full text-sm font-medium">
                {savedAdventures.length}
              </span>
              {userProgress && userProgress.totalTopicsCompleted > 0 && (
                <span className="bg-emerald-500 text-white px-2 py-1 rounded-full text-sm font-medium ml-2">
                  {userProgress.totalTopicsCompleted} topics mastered ⭐
                </span>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-2" style={{ minWidth: 'max-content' }}>
                {/* Create New Story Card - positioned first on the left */}
                <div className="flex-shrink-0" style={{ width: '280px' }}>
                  <div 
                    onClick={handleCreateNewStory}
                    className="group cursor-pointer h-full"
                  >
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border-2 border-purple-400 h-full flex flex-col">
                      <div className="aspect-video relative flex items-center justify-center">
                        <div className="text-white text-6xl mb-2">✨</div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-center text-center">
                        <h3 className="font-bold text-xl text-white mb-2">
                          Create New Story
                        </h3>
                        <p className="text-purple-100 text-sm">
                          Start your adventure
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Adventures */}
                {savedAdventures.slice().reverse().map((adventure) => { // Reverse to show newest first
                // Get adventure theme emoji based on name
                const getAdventureEmoji = (name: string) => {
                  const lowerName = name.toLowerCase();
                  if (lowerName.includes('space')) return '🚀';
                  if (lowerName.includes('magic')) return '🪄';
                  if (lowerName.includes('dragon')) return '🐉';
                  if (lowerName.includes('superhero')) return '🦸';
                  if (lowerName.includes('ocean')) return '🌊';
                  if (lowerName.includes('forest')) return '🌲';
                  if (lowerName.includes('castle')) return '🏰';
                  if (lowerName.includes('robot')) return '🤖';
                  if (lowerName.includes('ninja')) return '🥷';
                  if (lowerName.includes('pirate')) return '🏴‍☠️';
                  return '🎭'; // Default adventure emoji
                };

                const formatDate = (timestamp: number) => {
                  const date = new Date(timestamp);
                  const now = new Date();
                  const diffMs = now.getTime() - date.getTime();
                  const diffHours = diffMs / (1000 * 60 * 60);
                  
                  if (diffHours < 24) {
                    return 'Today';
                  } else if (diffHours < 48) {
                    return 'Yesterday';
                  } else {
                    return date.toLocaleDateString();
                  }
                };

                return (
                  <div 
                    key={adventure.id}
                    onClick={() => handleContinueAdventure(adventure.id)}
                    className="group cursor-pointer flex-shrink-0"
                    style={{ width: '280px' }}
                  >
                    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border-2 border-gray-200 h-full">
                      {adventure.comicPanelImage ? (
                        <div className="aspect-video relative">
                          <img 
                            src={adventure.comicPanelImage} 
                            alt={adventure.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/20"></div>
                          <div className="absolute top-3 left-3">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-2">
                              <span className="text-2xl">{getAdventureEmoji(adventure.name)}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-500 relative">
                          <div className="absolute inset-0 bg-black/20"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-white text-4xl font-bold">{getAdventureEmoji(adventure.name)}</div>
                          </div>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-lg text-gray-800 leading-tight line-clamp-2">
                            {adventure.name}
                          </h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {adventure.summary}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-gray-500 text-xs">
                            {formatDate(adventure.lastPlayedAt)}
                          </p>
                          <div className="flex justify-center">
                            <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                              Continue Story
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
            
            {savedAdventures.length === 0 && (
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📖</span>
                <h3 className="text-xl font-bold text-gray-700 mb-2">No Adventures Yet</h3>
                <p className="text-gray-500">Start your first adventure to see it here!</p>
              </div>
            )}
          </section>
        )}

        {/* Top Picks of the Week Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">🔥</span>
            <h2 className="text-2xl font-bold text-gray-800">Top Picks of the Week</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {topPicks.map((adventure) => (
              <div 
                key={adventure.id}
                onClick={() => handleTopPick(adventure.id)}
                className="group cursor-pointer"
              >
                <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border-2 border-gray-200">
                  <div className="aspect-video relative overflow-hidden">
                    <img 
                      src={adventure.image} 
                      alt={adventure.title}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                      onError={(e) => {
                        // Fallback to gradient background with emoji if image fails to load
                        const target = e.target as HTMLImageElement;
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 relative">
                              <div class="absolute inset-0 bg-black/20"></div>
                              <div class="absolute inset-0 flex items-center justify-center">
                                <div class="text-white text-4xl font-bold">
                                  ${adventure.id.includes('stella') ? '🐸' : '🌟'}
                                </div>
                              </div>
                            </div>
                          `;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-all duration-200"></div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-gray-800 leading-tight">{adventure.title}</h3>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{adventure.author}</p>
                    <p className="text-gray-500 text-sm mb-3">{adventure.pages}</p>
                    <div className="flex justify-center">
                      <span className={`${adventure.badgeColor} text-white px-3 py-1 rounded-full text-sm font-medium`}>
                        {adventure.badge}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>


      </div>
    </main>
  );
};

export default HomePage;