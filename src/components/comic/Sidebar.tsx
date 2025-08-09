import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComicPanel } from "@/hooks/use-comic";

interface SidebarProps {
  panels: ComicPanel[];
}

const Sidebar: React.FC<SidebarProps> = ({ panels }) => {
  return (
    <aside className="flex w-full max-w-[220px] flex-col items-center gap-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full font-bold">View Whole Comic</Button>
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
      <img
        src="/lovable-uploads/d7e6abca-63c5-44c6-ad2b-3b7f0715a215.png"
        alt="Adventure guide avatar"
        className="h-20 w-20 rounded-xl border-2 border-foreground object-cover"
      />
    </aside>
  );
};

export default Sidebar;
