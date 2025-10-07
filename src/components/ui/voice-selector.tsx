import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Volume2, Check, Gauge } from 'lucide-react';
import { ttsService, Voice, AVAILABLE_VOICES } from '@/lib/tts-service';
import { playClickSound } from '@/lib/sounds';

interface VoiceSelectorProps {
  className?: string;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ className = '' }) => {
  const [selectedVoice, setSelectedVoice] = useState<Voice>(() => ttsService.getSelectedVoice());
  const [selectedSpeed, setSelectedSpeed] = useState<number>(() => ttsService.getSelectedSpeed());
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<string | null>(null);

  const handleVoiceSelect = async (voice: Voice) => {
    playClickSound();
    
    // Update TTS service and local state
    ttsService.setSelectedVoice(voice);
    setSelectedVoice(voice);
    
    // Play preview
    setIsPreviewPlaying(voice.id);
    try {
      await ttsService.previewVoice(voice);
    } finally {
      setIsPreviewPlaying(null);
    }
  };

  const handlePreview = async (voice: Voice, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent voice selection when clicking preview
    playClickSound();
    
    if (isPreviewPlaying === voice.id) {
      ttsService.stop();
      setIsPreviewPlaying(null);
      return;
    }
    
    setIsPreviewPlaying(voice.id);
    try {
      await ttsService.previewVoice(voice);
    } finally {
      setIsPreviewPlaying(null);
    }
  };

  const handleSpeedChange = (value: number[]) => {
    const speed = value[0];
    setSelectedSpeed(speed);
    ttsService.setSelectedSpeed(speed);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          aria-label={`Current voice: ${selectedVoice.name}`}
          className={`border-2 border-foreground shadow-solid bg-white text-black btn-animate w-10 h-10 rounded-full flex items-center justify-center text-lg leading-none ${className}`}
        >
          <span role="img" aria-hidden="true">🔊</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 border border-white/40 bg-white/95 text-slate-900 rounded-2xl shadow-xl" align="end">
        <div className="space-y-3">
          <h3 className="font-semibold text-sm">Choose a Voice</h3>
          <div className="space-y-2">
            {AVAILABLE_VOICES.map((voice) => (
              <div
                key={voice.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-50 ${
                  selectedVoice.id === voice.id 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-gray-200'
                }`}
                onClick={() => handleVoiceSelect(voice)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-sm">{voice.name}</h4>
                      {selectedVoice.id === voice.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{voice.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handlePreview(voice, e)}
                    className="ml-2 h-8 w-8 p-0 hover:bg-gray-100"
                    disabled={!ttsService.isConfigured()}
                    aria-label={`Preview ${voice.name}'s voice`}
                  >
                    <Volume2 
                      className={`h-3 w-3 ${
                        isPreviewPlaying === voice.id ? 'text-primary animate-pulse' : ''
                      }`} 
                    />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Voice Speed Control */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="h-4 w-4 text-gray-600" />
              <h4 className="font-medium text-sm">Voice Speed</h4>
              <span className="text-xs text-gray-500 ml-auto">{selectedSpeed.toFixed(1)}x</span>
            </div>
            <Slider
              value={[selectedSpeed]}
              onValueChange={handleSpeedChange}
              max={1.2}
              min={0.7}
              step={0.1}
              className="w-full"
              disabled={!ttsService.isConfigured()}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.7x (Slow)</span>
              <span>1.0x (Normal)</span>
              <span>1.2x (Fast)</span>
            </div>
          </div>
          
          {!ttsService.isConfigured() && (
            <p className="text-xs text-gray-500 mt-2">
              TTS API key required for voice functionality
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default VoiceSelector;
