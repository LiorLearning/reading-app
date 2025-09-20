import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Undo2, Redo2, HelpCircle, Palette } from "lucide-react";
import { ComicPanel } from "@/hooks/use-comic";
import { playClickSound } from "@/lib/sounds";
import { aiService } from "@/lib/ai-service";

interface ComicHeaderProps {
  onUndo: () => void;
  onRedo: () => void;
  panels: ComicPanel[];
  selectedTheme?: { name: string; primary: string; background: string; accent: string; hue: string };
  colorThemes?: { name: string; primary: string; background: string; accent: string; hue: string }[];
  onChangeTheme?: (theme: { name: string; primary: string; background: string; accent: string; hue: string }) => void;
}

// Component for panel image figure with Firebase image resolution
const PanelImageFigure: React.FC<{
  panel: ComicPanel;
  index: number;
  oneLiner: string;
}> = ({ panel, index, oneLiner }) => {
  // Get current adventure ID for Firebase image resolution
  const currentAdventureId = useCurrentAdventureId();
  
  // Resolve Firebase image if needed
  const { url: resolvedImageUrl, isExpiredUrl } = useFirebaseImage(panel.image, currentAdventureId || undefined);
  
  React.useEffect(() => {
    if (isExpiredUrl && resolvedImageUrl !== panel.image) {
      console.log(`🔄 ComicHeader Panel ${index + 1}: Resolved expired image to Firebase URL: ${resolvedImageUrl.substring(0, 50)}...`);
    }
  }, [resolvedImageUrl, panel.image, index, isExpiredUrl]);

  return (
    <figure className="rounded-lg border-2 border-foreground bg-card">
      <img 
        src={resolvedImageUrl} 
        alt={`Panel ${index + 1}`} 
        className="h-auto w-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (!target.src.includes('placeholder')) {
            console.warn(`⚠️ Failed to load header panel image ${index + 1}, using fallback`);
            target.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            target.style.minHeight = '200px';
            target.alt = `Panel ${index + 1} (image unavailable)`;
          }
        }}
      />
      <figcaption className="px-2 py-1 text-sm font-semibold">{index + 1}. {oneLiner}</figcaption>
    </figure>
  );
};

// Component for handling async one-liner loading in the comic panel modal
const PanelOneLinerFigure: React.FC<{
  panel: ComicPanel;
  index: number;
}> = ({ panel, index }) => {
  const [oneLiner, setOneLiner] = React.useState<string>('Loading...');

  React.useEffect(() => {
    const generateOneLiner = async () => {
      try {
        const result = await aiService.generateOneLiner(panel.text);
        setOneLiner(result);
      } catch (error) {
        console.error('Failed to generate one-liner:', error);
        // Fallback to simple truncation
        const firstSentence = panel.text.match(/^[^.!?]*[.!?]/);
        if (firstSentence && firstSentence[0].length <= 60) {
          setOneLiner(firstSentence[0].trim());
        } else {
          const truncated = panel.text.substring(0, 50).trim();
          setOneLiner(truncated + (panel.text.length > 50 ? "..." : ""));
        }
      }
    };

    generateOneLiner();
  }, [panel.text]);

  return (
    <PanelImageFigure panel={panel} index={index} oneLiner={oneLiner} />
  );
};

const ComicHeader: React.FC<ComicHeaderProps> = ({ onUndo, onRedo, panels, selectedTheme, colorThemes, onChangeTheme }) => {
  return (
    <header className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight">YOUR ADVENTURE <span className="sr-only">— AI Reading Learning App</span></h1>
      </div>
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="comic" className="btn-animate">View Whole Comic</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Your Adventure (All Panels)</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {panels.map((p, i) => (
                <PanelOneLinerFigure key={p.id} panel={p} index={i} />
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="icon" onClick={() => { playClickSound(); onUndo(); }} aria-label="Undo" className="border-2 border-foreground shadow-solid bg-white btn-animate">
          <Undo2 />
        </Button>
        <Button variant="outline" size="icon" onClick={() => { playClickSound(); onRedo(); }} aria-label="Redo" className="border-2 border-foreground shadow-solid bg-white btn-animate">
          <Redo2 />
        </Button>
        
        {/* Color Theme Picker */}
        {colorThemes && selectedTheme && onChangeTheme && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Change theme color" className="border-2 border-foreground shadow-solid bg-white btn-animate">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <div className="grid grid-cols-5 gap-2">
                {colorThemes.map((theme) => (
                  <Button
                    key={theme.name}
                    variant="comic"
                    size="sm"
                    onClick={() => onChangeTheme(theme)}
                    className={`h-12 w-12 btn-animate flex flex-col items-center justify-center gap-1 ${
                      selectedTheme.name === theme.name ? 'ring-2 ring-foreground ring-offset-2' : ''
                    }`}
                    aria-label={`Change theme to ${theme.name}`}
                    style={{
                      backgroundColor: `hsl(${theme.primary})`,
                      color: 'white'
                    }}
                  >
                    <span className="text-[10px] font-bold">{theme.name}</span>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Help" className="border-2 border-foreground shadow-solid bg-white btn-animate">
              <HelpCircle />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>How to use</DialogTitle>
              <DialogDescription>
                Type what happens next and press Generate to add a new panel. Click thumbnails to navigate. Tap the speaker icon in a bubble to hear the text.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
};

export default ComicHeader;
