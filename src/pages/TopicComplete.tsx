import React from "react";
import { Button } from "@/components/ui/button";
import { playClickSound } from "@/lib/sounds";
import { Trophy, Star, ChevronRight, RotateCcw } from "lucide-react";
import confetti from 'canvas-confetti';

interface TopicCompleteProps {
  score: number;
  totalQuestions: number;
  topicName: string;
  onNextTopic: () => void;
  onRetryTopic: () => void;
  onBackToTopics: () => void;
}

const TopicComplete: React.FC<TopicCompleteProps> = ({
  score,
  totalQuestions,
  topicName,
  onNextTopic,
  onRetryTopic,
  onBackToTopics
}) => {
  const percentage = Math.round((score / totalQuestions) * 100);
  const displayTopicName = topicName.replace(/_/g, ' ');

  return (
    <main 
      className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-4 py-4 lg:px-6 bg-primary/60 relative" 
      style={{
        backgroundImage: `url('/backgrounds/space.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'multiply'
      }}
      role="main"
    >
      {/* Glass blur overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-primary/10"></div>
      
      {/* Main container */}
      <div 
        className="relative responsive-max-width"
        style={{ 
          width: '95%',
          maxWidth: '800px',
          aspectRatio: '4/3',
          maxHeight: 'calc(100vh - 100px)',
          minHeight: '500px',
          transition: 'all 0.3s ease-in-out'
        }}
      >
        {/* Background Container */}
        <div 
          className="absolute inset-0 rounded-3xl z-0"
          style={{ 
            border: '4px solid hsl(var(--primary) / 0.9)',
            boxShadow: '0 0 12px 3px rgba(0, 0, 0, 0.15)',
            backgroundColor: 'hsl(var(--primary) / 0.9)',
            overflow: 'hidden'
          }}
        />
        
        {/* Content Container */}
        <div 
          className="flex relative z-10 h-full w-full items-center justify-center"
          style={{ 
            padding: '32px'
          }}
        >
          {/* Congratulations Card */}
          <div 
            className="relative bg-white rounded-3xl p-12 max-w-2xl w-full text-center"
            style={{
              border: '4px solid black',
              boxShadow: '0 8px 0 black',
              borderRadius: '24px'
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 right-0 h-6 flex justify-evenly items-center px-4">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="relative">
                  <div 
                    className="w-4 h-4 border-2 border-black rounded-full bg-yellow-300"
                    style={{
                      marginTop: '-12px',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
                    }}
                  />
                  <div 
                    className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full border border-gray-400"
                    style={{
                      transform: 'translate(-50%, -50%)',
                      marginTop: '-12px'
                    }}
                  />
                </div>
              ))}
            </div>
            
            {/* Content */}
            <div className="mt-4">
              {/* Celebration Icon */}
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-full animate-bounce">
                  <Trophy className="h-12 w-12 text-white" />
                </div>
              </div>

              {/* Congratulations Message */}
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                🎉 Congratulations! 🎉
              </h1>
              
              <h2 className="text-2xl font-semibold text-green-600 mb-4">
                You Mastered This Topic!
              </h2>

              {/* Score Display */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border-2 border-green-200">
                <div className="flex items-center justify-center gap-4 mb-4">
                  {[...Array(Math.min(5, Math.floor(score/2)))].map((_, i) => (
                    <Star key={i} className="h-8 w-8 text-yellow-500 fill-current animate-pulse" 
                          style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                
                <p className="text-3xl font-bold text-green-700 mb-2">
                  {score} out of {totalQuestions} correct!
                </p>
                <p className="text-xl text-green-600">
                  That's {percentage}% - Excellent work!
                </p>
              </div>

              {/* Topic Info */}
              <div className="mb-8">
                <p className="text-lg text-gray-600 mb-2">
                  You've successfully mastered:
                </p>
                <p className="text-xl font-semibold text-primary">
                  "{displayTopicName}"
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                    playClickSound();
                    // Trigger celebration effects when advancing to next topic
                    confetti({
                      particleCount: 150,
                      spread: 90,
                      origin: { y: 0.8 },
                      colors: ['#16a34a', '#22c55e', '#4ade80']
                    });
                    setTimeout(() => onNextTopic(), 300);
                  }}
                  className="border-3 bg-green-600 hover:bg-green-700 text-white btn-animate px-8 py-4 text-xl font-bold rounded-xl flex items-center gap-3"
                  style={{ 
                    borderColor: '#16a34a',
                    boxShadow: '0 6px 0 #16a34a'
                  }}
                >
                  <Star className="h-6 w-6" />
                  Next Topic
                  <ChevronRight className="h-6 w-6" />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    playClickSound();
                    onRetryTopic();
                  }}
                  className="border-3 border-primary bg-white hover:bg-primary/10 text-primary btn-animate px-8 py-4 text-xl font-bold rounded-xl flex items-center gap-3"
                  style={{ 
                    boxShadow: '0 6px 0 hsl(var(--primary))'
                  }}
                >
                  <RotateCcw className="h-6 w-6" />
                  Practice Again
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    playClickSound();
                    onBackToTopics();
                  }}
                  className="border-3 border-gray-400 bg-white hover:bg-gray-50 text-gray-600 btn-animate px-8 py-4 text-xl font-bold rounded-xl"
                  style={{ 
                    boxShadow: '0 6px 0 #9ca3af'
                  }}
                >
                  Choose Different Topic
                </Button>
              </div>

              {/* Motivational Message */}
              <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
                <p className="text-blue-800 font-medium flex items-center justify-center gap-2">
                  <Star className="h-4 w-4" />
                  Keep up the amazing work! You're becoming a reading champion!
                  <Star className="h-4 w-4" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default TopicComplete;
