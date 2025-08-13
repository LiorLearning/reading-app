import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Undo2, Palette, HelpCircle, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { ComicPanel } from "@/hooks/use-comic";

interface ComicHeaderProps {
  onUndo: () => void;
  panels: ComicPanel[];
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

// Color theme options
const colorThemes = [
  { name: "Pink", primary: "350 81% 60%", background: "350 30% 97%", accent: "350 81% 60%", hue: "350" },
  { name: "Blue", primary: "220 91% 60%", background: "220 30% 97%", accent: "220 91% 60%", hue: "220" },
  { name: "Green", primary: "142 76% 36%", background: "142 30% 97%", accent: "142 76% 36%", hue: "142" },
  { name: "Purple", primary: "262 73% 60%", background: "262 30% 97%", accent: "262 73% 60%", hue: "262" },
  { name: "Orange", primary: "25 95% 53%", background: "25 30% 97%", accent: "25 95% 53%", hue: "25" },
];

const ComicHeader: React.FC<ComicHeaderProps> = ({ onUndo, panels, sidebarCollapsed, onToggleSidebar }) => {
  const [selectedTheme, setSelectedTheme] = useState(colorThemes[0]); // Default to pink
  
  const changeTheme = (theme: typeof colorThemes[0]) => {
    setSelectedTheme(theme);
    
    // Update CSS variables on the document root
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--background', theme.background);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--ring', theme.primary);
    root.style.setProperty('--sidebar-primary', theme.primary);
    root.style.setProperty('--sidebar-ring', theme.primary);
    
    // Update book border colors to match the theme
    root.style.setProperty('--book-border', theme.primary);
    root.style.setProperty('--book-border-deep', theme.primary.replace(/60%/, '50%'));
    root.style.setProperty('--book-border-shadow', theme.primary.replace(/60%/, '40%'));
    
    // Update background pattern colors to match the theme
    // Light mode pattern colors
    root.style.setProperty('--pattern-primary', `${theme.hue} 50% 90%`);
    root.style.setProperty('--pattern-secondary', `${theme.hue} 40% 88%`);
  };
  
  // Initialize theme on component mount
  useEffect(() => {
    changeTheme(selectedTheme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  return (
    <header className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={onToggleSidebar}
          className="border-2 border-foreground shadow-solid bg-white btn-animate"
          aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
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
                <figure key={p.id} className="rounded-lg border-2 border-foreground bg-card">
                  <img src={p.image} alt={`Panel ${i + 1}`} className="w-full h-auto object-cover border-2 border-foreground rounded-t-lg" />
                  <figcaption className="px-2 py-1 text-sm font-semibold">{i + 1}. {p.text}</figcaption>
                </figure>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="icon" onClick={onUndo} aria-label="Undo" className="border-2 border-foreground shadow-solid bg-white btn-animate">
          <Undo2 />
        </Button>
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
                  onClick={() => changeTheme(theme)}
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
