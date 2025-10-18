import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, AlertCircle, Circle, TrendingUp, Award, RefreshCw, Eye } from 'lucide-react';
import { playClickSound } from '@/lib/sounds';
import { 
  loadSpellboxTopicProgress, 
  loadSpellboxTopicProgressAsync,
  loadGradeSelection, 
  type SpellboxTopicProgress,
  type SpellboxGradeProgress,
  type GradeSelection 
} from '@/lib/utils';
import { getSpellingTopicIds, getAllSpellingQuestions } from '@/lib/questionBankUtils';
import { sampleMCQData } from '@/data/mcq-questions';
import WhiteboardLesson from '@/components/adventure/WhiteboardLesson';
import { getLessonScript } from '@/data/lesson-scripts';

interface TopicProgressCard {
  topicId: string;
  topicName: string;
  status: 'completed-pass' | 'completed-fail' | 'in-progress' | 'not-started';
  accuracy: number;
  questionsAttempted: number;
  totalQuestions: number;
  completedAt?: number;
}

export function ProgressTracking(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userData } = useAuth();
  const [gradeDisplayName, setGradeDisplayName] = useState<string>('');
  const [topicCards, setTopicCards] = useState<TopicProgressCard[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalTopics: 0,
    completedTopics: 0,
    averageAccuracy: 0,
    totalQuestionsAttempted: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [whiteboardTopicId, setWhiteboardTopicId] = useState<string | null>(null);

  // Detect if this page was opened from the teacher dashboard
  const source = searchParams.get('source');
  const returnToUrl = searchParams.get('returnTo');

  const isGrade1 = useMemo(() => {
    const g = (gradeDisplayName || '').toLowerCase();
    return g.includes('1st') || g.includes('grade 1');
  }, [gradeDisplayName]);

  // Fresh grade detection function - inspired by spellbox approach
  const getCurrentGrade = useCallback(() => {
    // Same priority order as spellbox: localStorage first, then userData, then fallback
    const savedGrade = loadGradeSelection();
    const currentGrade = savedGrade?.gradeDisplayName || userData?.gradeDisplayName || 'Grade 1';
    
    console.log(`🎓 Progress page grade selection - localStorage: ${savedGrade?.gradeDisplayName || 'none'}, userData: ${userData?.gradeDisplayName || 'none'}, using: ${currentGrade}`);
    
    return currentGrade;
  }, [userData]);

  // Load progress data for current grade - called fresh each time
  const loadProgressData = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    }
    
    try {
      // Fresh grade detection every time
      const currentGrade = getCurrentGrade();
      setGradeDisplayName(currentGrade);

      console.log(`📊 Loading progress data for grade: ${currentGrade}`);

      // Get all available topics for this grade
      const availableTopicIds = getSpellingTopicIds(currentGrade);
      console.log(`📝 Available topics for ${currentGrade}:`, availableTopicIds);

      // Determine target user (teacher viewing student if studentId provided)
      const studentIdParam = searchParams.get('studentId') || undefined;

      // Load spellbox progress for this grade
      let gradeProgress: SpellboxGradeProgress | null = null;
      if (studentIdParam && studentIdParam !== user?.uid) {
        gradeProgress = await loadSpellboxTopicProgressAsync(currentGrade, studentIdParam);
      } else {
        gradeProgress = loadSpellboxTopicProgress(currentGrade, user?.uid);
      }
      console.log(`💾 Loaded progress data:`, gradeProgress);

      // Create topic cards with progress information
      const cards: TopicProgressCard[] = availableTopicIds.map(topicId => {
        const topicProgress = gradeProgress?.topicProgress[topicId];
        
        // Get topic name from question data
        const topicData = sampleMCQData.topics[topicId];
        const topicName = topicData?.topicInfo?.progressTopicName || topicId;

        // Determine status and stats
        let status: TopicProgressCard['status'] = 'not-started';
        let accuracy = 0;
        let questionsAttempted = 0;

        if (topicProgress) {
          accuracy = topicProgress.successRate;
          questionsAttempted = topicProgress.questionsAttempted;

          if (topicProgress.isCompleted) {
            status = topicProgress.successRate >= 70 ? 'completed-pass' : 'completed-fail';
          } else if (topicProgress.questionsAttempted > 0) {
            status = 'in-progress';
          }
        }

        return {
          topicId,
          topicName,
          status,
          accuracy: Math.round(accuracy),
          questionsAttempted,
          totalQuestions: 10, // Fixed at 10 questions per topic
          completedAt: topicProgress?.completedAt
        };
      });

      setTopicCards(cards);

      // Calculate overall statistics
      const completedCards = cards.filter(card => card.status === 'completed-pass' || card.status === 'completed-fail');
      const totalQuestionsAttempted = cards.reduce((sum, card) => sum + card.questionsAttempted, 0);
      const totalAccuracy = completedCards.length > 0 
        ? completedCards.reduce((sum, card) => sum + card.accuracy, 0) / completedCards.length 
        : 0;

      setOverallStats({
        totalTopics: cards.length,
        completedTopics: completedCards.length,
        averageAccuracy: Math.round(totalAccuracy),
        totalQuestionsAttempted
      });
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      if (showRefreshIndicator) {
        setIsRefreshing(false);
      }
    }
  }, [getCurrentGrade, user]);

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    playClickSound();
    await loadProgressData(true);
  }, [loadProgressData]);

  // Initial load and real-time grade change detection
  useEffect(() => {
    loadProgressData();

    // Listen for localStorage changes (grade selection from other components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'readingapp_grade_selection' && e.newValue !== e.oldValue) {
        console.log('🔄 Grade selection changed, reloading progress data...');
        loadProgressData();
      }
    };

    // Listen for storage events from other windows/tabs
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events from same-window changes
    const handleCustomGradeChange = () => {
      console.log('🔄 Custom grade change event detected, reloading progress data...');
      loadProgressData();
    };

    window.addEventListener('gradeSelectionChanged', handleCustomGradeChange);

    // Periodic refresh to catch any missed changes (fallback mechanism)
    const intervalId = setInterval(() => {
      const currentDisplayedGrade = gradeDisplayName;
      const actualCurrentGrade = getCurrentGrade();
      
      if (currentDisplayedGrade !== actualCurrentGrade) {
        console.log(`🔄 Grade mismatch detected: displayed "${currentDisplayedGrade}" vs actual "${actualCurrentGrade}", refreshing...`);
        loadProgressData();
      }
    }, 2000); // Check every 2 seconds

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('gradeSelectionChanged', handleCustomGradeChange);
      clearInterval(intervalId);
    };
  }, [loadProgressData, getCurrentGrade, gradeDisplayName]);

  // Get status configuration
  const getStatusConfig = (status: TopicProgressCard['status']) => {
    switch (status) {
      case 'completed-pass':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          badge: { text: 'Passed', variant: 'default' as const, className: 'bg-green-500 hover:bg-green-600' }
        };
      case 'completed-fail':
        return {
          icon: AlertCircle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 border-yellow-200',
          badge: { text: 'Needs Retry', variant: 'destructive' as const, className: 'bg-yellow-500 hover:bg-yellow-600' }
        };
      case 'in-progress':
        return {
          icon: TrendingUp,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200',
          badge: { text: 'In Progress', variant: 'secondary' as const, className: 'bg-blue-500 hover:bg-blue-600 text-white' }
        };
      default:
        return {
          icon: Circle,
          color: 'text-gray-400',
          bgColor: 'bg-gray-50 border-gray-200',
          badge: { text: 'Not Started', variant: 'outline' as const, className: 'border-gray-300 text-gray-600' }
        };
    }
  };

  const handleBackClick = () => {
    playClickSound();
    if (source === 'dashboard') {
      const dashboardUrl = returnToUrl || (import.meta as any)?.env?.VITE_DASHBOARD_URL || 'http://localhost:3000/teacher';
      window.location.href = dashboardUrl;
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-y-auto">
      {/* Custom scrollbar styles */}
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
          }
        `}
      </style>
      {/* Scrollable Container */}
      <div className="p-4">
        {/* Header */}
        <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-6">
          <Button 
            onClick={handleBackClick}
            variant="ghost" 
            size="sm"
            className="text-white hover:bg-white/10 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {source === 'dashboard' ? 'Back to Dashboard' : 'Back to Pet Page'}
          </Button>
          
          <div className="flex items-center gap-2">
            {source !== 'dashboard' && (
              <Button 
                onClick={() => {
                  const dashboardBase = (import.meta as any)?.env?.VITE_DASHBOARD_URL || 'http://localhost:3000';
                  window.location.href = `${dashboardBase}/teacher/login`;
                }}
                variant="default" 
                size="sm"
                className="bg-white text-black hover:bg-white/90"
              >
                Track Progress
              </Button>
            )}
            <Button 
              onClick={handleManualRefresh}
              variant="ghost" 
              size="sm"
              disabled={isRefreshing}
              className="text-white hover:bg-white/10 flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            📊 Progress Tracking
          </h1>
          <p className="text-white/80 text-lg flex items-center justify-center gap-2">
            Your spelling journey for {gradeDisplayName}
            <span className="inline-flex items-center gap-1 text-sm bg-white/10 rounded-full px-2 py-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              Live Updates
            </span>
          </p>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 bg-white/90 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Topics</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.totalTopics}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white/90 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.completedTopics}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white/90 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Average Accuracy</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.averageAccuracy}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white/90 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Circle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Questions Done</p>
                <p className="text-2xl font-bold text-gray-900">{overallStats.totalQuestionsAttempted}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

        {/* Topic Cards Grid */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1)'
          }}>
          {topicCards.map((card) => {
            const config = getStatusConfig(card.status);
            const StatusIcon = config.icon;
            const progressPercentage = card.totalQuestions > 0 ? (card.questionsAttempted / card.totalQuestions) * 100 : 0;

            return (
              <Card 
                key={card.topicId} 
                className={`relative p-6 transition-all duration-200 hover:shadow-lg hover:scale-105 ${config.bgColor} backdrop-blur-md`}
              >
                <div className="flex items-start justify-between mb-4">
                  <StatusIcon className={`h-6 w-6 ${config.color}`} />
                  <Badge 
                    variant={config.badge.variant}
                    className={config.badge.className}
                  >
                    {config.badge.text}
                  </Badge>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                    {card.topicName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Topic ID: {card.topicId}
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-600">
                      Progress
                    </span>
                    <span className="text-xs font-medium text-gray-600">
                      {card.questionsAttempted}/{card.totalQuestions}
                    </span>
                  </div>
                  <Progress 
                    value={progressPercentage} 
                    className="h-2"
                  />
                </div>

                {/* Accuracy Display */}
                {card.questionsAttempted > 0 && (
                  <div className="mt-4 p-3 bg-white/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">
                        Accuracy
                      </span>
                      <span className={`text-lg font-bold ${
                        card.accuracy >= 70 ? 'text-green-600' : 
                        card.accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {card.accuracy}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Completion Date */}
                {card.completedAt && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      Completed: {new Date(card.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* View Whiteboard - Grade 1 only */}
                {isGrade1 && !!getLessonScript(card.topicId) && (
                  <button
                    aria-label="View whiteboard"
                    title="View whiteboard"
                    onClick={() => { playClickSound(); setWhiteboardTopicId(card.topicId); }}
                    className="absolute bottom-3 right-3 w-9 h-9 rounded-full border-2 border-foreground shadow-solid bg-white text-black flex items-center justify-center hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </Card>
            );
          })}
          </div>

          {/* Empty State */}
          {topicCards.length === 0 && (
            <Card className="p-12 text-center bg-white/90 backdrop-blur-md">
              <div className="max-w-md mx-auto">
                <Circle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Topics Available
                </h3>
                <p className="text-gray-600">
                  It looks like there are no spelling topics available for {gradeDisplayName}. 
                  Try selecting a different grade or check back later.
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="max-w-7xl mx-auto mt-12 text-center">
          <p className="text-white/60 text-sm">
            Keep practicing to improve your spelling skills! 🌟
          </p>
        </div>
      </div>
      {/* Floating Whiteboard Overlay */}
      {isGrade1 && whiteboardTopicId && !!getLessonScript(whiteboardTopicId) && (
        <WhiteboardLesson
          topicId={whiteboardTopicId}
          fullscreen
          onRequestClose={() => setWhiteboardTopicId(null)}
          onCompleted={() => setWhiteboardTopicId(null)}
        />
      )}
    </div>
  );
}
