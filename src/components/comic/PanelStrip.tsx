import React from "react";
import PanelThumbnail from "./PanelThumbnail";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ComicPanel } from "@/hooks/use-comic";

interface PanelStripProps {
  panels: ComicPanel[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onAddClick: () => void;
}

const PanelStrip: React.FC<PanelStripProps> = ({ panels, currentIndex, onSelect, onAddClick }) => {
  return (
    <aside className="flex flex-col gap-3 p-4 bg-secondary/20 border-r-2 border-foreground min-h-0 overflow-y-auto w-32">
      <h2 className="text-sm font-bold text-center">Panels</h2>
      <div className="flex flex-col gap-2">
        {panels.slice(0, 8).map((p, i) => (
          <PanelThumbnail key={p.id} index={i} image={p.image} active={i === currentIndex} onClick={() => onSelect(i)} />
        ))}
        {panels.length < 8 && (
          <Button variant="comic" size="icon" onClick={onAddClick} aria-label="Add panel" className="self-center btn-animate">
            <Plus />
          </Button>
        )}
      </div>
    </aside>
  );
};

export default PanelStrip;
