import React from 'react';
import { cn } from '@/lib/utils';

interface SpeechBubbleProps {
  message: string;
  className?: string;
  variant?: 'default' | 'success' | 'error' | 'info';
  position?: 'left' | 'right' | 'bottom-left' | 'bottom-right';
}

const SpeechBubble: React.FC<SpeechBubbleProps> = ({ 
  message, 
  className = '', 
  variant = 'default',
  position = 'right'
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          bg: 'bg-green-100',
          border: 'border-green-400',
          text: 'text-green-800'
        };
      case 'error':
        return {
          bg: 'bg-red-100',
          border: 'border-red-400',
          text: 'text-red-800'
        };
      case 'info':
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-400',
          text: 'text-blue-800'
        };
      default:
        return {
          bg: 'bg-white',
          border: 'border-gray-300',
          text: 'text-gray-800'
        };
    }
  };

  const getTailPosition = () => {
    switch (position) {
      case 'left':
        return {
          container: 'ml-4',
          tail: 'absolute top-4 -left-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white'
        };
      case 'bottom-left':
        return {
          container: 'mb-4 ml-4',
          tail: 'absolute bottom-0 left-4 -mb-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white'
        };
      case 'bottom-right':
        return {
          container: 'mb-4 mr-4',
          tail: 'absolute bottom-0 right-4 -mb-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white'
        };
      default: // right
        return {
          container: 'mr-4',
          tail: 'absolute top-4 -right-2 w-0 h-0 border-t-8 border-b-8 border-l-8 border-transparent border-l-white'
        };
    }
  };

  const styles = getVariantStyles();
  const tailStyles = getTailPosition();

  return (
    <div className={cn('relative inline-block', tailStyles.container, className)}>
      <div 
        className={cn(
          'relative px-4 py-3 rounded-2xl border-2 max-w-xs',
          styles.bg,
          styles.border,
          styles.text
        )}
        style={{ 
          boxShadow: '0 4px 0 rgba(0, 0, 0, 0.1)',
          fontFamily: 'inherit'
        }}
      >
        <p className="text-sm font-medium leading-snug">
          {message}
        </p>
        
        {/* Speech bubble tail */}
        <div className={tailStyles.tail} />
        
        {/* Shadow for tail */}
        <div 
          className={cn(
            'absolute',
            position === 'left' && 'top-4 -left-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent',
            position === 'right' && 'top-4 -right-2 w-0 h-0 border-t-8 border-b-8 border-l-8 border-transparent',
            position === 'bottom-left' && 'bottom-0 left-4 -mb-3 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent',
            position === 'bottom-right' && 'bottom-0 right-4 -mb-3 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent'
          )}
          style={{
            borderRightColor: position === 'left' ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
            borderLeftColor: position === 'right' ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
            borderTopColor: (position === 'bottom-left' || position === 'bottom-right') ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
            zIndex: -1
          }}
        />
      </div>
    </div>
  );
};

export default SpeechBubble;