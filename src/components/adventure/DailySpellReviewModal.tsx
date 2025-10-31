import React from "react";
import SpellReviewModal, { SpellReviewItem } from "./SpellReviewModal";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { getEntriesForDate, getLocalDateKey } from "@/lib/spell-review-log";

interface DailySpellReviewModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Lightweight wrapper that adds a date selector on top of SpellReviewModal
const DailySpellReviewModal: React.FC<DailySpellReviewModalProps> = ({ open, onOpenChange }) => {
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => new Date());
  const [items, setItems] = React.useState<SpellReviewItem[]>([]);

  const reload = React.useCallback((d: Date) => {
    const key = getLocalDateKey(d);
    const entries = getEntriesForDate(key);
    // Adapt to SpellReviewItem shape
    const mapped: SpellReviewItem[] = entries.map((e) => ({
      word: e.word,
      firstTryCorrect: e.firstTryCorrect,
      prefilledIndexes: e.prefilledIndexes,
      emoji: e.emoji,
    }));
    setItems(mapped);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    reload(selectedDate);
  }, [open, selectedDate, reload]);

  const shiftDays = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value; // YYYY-MM-DD
    if (!value) return;
    const [y, m, d] = value.split('-').map((n) => Number(n));
    const dt = new Date(y, (m || 1) - 1, d || 1);
    setSelectedDate(dt);
  };

  const label = (() => {
    const todayKey = getLocalDateKey(new Date());
    const key = getLocalDateKey(selectedDate);
    if (key === todayKey) return "Today";
    return key;
  })();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[101] pointer-events-none flex items-start justify-center pt-6">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 border-2 border-foreground shadow-solid px-3 py-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftDays(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4" />
              <span>{label}</span>
              <input
                type="date"
                className="ml-1 text-xs rounded border px-2 py-1"
                value={getLocalDateKey(selectedDate)}
                onChange={handleDateInput}
              />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftDays(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <SpellReviewModal
        open={open}
        items={items}
        onCompleted={() => {
          if (onOpenChange) onOpenChange(false);
        }}
        onRequestClose={() => onOpenChange?.(false)}
        ttsEnabled={false}
        disableDelay
      />
    </>
  );
};

export default DailySpellReviewModal;


