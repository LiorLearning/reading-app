import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { playClickSound } from "@/lib/sounds";
import { Sparkles, Plus, Rocket, ChevronDown, GraduationCap } from "lucide-react";
import { loadUserProgress, getNextTopic, hasUserProgress, UserProgress, loadAdventureSummaries, AdventureSummary, saveTopicPreference, loadTopicPreference, getNextTopicByPreference } from "@/lib/utils";
import { sampleMCQData } from "../data/mcq-questions";

interface UserData {
  username: string;
  grade: string;
  gradeDisplayName: string;
  isFirstTime: boolean;
}

interface HomePageProps {
  userData: UserData;
  onNavigate: (path: 'start' | 'middle' | 'topics') => void;
  onStartAdventure: (topicId: string, mode: 'new' | 'continue') => void;
  onContinueSpecificAdventure?: (adventureId: string) => void;

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

const HomePage: React.FC<HomePageProps> = ({ userData, onNavigate, onStartAdventure, onContinueSpecificAdventure }) => {
  // Progress tracking state
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [nextTopicId, setNextTopicId] = useState<string | null>(null);
  const [savedAdventures, setSavedAdventures] = useState<AdventureSummary[]>([]);
  const [selectedPreference, setSelectedPreference] = useState<'start' | 'middle' | null>(null);
  const [selectedTopicFromPreference, setSelectedTopicFromPreference] = useState<string | null>(null);
  
  // Load user progress and saved adventures on component mount
  useEffect(() => {
    const progress = loadUserProgress();
    setUserProgress(progress);
    
    // Load topic preference
    const preference = loadTopicPreference();
    setSelectedPreference(preference?.level || null);
    
    // Get all available topic IDs from MCQ data
    const allTopicIds = Object.keys(sampleMCQData.topics);
    let nextTopic = getNextTopic(allTopicIds);
    
    // If there's a preference, get the specific topic for that preference
    if (preference?.level) {
      const preferredTopic = getNextTopicByPreference(allTopicIds, preference.level);
      if (preferredTopic) {
        nextTopic = preferredTopic;
        setSelectedTopicFromPreference(preferredTopic);
      }
    }
    
    setNextTopicId(nextTopic);
    
    // Load saved adventures
    const adventures = loadAdventureSummaries();
    setSavedAdventures(adventures);
  }, []);

  // Function to refresh saved adventures (call this from parent when new adventure is saved)
  const refreshSavedAdventures = () => {
    const adventures = loadAdventureSummaries();
    setSavedAdventures(adventures);
  };

  // Expose refresh function to parent component via ref or callback
  React.useEffect(() => {
    // Set up a polling mechanism to check for new adventures and progress updates
    const interval = setInterval(() => {
      const currentAdventures = loadAdventureSummaries();
      if (currentAdventures.length !== savedAdventures.length) {
        setSavedAdventures(currentAdventures);
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
    
    // Check if user has selected a level preference first
    if (mode === 'new' && !selectedPreference) {
      alert('Please select a level (Start or Middle) from the Grade Selection dropdown first!');
      return;
    }
    
    let topicToUse = nextTopicId;
    
    // If user has selected a topic from preference, use that specific topic
    if (mode === 'new' && selectedTopicFromPreference) {
      topicToUse = selectedTopicFromPreference;
    }
    
    if (topicToUse) {
      onStartAdventure(topicToUse, mode);
    }
  };

  const handlePreferenceSelection = (level: 'start' | 'middle') => {
    playClickSound();
    
    // Get all available topic IDs from MCQ data in order
    const allTopicIds = Object.keys(sampleMCQData.topics);
    
    // Save preference and get the specific topic immediately
    const specificTopic = saveTopicPreference(level, allTopicIds);
    
    setSelectedPreference(level);
    setSelectedTopicFromPreference(specificTopic);
    
    // Update next topic immediately
    if (specificTopic) {
      setNextTopicId(specificTopic);
    }
    
    console.log(`Selected ${level} level. Next topic: ${specificTopic}`);
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
            
            <div className="flex justify-center">
              <div className="flex justify-center w-full max-w-2xl">
                {/* Start New Adventure Button */}
                <div 
                  onClick={() => handleStartAdventure('new')}
                  className="group cursor-pointer w-full"
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
                    ) : selectedPreference ? (
                      <p className="text-purple-200 text-xs">
                        {selectedPreference === 'start' ? 'Beginning' : 'Intermediate'} level selected
                      </p>
                    ) : (
                      <p className="text-purple-200 text-xs">
                        Select a level in Grade Selection first!
                      </p>
                    )}
                  </div>
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
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
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
                    className="group cursor-pointer"
                  >
                    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border-2 border-gray-200">
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
      
      {/* Grade Selection Dropdown - Floating on Right Side */}
      <div className="fixed top-24 right-6 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              className={`border-2 ${selectedPreference ? 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'} text-white rounded-xl px-4 py-3 font-semibold btn-animate flex items-center gap-2 shadow-lg transition-all duration-300`}
              style={{ boxShadow: selectedPreference ? '0 4px 0 #15803d' : '0 4px 0 #1d4ed8' }}
              onClick={() => playClickSound()}
            >
              <GraduationCap className="h-5 w-5" />
              {selectedTopicFromPreference ? `Next: ${selectedTopicFromPreference}` : selectedPreference ? `${selectedPreference === 'start' ? 'Start' : 'Middle'} Level` : 'Grade Selection'}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="w-56 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
            align="end"
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg">
                <span className="text-lg">🎓</span>
                <span className="font-semibold">Grade 1</span>
                {selectedTopicFromPreference && (
                  <span className="ml-auto text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    {selectedTopicFromPreference} ready
                  </span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent 
                className="w-48 border-2 border-gray-300 bg-white shadow-xl rounded-xl"
              >
                <DropdownMenuItem 
                  className={`flex items-center gap-2 px-4 py-3 hover:bg-green-50 cursor-pointer rounded-lg ${selectedPreference === 'start' ? 'bg-green-100' : ''}`}
                  onClick={() => handlePreferenceSelection('start')}
                >
                  <span className="text-lg">🌱</span>
                  <div>
                    <div className="font-semibold">Start</div>
                    <div className="text-sm text-gray-500">Beginning level</div>
                  </div>
                  {selectedPreference === 'start' && (
                    <span className="ml-auto text-green-600">✓</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className={`flex items-center gap-2 px-4 py-3 hover:bg-blue-50 cursor-pointer rounded-lg ${selectedPreference === 'middle' ? 'bg-blue-100' : ''}`}
                  onClick={() => handlePreferenceSelection('middle')}
                >
                  <span className="text-lg">🚀</span>
                  <div>
                    <div className="font-semibold">Middle</div>
                    <div className="text-sm text-gray-500">Intermediate level</div>
                  </div>
                  {selectedPreference === 'middle' && (
                    <span className="ml-auto text-blue-600">✓</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 px-4 py-3 hover:bg-purple-50 cursor-pointer rounded-lg"
                  onClick={() => {
                    playClickSound();
                    onNavigate('topics');
                  }}
                >
                  <span className="text-lg">📚</span>
                  <div>
                    <div className="font-semibold">Choose Topic</div>
                    <div className="text-sm text-gray-500">Pick your adventure</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </main>
  );
};

export default HomePage;