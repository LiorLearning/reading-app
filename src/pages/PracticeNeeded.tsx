import React from "react";
import { Button } from "@/components/ui/button";
import { playClickSound } from "@/lib/sounds";
import { BookOpen, RotateCcw, Target, ArrowLeft, Heart } from "lucide-react";

interface PracticeNeededProps {
  score: number;
  totalQuestions: number;
  topicName: string;
  onRetryTopic: () => void;
  onBackToTopics: () => void;
}

const PracticeNeeded: React.FC<PracticeNeededProps> = ({
  score,
  totalQuestions,
  topicName,
  onRetryTopic,
  onBackToTopics
}) => {
  const percentage = Math.round((score / totalQuestions) * 100);
  const displayTopicName = topicName.replace(/_/g, ' ');
  const needed = 7 - score;

  return (
    <main 
      className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 py-4 lg:px-6 bg-primary/60 relative" 
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
        className="relative responsive-max-width mx-auto my-4 flex-shrink-0"
        style={{ 
          width: '95%',
          maxWidth: '800px',
          aspectRatio: '4/3',
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
          {/* Practice Needed Card */}
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
                    className="w-4 h-4 border-2 border-black rounded-full bg-orange-300"
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
              {/* Practice Icon */}
              <div className="flex items-center justify-center mb-6">
                <div className="bg-gradient-to-br from-orange-400 to-red-500 p-6 rounded-full">
                  <Target className="h-12 w-12 text-white" />
                </div>
              </div>

              {/* Practice Message */}
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                Keep Practicing! 💪
              </h1>
              
              <h2 className="text-2xl font-semibold text-orange-600 mb-4">
                You Need More Practice
              </h2>

              {/* Score Display */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-6 mb-6 border-2 border-orange-200">
                <p className="text-3xl font-bold text-orange-700 mb-2">
                  {score} out of {totalQuestions} correct
                </p>
                <p className="text-xl text-orange-600 mb-4">
                  That's {percentage}% - Good effort!
                </p>
                
                <div className="bg-white rounded-lg p-4 border-2 border-orange-300">
                  <p className="text-lg font-semibold text-gray-700 mb-2">
                    <Target className="h-5 w-5 inline mr-2" />
                    Goal: Get 7 or more correct
                  </p>
                  <p className="text-md text-gray-600">
                    You need {needed} more correct answer{needed > 1 ? 's' : ''} to master this topic!
                  </p>
                </div>
              </div>

              {/* Topic Info */}
              <div className="mb-8">
                <p className="text-lg text-gray-600 mb-2">
                  Let's practice more with:
                </p>
                <p className="text-xl font-semibold text-primary">
                  "{displayTopicName}"
                </p>
              </div>

              {/* Encouragement */}
              <div className="mb-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <p className="text-blue-800 font-medium flex items-center justify-center gap-2 mb-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Don't worry! Learning takes practice!
                  <Heart className="h-5 w-5 text-red-500" />
                </p>
                <p className="text-blue-700 text-sm">
                  Every mistake is a step closer to mastery. You've got this! 🌟
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => {
                    playClickSound();
                    onRetryTopic();
                  }}
                  className="border-3 bg-orange-600 hover:bg-orange-700 text-white btn-animate px-8 py-4 text-xl font-bold rounded-xl flex items-center gap-3"
                  style={{ 
                    borderColor: '#ea580c',
                    boxShadow: '0 6px 0 #ea580c'
                  }}
                >
                  <RotateCcw className="h-6 w-6" />
                  Try Again
                  <BookOpen className="h-6 w-6" />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    playClickSound();
                    onBackToTopics();
                  }}
                  className="border-3 border-gray-400 bg-white hover:bg-gray-50 text-gray-600 btn-animate px-8 py-4 text-xl font-bold rounded-xl flex items-center gap-3"
                  style={{ 
                    boxShadow: '0 6px 0 #9ca3af'
                  }}
                >
                  <ArrowLeft className="h-6 w-6" />
                  Choose Different Topic
                </Button>
              </div>

              {/* Learning Tips */}
              <div className="mt-8 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                <h3 className="text-lg font-semibold text-green-700 mb-2">💡 Learning Tips:</h3>
                <ul className="text-green-600 text-sm space-y-1 text-left">
                  <li>• Take your time reading each question carefully</li>
                  <li>• Listen to the audio if available</li>
                  <li>• Think about each answer choice before selecting</li>
                  <li>• Practice makes perfect - you'll get it next time!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default PracticeNeeded;
