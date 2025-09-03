import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';
import { playClickSound } from '@/lib/sounds';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackData) => void;
}

interface FeedbackData {
  enjoymentAnswer: string;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [enjoymentRating, setEnjoymentRating] = useState<number>(0);
  const [difficultyRating, setDifficultyRating] = useState<number>(0);
  const [additionalThoughts, setAdditionalThoughts] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState<{type: string, index: number} | null>(null);

  // Emoji options ordered from bad to best
  const enjoymentEmojis = ['😭', '😕', '😐', '😊', '🤩'];
  const difficultyEmojis = ['😰', '🤯', '😅', '😌', '😴'];

  const handleEmojiClick = (rating: number, type: 'enjoyment' | 'difficulty') => {
    playClickSound();
    if (type === 'enjoyment') {
      setEnjoymentRating(rating);
    } else {
      setDifficultyRating(rating);
    }
  };

  const handleSubmit = async () => {
    if (enjoymentRating === 0) {
      return; // Require rating
    }

    setIsSubmitting(true);
    playClickSound();

    // Get selected emoji based on rating
    const enjoymentAnswer = enjoymentEmojis[enjoymentRating - 1];

    const feedbackData: FeedbackData = {
      enjoymentAnswer
    };

    try {
      await onSubmit(feedbackData);
      // Reset form
      setEnjoymentRating(0);
      setDifficultyRating(0);
      setAdditionalThoughts('');
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    playClickSound();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-md mx-auto bg-card border-2 border-primary/20 shadow-2xl rounded-3xl overflow-hidden">
        <DialogHeader className="relative pb-2">
          <DialogTitle className="text-center text-2xl sm:text-3xl font-bold text-primary pt-2">
            Session Feedback
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-6">
          {/* Question 1: How was your adventure today? */}
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground flex items-center justify-center gap-2">
              🎯 Was the class fun?
              </h3>
            </div>
            <div className="flex justify-center gap-2">
              {enjoymentEmojis.map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => handleEmojiClick(index + 1, 'enjoyment')}
                  onMouseEnter={() => setHoveredEmoji({type: 'enjoyment', index})}
                  onMouseLeave={() => setHoveredEmoji(null)}
                  className={`
                    text-3xl p-2 rounded-full transition-all duration-300 
                    border-2 btn-animate relative overflow-hidden
                    ${enjoymentRating === index + 1
                      ? 'bg-primary/20 scale-110 border-primary shadow-lg ring-2 ring-primary/30' 
                      : 'border-border hover:border-primary/50 hover:bg-primary/5'
                    }
                    ${hoveredEmoji?.type === 'enjoyment' && hoveredEmoji?.index === index 
                      ? 'animate-bounce' 
                      : ''
                    }
                  `}
                  aria-label={`Rate ${index + 1} out of 5`}
                >
                  <span className="relative z-10">{emoji}</span>
                  {enjoymentRating === index + 1 && (
                    <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Submit button */}
          <Button
            onClick={handleSubmit}
            disabled={enjoymentRating === 0 || isSubmitting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl border-2 border-primary/30 shadow-solid btn-animate disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-foreground border-t-transparent"></div>
                <span>Submitting...</span>
              </div>
            ) : (
              <span className="flex items-center justify-center gap-2">
                ✨ Submit Feedback
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;
