import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { playClickSound } from "@/lib/sounds";
import { ChevronRight, User, GraduationCap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import analytics from '@/lib/analytics';
import { useAuth } from "@/hooks/use-auth";

interface UserOnboardingProps {
  onComplete: () => void;
}

// No grade/level selection UI in the new flow; we only collect age.

// We still persist default grade/level values under-the-hood to satisfy gating.

const UserOnboarding: React.FC<UserOnboardingProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const { updateUserData, userData, user } = useAuth();
  const [username, setUsername] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("assignment");
  const [selectedLevel, setSelectedLevel] = useState("start");
  const [age, setAge] = useState<string>("");
  const [ageError, setAgeError] = useState<string>("");
  const [step, setStep] = useState(1); // 1 = username, 2 = grade
  const [loading, setLoading] = useState(false);

  const getAgeError = (value: string): string => {
    if (!value) return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return "Please enter a valid number.";
    if (n < 4 || n > 14) return "Please enter an age between 4 and 14.";
    return "";
  };

  const handleUsernameSubmit = () => {
    if (username.trim()) {
      playClickSound();
      setStep(2);
      try {
        analytics.capture('user_name_entered', {
          user_name: username.trim(),
          first_time: !userData?.username,
          changed_from_previous: !!(userData?.username && userData.username.trim() && userData.username.trim() !== username.trim()),
        });
      } catch {}
    }
  };

  // Prefill defaults and age from existing user data if present
  React.useEffect(() => {
    setSelectedGrade("assignment");
    setSelectedLevel("start");
  }, []);

  React.useEffect(() => {
    if (userData?.age) {
      setAge(String(userData.age));
    }
  }, [userData?.age]);

  const handleComplete = async () => {
    const parsedAge = Number(age);
    const isValidAge = Number.isFinite(parsedAge) && parsedAge > 3 && parsedAge < 15;

    if (!isValidAge) {
      setAgeError("Please enter an age between 4 and 14.");
      return;
    }

    if (username.trim()) {
      playClickSound();
      setLoading(true);
      setAgeError("");

      try {
        await updateUserData({
          username: username.trim(),
          age: parsedAge,
          // Persist default grade/level to mark onboarding complete elsewhere
          grade: selectedGrade || "assignment",
          gradeDisplayName: selectedGrade || "assignment",
          level: selectedLevel || "start",
          levelDisplayName: "Start Level",
          isFirstTime: false
        });
        try {
          analytics.capture('user_name_entered', {
            user_name: username.trim(),
            first_time: !userData?.username,
            changed_from_previous: !!(userData?.username && userData.username.trim() && userData.username.trim() !== username.trim()),
          });
        } catch {}
        onComplete();
      } catch (error) {
        console.error('Error updating user data:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 1) {
        handleUsernameSubmit();
      } else if (step === 2) {
        const n = Number(age);
        if (age && Number.isFinite(n) && n > 3 && n < 15) {
          handleComplete();
        } else {
          setAgeError(getAgeError(age));
        }
      }
    }
  };

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
      
      {/* Invisible dev-only previous-step hotspot (center-left) */}
      {process.env.NODE_ENV === 'development' && step > 1 && (
        <button
          aria-label="Dev: Previous onboarding step"
          onClick={() => {
            playClickSound();
            setStep(prev => Math.max(1, prev - 1));
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-24 opacity-0 z-50"
          title="Dev prev step"
        />
      )}
      
      {/* Main container - Now scrollable */}
      <div 
        className="relative responsive-max-width mx-auto my-auto flex-shrink-0"
        style={{ 
          width: '95%',
          maxWidth: '600px',
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
            backgroundColor: 'hsl(var(--primary) / 0.9)'
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
                  {step === 1 ? "Welcome to Your Adventure!" : "Personalised Learning"}
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                {step === 1 
                  ? "Let's start by getting to know you better. What should we call you?"
                  : "Tell us your age so personalised learning can begin!"
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
                  {/* Show auth buttons only for anonymous/guest users */}
                  {(!user || user.isAnonymous) && (
                    <>
                      <Button
                        onClick={() => {
                          playClickSound();
                          navigate(`/auth?redirect=/app`);
                        }}
                        className={cn(
                          "w-full h-14 text-lg font-normal rounded-xl border-3 btn-animate flex items-center justify-center gap-3",
                          "bg-green-600 hover:bg-green-700 text-white"
                        )}
                        style={{ 
                          borderColor: '#16a34a',
                          boxShadow: '0 6px 0 #16a34a'
                        }}
                      >
                        Log In / Sign Up
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                // Personalise Step
                <div className="space-y-4">
                  <div>
                    <label htmlFor="age" className="block text-lg font-semibold text-gray-700 mb-3">
                      How old are you?
                    </label>
                    <Input
                      id="age"
                      type="number"
                      inputMode="numeric"
                      min={4}
                      max={14}
                      placeholder="Enter your age"
                      value={age}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                        setAge(digitsOnly);
                        setAgeError(getAgeError(digitsOnly));
                      }}
                      onBlur={() => setAgeError(getAgeError(age))}
                      onKeyPress={handleKeyPress}
                      className="h-14 text-lg border-3 border-black rounded-xl bg-white focus:bg-gray-50"
                      style={{ boxShadow: '0 4px 0 black' }}
                    />
                    {ageError && (
                      <p className="mt-2 text-sm text-red-600 font-semibold" aria-live="polite">{ageError}</p>
                    )}
                  </div>

                  <Button
                    onClick={handleComplete}
                    className={cn(
                      "w-full h-12 text-lg font-bold rounded-xl border-3 btn-animate flex items-center justify-center gap-2",
                      (loading || !age || !Number.isFinite(Number(age)) || Number(age) <= 3 || Number(age) >= 15)
                        ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    )}
                    disabled={Boolean(loading || !age || !Number.isFinite(Number(age)) || Number(age) <= 3 || Number(age) >= 15)}
                    style={{ 
                      borderColor: (loading || !age || !Number.isFinite(Number(age)) || Number(age) <= 3 || Number(age) >= 15) ? '#9ca3af' : '#16a34a',
                      boxShadow: (loading || !age || !Number.isFinite(Number(age)) || Number(age) <= 3 || Number(age) >= 15) ? '0 4px 0 #6b7280' : '0 6px 0 #16a34a'
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Let's Go!
                  </Button>
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
