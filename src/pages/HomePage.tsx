import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { playClickSound } from "@/lib/sounds";
import { Sparkles, Plus, Settings, Rocket } from "lucide-react";
import { loadUserProgress, getNextTopic, hasUserProgress, UserProgress } from "@/lib/utils";
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
  onStartAdventure: (topicId: string) => void;
  onSettings: () => void;
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
    image: "/lovable-uploads/d7e6abca-63c5-44c6-ad2b-3b7f0715a215.png",
    badge: "Best Friend!",
    badgeColor: "bg-orange-500"
  },
  {
    id: "captain-asher-time-stranglers",
    title: "Captain Asher and the Time Stranglers",
    author: "by Asher Elliman, 3rd grade",
    pages: "16 pages", 
    image: "/lovable-uploads/d7e6abca-63c5-44c6-ad2b-3b7f0715a215.png",
    badge: "Top Pick!",
    badgeColor: "bg-yellow-500"
  }
];

const HomePage: React.FC<HomePageProps> = ({ userData, onNavigate, onStartAdventure, onSettings }) => {
  // Progress tracking state
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [nextTopicId, setNextTopicId] = useState<string | null>(null);
  
  // Load user progress on component mount
  useEffect(() => {
    const progress = loadUserProgress();
    setUserProgress(progress);
    
    // Get all available topic IDs from MCQ data
    const allTopicIds = Object.keys(sampleMCQData.topics);
    const nextTopic = getNextTopic(allTopicIds);
    setNextTopicId(nextTopic);
  }, []);
  
  const handleCreateNewStory = () => {
    playClickSound();
    onNavigate('topics');
  };

  const handleContinueAdventure = (adventureId: string) => {
    playClickSound();
    // For now, navigate to topics - could be enhanced to load specific adventure
    onNavigate('topics');
  };

  const handleTopPick = (adventureId: string) => {
    playClickSound();
    // Navigate to specific adventure 
    onNavigate('topics');
  };

  const handleStartAdventure = () => {
    playClickSound();
    if (nextTopicId) {
      onStartAdventure(nextTopicId);
    }
  };

  const handleSettingsClick = () => {
    playClickSound();
    onSettings();
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
        
        {/* Start Adventure Section - Only show if user has progress or can start a topic */}
        {nextTopicId && (
          <section>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">🚀</span>
              <h2 className="text-2xl font-bold text-gray-800">
                {hasUserProgress() ? 'Continue Your Journey' : 'Start Your Adventure'}
              </h2>
            </div>
            
            <div className="flex justify-center">
              <div 
                onClick={handleStartAdventure}
                className="group cursor-pointer"
              >
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-8 text-white text-center hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 transform hover:scale-105 hover:shadow-xl min-w-[400px]"
                     style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="mb-4">
                    <Rocket className="h-12 w-12 mx-auto mb-3" />
                    <Sparkles className="h-6 w-6 mx-auto" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">
                    {hasUserProgress() ? 'CONTINUE ADVENTURE' : 'START ADVENTURE'}
                  </h3>
                  <p className="text-emerald-100 text-sm mb-1">
                    {hasUserProgress() 
                      ? `Resume from where you left off` 
                      : 'Begin your learning journey'}
                  </p>
                  <p className="text-emerald-200 text-xs">
                    {userProgress ? `${userProgress.totalTopicsCompleted} topics completed` : 'Ready to explore!'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
        
        {/* Learning Level Selection */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">📚</span>
            <h2 className="text-2xl font-bold text-gray-800">Choose Your Learning Level</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Start of Grade Level */}
            <div 
              onClick={() => onNavigate('start')}
              className="group cursor-pointer"
            >
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white text-center hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-105 hover:shadow-xl"
                   style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="mb-4">
                  <span className="text-4xl mb-3 block">🌱</span>
                  <Sparkles className="h-6 w-6 mx-auto" />
                </div>
                <h3 className="text-xl font-bold mb-2">Start of Grade</h3>
                <p className="text-green-100 text-sm">Beginning level questions</p>
                <p className="text-green-200 text-xs mt-1">Topic: K-F.2</p>
              </div>
            </div>

            {/* Middle of Grade Level */}
            <div 
              onClick={() => onNavigate('middle')}
              className="group cursor-pointer"
            >
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white text-center hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 hover:shadow-xl"
                   style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="mb-4">
                  <span className="text-4xl mb-3 block">🚀</span>
                  <Sparkles className="h-6 w-6 mx-auto" />
                </div>
                <h3 className="text-xl font-bold mb-2">Middle of Grade</h3>
                <p className="text-blue-100 text-sm">Intermediate level questions</p>
                <p className="text-blue-200 text-xs mt-1">Topic: 1-Q.4</p>
              </div>
            </div>

            {/* Choose Your Own Topic */}
            <div 
              onClick={handleCreateNewStory}
              className="group cursor-pointer"
            >
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white text-center hover:from-purple-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 hover:shadow-xl"
                   style={{ minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div className="mb-4">
                  <Plus className="h-8 w-8 mx-auto mb-3" />
                  <Sparkles className="h-6 w-6 mx-auto" />
                </div>
                <h3 className="text-xl font-bold mb-2">Choose Topic</h3>
                <p className="text-purple-100 text-sm">Pick your own adventure</p>
                <p className="text-purple-200 text-xs mt-1">Browse all topics</p>
              </div>
            </div>

          </div>
        </section>

        {/* Continue Your Adventure Section */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">🎯</span>
            <h2 className="text-2xl font-bold text-gray-800">Your Adventures</h2>
          </div>
          
          <div className="grid md:grid-cols-1 gap-6 max-w-md mx-auto">
            {/* Current Adventure */}
            <div 
              onClick={() => handleContinueAdventure(currentUserAdventure.id)}
              className="group cursor-pointer"
            >
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 border-2 border-gray-200">
                <div className="aspect-video bg-gradient-to-br from-blue-400 to-purple-500 relative">
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-4xl font-bold">🚀</div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-lg text-gray-800 leading-tight">{currentUserAdventure.title}</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{currentUserAdventure.author}</p>
                  <p className="text-gray-500 text-sm mb-3">{currentUserAdventure.pages}</p>
                  <div className="flex justify-center">
                    <span className={`${currentUserAdventure.badgeColor} text-white px-3 py-1 rounded-full text-sm font-medium`}>
                      {currentUserAdventure.badge}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

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
                  <div className="aspect-video bg-gradient-to-br from-purple-400 to-pink-500 relative">
                    <div className="absolute inset-0 bg-black/20"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-4xl font-bold">
                        {adventure.id.includes('stella') ? '🐸' : '🌟'}
                      </div>
                    </div>
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

        {/* Settings Button */}
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={handleSettingsClick}
            className="border-2 border-gray-400 bg-white hover:bg-gray-50 text-gray-700 rounded-xl px-6 py-3 font-semibold btn-animate flex items-center gap-2"
            style={{ boxShadow: '0 4px 0 #9ca3af' }}
          >
            <Settings className="h-5 w-5" />
            Account Settings
          </Button>
        </div>
      </div>
    </main>
  );
};

export default HomePage;