import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { playClickSound } from "@/lib/sounds";
import { ChevronRight, BookOpen, Sparkles } from "lucide-react";

// Import the MCQ data from the correct location
import { sampleMCQData } from "../data/mcq-questions";

// Interface for extracted topic info
interface TopicOption {
  id: string;
  name: string;
  displayName: string;
  questionCount: number;
}

// Function to extract topics from MCQ data
const extractTopics = (): TopicOption[] => {
  const topics: TopicOption[] = [];
  
  Object.entries(sampleMCQData.topics).forEach(([topicId, topicData]) => {
    topics.push({
      id: topicId,
      name: topicData.topicInfo.topicName,
      displayName: topicData.topicInfo.topicName.replace(/_/g, ' '),
      questionCount: topicData.questions.length
    });
  });
  
  return topics;
};

interface TopicSelectionProps {
  onTopicSelect: (topicId: string) => void;
}

const TopicSelection: React.FC<TopicSelectionProps> = ({ onTopicSelect }) => {
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const topics = extractTopics();

  const handleSelect = () => {
    if (selectedTopic) {
      playClickSound();
      onTopicSelect(selectedTopic);
    }
  };

  const handleTopicChange = (value: string) => {
    setSelectedTopic(value);
    playClickSound();
  };

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
          {/* Selection Card */}
          <div 
            className="relative bg-white rounded-3xl p-12 max-w-2xl w-full"
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
                    className="w-4 h-4 border-2 border-black rounded-full bg-gray-300"
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
            <div className="mt-4 text-center">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center justify-center mb-4">
                  <div className="bg-gradient-to-br from-purple-400 to-pink-500 p-4 rounded-full">
                    <BookOpen className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  Choose Your Learning Adventure
                </h1>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Select a topic to begin your educational journey with interactive questions and personalized feedback!
                </p>
              </div>

              {/* Topic Selection */}
              <div className="mb-8">
                <label htmlFor="topic-select" className="block text-xl font-semibold text-gray-700 mb-4">
                  Select a Topic:
                </label>
                <Select onValueChange={handleTopicChange} value={selectedTopic}>
                  <SelectTrigger 
                    id="topic-select"
                    className="w-full h-16 text-lg border-3 border-black rounded-xl bg-white hover:bg-gray-50 focus:bg-gray-50"
                    style={{ boxShadow: '0 4px 0 black' }}
                  >
                    <SelectValue placeholder="Choose your topic..." />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-black rounded-xl bg-white">
                    {topics.map((topic) => (
                      <SelectItem 
                        key={topic.id} 
                        value={topic.id}
                        className="text-lg py-3 hover:bg-primary/10 cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{topic.displayName}</span>
                          <span className="text-sm text-gray-500 ml-4">
                            {topic.questionCount} questions
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select Button */}
              <div className="flex justify-center">
                <Button
                  variant="default"
                  size="lg"
                  onClick={handleSelect}
                  disabled={!selectedTopic}
                  className={cn(
                    "border-3 text-white btn-animate px-12 py-4 text-xl font-bold rounded-xl transition-all duration-200 flex items-center gap-3",
                    selectedTopic 
                      ? "bg-green-600 hover:bg-green-700 cursor-pointer hover:scale-105" 
                      : "bg-gray-400 cursor-not-allowed"
                  )}
                  style={{ 
                    borderColor: selectedTopic ? '#16a34a' : '#9ca3af',
                    boxShadow: selectedTopic ? '0 6px 0 #16a34a' : '0 4px 0 #6b7280'
                  }}
                >
                  <Sparkles className="h-6 w-6" />
                  START ADVENTURE
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>

              {/* Fun instruction */}
              {selectedTopic && (
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
                  <p className="text-blue-800 font-medium flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Ready to begin your learning adventure?
                    <Sparkles className="h-4 w-4" />
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default TopicSelection;
