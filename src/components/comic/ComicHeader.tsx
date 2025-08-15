import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Undo2, Redo2, HelpCircle } from "lucide-react";
import { ComicPanel } from "@/hooks/use-comic";

interface ComicHeaderProps {
  onUndo: () => void;
  onRedo: () => void;
  panels: ComicPanel[];
}

const ComicHeader: React.FC<ComicHeaderProps> = ({ onUndo, onRedo, panels }) => {
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
                <figure key={p.id} className="rounded-lg border-2 border-foreground bg-card">
                  <img src={p.image} alt={`Panel ${i + 1}`} className="h-auto w-full object-cover" />
                  <figcaption className="px-2 py-1 text-sm font-semibold">{i + 1}. {p.text}</figcaption>
                </figure>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="icon" onClick={onUndo} aria-label="Undo" className="border-2 border-foreground shadow-solid bg-white btn-animate">
          <Undo2 />
        </Button>
        <Button variant="outline" size="icon" onClick={onRedo} aria-label="Redo" className="border-2 border-foreground shadow-solid bg-white btn-animate">
          <Redo2 />
        </Button>
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
