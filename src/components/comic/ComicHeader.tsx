import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Undo2, Redo2, HelpCircle } from "lucide-react";

interface ComicHeaderProps {
  onUndo: () => void;
  onRedo: () => void;
}

const ComicHeader: React.FC<ComicHeaderProps> = ({ onUndo, onRedo }) => {
  return (
    <header className="mb-4 flex items-center justify-between">
      <h1 className="text-2xl font-extrabold tracking-tight">YOUR ADVENTURE <span className="sr-only">— AI Reading Learning App</span></h1>
      <div className="flex items-center gap-2">
        <Button variant="comic" size="icon" onClick={onUndo} aria-label="Undo">
          <Undo2 />
        </Button>
        <Button variant="comic" size="icon" onClick={onRedo} aria-label="Redo">
          <Redo2 />
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="comic" size="icon" aria-label="Help">
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
