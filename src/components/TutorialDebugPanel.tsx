import React from 'react';
import { useTutorial } from '@/hooks/use-tutorial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Debug panel for testing tutorial functionality
 * Only visible in development mode
 */
const TutorialDebugPanel: React.FC = () => {
  const {
    tutorialState,
    isFirstTimeAdventurer,
    needsFillInBlanksTutorial,
    needsMCQTutorial,
    needsChatTutorial,
    completeAdventureTutorial,
    completeFillInBlanksTutorial,
    completeMCQTutorial,
    completeChatTutorial,
    resetAllTutorials,
  } = useTutorial();

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-white/95 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tutorial Debug Panel</CardTitle>
        <CardDescription className="text-xs">
          Development only - Test tutorial states
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current State */}
        <div className="text-xs space-y-1">
          <div className="font-medium">Current State:</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>First Timer: {isFirstTimeAdventurer ? '✅' : '❌'}</div>
            <div>Adventure: {tutorialState.adventureTutorialCompleted ? '✅' : '❌'}</div>
            <div>Fill Blanks: {tutorialState.fillInBlanksTutorialCompleted ? '✅' : '❌'}</div>
            <div>MCQ: {tutorialState.mcqTutorialCompleted ? '✅' : '❌'}</div>
          </div>
        </div>

        {/* Needs Tutorial */}
        <div className="text-xs space-y-1">
          <div className="font-medium">Needs Tutorial:</div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>Fill Blanks: {needsFillInBlanksTutorial ? '🔔' : '✅'}</div>
            <div>MCQ: {needsMCQTutorial ? '🔔' : '✅'}</div>
            <div>Chat: {needsChatTutorial ? '🔔' : '✅'}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <div className="text-xs font-medium">Actions:</div>
          <div className="grid grid-cols-2 gap-1">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-7"
              onClick={completeAdventureTutorial}
            >
              Complete Adventure
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-7"
              onClick={completeFillInBlanksTutorial}
            >
              Complete Fill Blanks
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-7"
              onClick={completeMCQTutorial}
            >
              Complete MCQ
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-7"
              onClick={completeChatTutorial}
            >
              Complete Chat
            </Button>
          </div>
          <Button 
            size="sm" 
            variant="destructive" 
            className="text-xs h-7 w-full"
            onClick={resetAllTutorials}
          >
            Reset All Tutorials
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TutorialDebugPanel;
