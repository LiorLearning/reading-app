import React, { useCallback, useMemo } from "react";
import ComicHeader from "@/components/comic/ComicHeader";
import PanelStrip from "@/components/comic/PanelStrip";
import ComicPanel from "@/components/comic/ComicPanel";
import Sidebar from "@/components/comic/Sidebar";
import InputBar from "@/components/comic/InputBar";
import { useComic } from "@/hooks/use-comic";
import rocket1 from "@/assets/comic-rocket-1.jpg";
import spaceport2 from "@/assets/comic-spaceport-2.jpg";
import alien3 from "@/assets/comic-alienland-3.jpg";
import cockpit4 from "@/assets/comic-cockpit-4.jpg";

const Index = () => {
  React.useEffect(() => {
    document.title = "AI Reading Learning App — Your Adventure";
  }, []);

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "AI Reading Learning App",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description: "Create comic panels with narration to support early reading.",
    }),
    []
  );

  const images = useMemo(() => [rocket1, spaceport2, alien3, cockpit4], []);

  const initialPanels = useMemo(
    () => [
      { id: crypto.randomUUID(), image: rocket1, text: "The brave astronaut climbs into ROCKET!" },
      { id: crypto.randomUUID(), image: alien3, text: "Clouds drift by as the engines warm up." },
    ],
    []
  );

  const { panels, currentIndex, setCurrent, addPanel, undo, redo } = useComic(initialPanels);
  const [history, setHistory] = React.useState<string[]>([]);

  const speak = useCallback((text: string) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, []);

  const onGenerate = useCallback(
    (text: string) => {
      const image = images[Math.floor(Math.random() * images.length)];
      addPanel({ id: crypto.randomUUID(), image, text });
      setHistory((h) => [...h, text]);
    },
    [addPanel, images]
  );

  const onAddClick = useCallback(() => {
    const image = images[Math.floor(Math.random() * images.length)];
    addPanel({ id: crypto.randomUUID(), image, text: "A new twist begins..." });
  }, [addPanel, images]);

  const current = panels[currentIndex] ?? initialPanels[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ComicHeader onUndo={undo} onRedo={redo} />

        <main className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]" role="main">
          <section aria-label="Panel strip and main panel" className="flex flex-col mx-auto w-full max-w-3xl">
            <PanelStrip panels={panels} currentIndex={currentIndex} onSelect={setCurrent} onAddClick={onAddClick} />

            <ComicPanel
              image={current.image}
              text={current.text}
              onSpeak={() => speak(current.text)}
              className="aspect-[4/3]"
            />

            <InputBar onGenerate={onGenerate} history={history} />
          </section>

          <Sidebar panels={panels} />
        </main>
      </div>
    </div>
  );
};

export default Index;
