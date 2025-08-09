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
    <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
      {panels.slice(0, 5).map((p, i) => (
        <PanelThumbnail key={p.id} index={i} image={p.image} active={i === currentIndex} onClick={() => onSelect(i)} />
      ))}
      {panels.length < 5 && (
        <Button variant="comic" size="icon" onClick={onAddClick} aria-label="Add panel">
          <Plus />
        </Button>
      )}
    </div>
  );
};

export default PanelStrip;
