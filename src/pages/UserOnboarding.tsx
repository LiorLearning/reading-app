import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { playClickSound } from "@/lib/sounds";
import { ChevronRight, User, GraduationCap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserOnboardingProps {
  onComplete: (userData: { username: string; grade: string; gradeDisplayName: string; level: string; levelDisplayName: string }) => void;
}

interface GradeOption {
  value: string;
  label: string;
  displayName: string;
}

interface LevelOption {
  value: string;
  label: string;
  displayName: string;
}

const grades: GradeOption[] = [
  { value: "grade1", label: "1st Grade", displayName: "1st Grade" },
];

const levels: LevelOption[] = [
  { value: "start", label: "Start Level", displayName: "Start Level" },
  { value: "mid", label: "Mid Level", displayName: "Mid Level" },
];

const UserOnboarding: React.FC<UserOnboardingProps> = ({ onComplete }) => {
  const [username, setUsername] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [step, setStep] = useState(1); // 1 = username, 2 = grade

  const handleUsernameSubmit = () => {
    if (username.trim()) {
      playClickSound();
      setStep(2);
    }
  };

  const handleGradeSelect = (gradeValue: string) => {
    playClickSound();
    setSelectedGrade(gradeValue);
  };

  const handleLevelSelect = (levelValue: string) => {
    playClickSound();
    setSelectedLevel(levelValue);
  };

  const handleComplete = () => {
    if (username.trim() && selectedGrade && selectedLevel) {
      playClickSound();
      const selectedGradeObj = grades.find(g => g.value === selectedGrade);
      const selectedLevelObj = levels.find(l => l.value === selectedLevel);
      onComplete({
        username: username.trim(),
        grade: selectedGrade,
        gradeDisplayName: selectedGradeObj?.displayName || selectedGrade,
        level: selectedLevel,
        levelDisplayName: selectedLevelObj?.displayName || selectedLevel
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 1) {
        handleUsernameSubmit();
      } else if (step === 2 && selectedGrade && selectedLevel) {
        handleComplete();
      }
    }
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
          maxWidth: '600px',
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
          <Card className="w-full max-w-md bg-white border-4 border-black rounded-3xl overflow-hidden"
                style={{ boxShadow: '0 8px 0 black' }}>
            
            {/* Decorative Header Holes */}
            <div className="relative bg-white h-6 flex justify-evenly items-center px-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="relative">
                  <div 
                    className="w-3 h-3 border-2 border-black rounded-full bg-gray-300"
                    style={{
                      marginTop: '-6px',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
                    }}
                  />
                  <div 
                    className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-white rounded-full border border-gray-400"
                    style={{
                      transform: 'translate(-50%, -50%)',
                      marginTop: '-6px'
                    }}
                  />
                </div>
              ))}
            </div>

            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-br from-purple-400 to-pink-500 p-4 rounded-full">
                  {step === 1 ? (
                    <User className="h-8 w-8 text-white" />
                  ) : (
                    <GraduationCap className="h-8 w-8 text-white" />
                  )}
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-800">
                {step === 1 ? "Welcome to Your Adventure!" : "What's Your Grade?"}
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                {step === 1 
                  ? "Let's start by getting to know you better. What should we call you?"
                  : "Tell us your grade so we can customize your learning experience!"
                }
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {step === 1 ? (
                // Username Step
                <div className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-lg font-semibold text-gray-700 mb-3">
                      Your Name:
                    </label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your name..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="h-14 text-lg border-3 border-black rounded-xl bg-white focus:bg-gray-50"
                      style={{ boxShadow: '0 4px 0 black' }}
                      maxLength={20}
                    />
                  </div>
                  
                  <Button
                    onClick={handleUsernameSubmit}
                    disabled={!username.trim()}
                    className={cn(
                      "w-full h-14 text-lg font-bold rounded-xl border-3 btn-animate flex items-center justify-center gap-3",
                      username.trim() 
                        ? "bg-green-600 hover:bg-green-700 text-white" 
                        : "bg-gray-400 text-gray-600 cursor-not-allowed"
                    )}
                    style={{ 
                      borderColor: username.trim() ? '#16a34a' : '#9ca3af',
                      boxShadow: username.trim() ? '0 6px 0 #16a34a' : '0 4px 0 #6b7280'
                    }}
                  >
                    Continue
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              ) : (
                // Grade Selection Step
                <div className="space-y-4">
                  <div>
                    <label htmlFor="grade" className="block text-lg font-semibold text-gray-700 mb-3">
                      Select Your Grade:
                    </label>
                    <Select onValueChange={handleGradeSelect} value={selectedGrade}>
                      <SelectTrigger 
                        id="grade"
                        className="h-14 text-lg border-3 border-black rounded-xl bg-white hover:bg-gray-50 focus:bg-gray-50"
                        style={{ boxShadow: '0 4px 0 black' }}
                      >
                        <SelectValue placeholder="Choose your grade..." />
                      </SelectTrigger>
                      <SelectContent className="border-2 border-black rounded-xl bg-white">
                        {grades.map((grade) => (
                          <SelectItem 
                            key={grade.value} 
                            value={grade.value}
                            className="text-lg py-3 hover:bg-primary/10 cursor-pointer"
                          >
                            {grade.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Level Selection - Only show when grade is selected */}
                  {selectedGrade && (
                    <div>
                      <label htmlFor="level" className="block text-lg font-semibold text-gray-700 mb-3">
                        Select Your Level:
                      </label>
                      <Select onValueChange={handleLevelSelect} value={selectedLevel}>
                        <SelectTrigger 
                          id="level"
                          className="h-14 text-lg border-3 border-black rounded-xl bg-white hover:bg-gray-50 focus:bg-gray-50"
                          style={{ boxShadow: '0 4px 0 black' }}
                        >
                          <SelectValue placeholder="Choose your level..." />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-xl bg-white">
                          {levels.map((level) => (
                            <SelectItem 
                              key={level.value} 
                              value={level.value}
                              className="text-lg py-3 hover:bg-primary/10 cursor-pointer"
                            >
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Preview */}
                  {selectedGrade && selectedLevel && (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
                      <p className="text-blue-800 font-medium text-center flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Hello {username}! Ready for {grades.find(g => g.value === selectedGrade)?.label} {levels.find(l => l.value === selectedLevel)?.label} adventures?
                        <Sparkles className="h-4 w-4" />
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setStep(1)}
                      variant="outline"
                      className="flex-1 h-12 text-lg font-semibold rounded-xl border-3 border-gray-400 bg-white hover:bg-gray-50"
                      style={{ boxShadow: '0 4px 0 #9ca3af' }}
                    >
                      Back
                    </Button>
                    
                    <Button
                      onClick={handleComplete}
                      disabled={!selectedGrade || !selectedLevel}
                      className={cn(
                        "flex-1 h-12 text-lg font-bold rounded-xl border-3 btn-animate flex items-center justify-center gap-2",
                        (selectedGrade && selectedLevel)
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "bg-gray-400 text-gray-600 cursor-not-allowed"
                      )}
                      style={{ 
                        borderColor: (selectedGrade && selectedLevel) ? '#16a34a' : '#9ca3af',
                        boxShadow: (selectedGrade && selectedLevel) ? '0 6px 0 #16a34a' : '0 4px 0 #6b7280'
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Let's Go!
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
};

export default UserOnboarding;
