import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Star, Download } from 'lucide-react';

interface WordPuzzle {
  scrambled: string[];
  answer: string;
  image: string; // optional image url (can be empty)
  alt: string;
  emoji?: string; // fallback visual if image is not available
}

// Lightweight, reliable image URLs (fallback to emoji if any fails)
const wordPuzzles: WordPuzzle[] = [
  {
      scrambled: ['l', 'a', 'b', 'k', 'c'],
      answer: 'black',
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBw0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ8NDQ0NFREWFhURFRUYHSggGBolGxUVITEhJSk3Ljo6Fx8zODM4Nyg5LjcBCgoKDQ0NDg0NDisZFRkrKy0rNzcrKys3LS0tKzctKy0rLSs3LTcrLSsrKysrKystKysrKysrLSsrKysrKysrK//AABEIAQMAwgMBIgACEQEDEQH/xAAWAAEBAQAAAAAAAAAAAAAAAAAAAQf/xAAWEAEBAQAAAAAAAAAAAAAAAAAAARH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABURAQEAAAAAAAAAAAAAAAAAAAAR/9oADAMBAAIRAxEAPwDDgFABFAAABAAAFBAABUFBQRFAUAEABQBRFAEAQAVRAUBFABFAEVBFAABQAAAQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQBQQFEUAAABAAUAAAAAAAAAAAABFBBUBRAAARRFFAAAEAAABQAAAAAAQAAEABQAEAEUAVFAFAAAEABQAAAABAVAEAEABVAEQABUBQVFAAFAAAAAAAAAAEAAAQAAAAAAAQAUABVABAAUAAAAAAABAURABQAQAAFRAUBQBQAAAAAAAAAAABBQEAQABAFBAVQAAAFAAAAAAAAAAAAQUAAARQEUBAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABUUBAUEAAAAAAAAAAAAAAAAAABQAEAWooIoCCgIKAgoCAoIKAgoCCgIKAgoACgYKCxKigiQAAAAAAAAAAAAAAAAAFABFUAAUf/Z',
      alt: 'Black cat cartoon',
      emoji: '🐈‍⬛',
    },
    {
      scrambled: ['r', 'a', 'g', 'b'],
      answer: 'grab',
      image: 'https://images.pexels.com/photos/10821179/pexels-photo-10821179.jpeg',
      alt: 'Cartoon hand grabbing something',
      emoji: '✋',
    },
    {
      scrambled: ['t', 'e', 's', 'p'],
      answer: 'step',
      image: 'https://media.istockphoto.com/id/1270884495/video/slow-motion-legs-of-confidence-business-man-office-worker-in-suit-and-leather-shoe-walking-up.jpg?s=640x640&k=20&c=917cdTN91UVI6_6MOcCoYbKw2YyKp9LgwOaWQcDNpdI=',
      alt: 'Cartoon footsteps or steps',
      emoji: '👣',
    },
    {
      scrambled: ['o', 'b', 'k', 'l', 'c'],
      answer: 'block',
      image: 'https://images.pexels.com/photos/1340185/pexels-photo-1340185.jpeg?cs=srgb&dl=pexels-magda-ehlers-pexels-1340185.jpg&fm=jpg',
      alt: 'Colorful toy building blocks',
      emoji: '🧱',
    },
    {
      scrambled: ['a', 'r', 'b', 'c'],
      answer: 'crab',
      image: 'https://www.shutterstock.com/image-vector/childrens-flat-vector-illustration-on-600nw-2473413989.jpg',
      alt: 'Red crab cartoon',
      emoji: '🦀',
    },
    {
      scrambled: ['r', 'a', 't', 'p'],
      answer: 'trap',
      image: 'https://atlas-content-cdn.pixelsquid.com/stock-images/bear-trap-Od7Ged4-600.jpg',
      alt: 'Cartoon mouse trap',
      emoji: '🪤',
    },
    {
      scrambled: ['a', 'p', 'e', 'd', 's'],
      answer: 'spade',
      image: 'https://m.media-amazon.com/images/I/51NQTFsGc4L.jpg',
      alt: 'Cartoon garden spade',
      emoji: '🛠️',
    },
    {
      scrambled: ['l', 'o', 'k', 'c', 'c'],
      answer: 'clock',
      image: 'https://media.istockphoto.com/id/931336618/vector/clock-vector-icon-isolated.jpg?s=612x612&w=0&k=20&c=I8EBJl8i6olqcrhAtKko74ydFEVbfCQ6s5Pbsx6vfas=',
      alt: 'Cartoon wall clock',
      emoji: '⏰',
    },
    {
      scrambled: ['r', 'p', 'd', 'o'],
      answer: 'drop',
      image: 'https://static.vecteezy.com/system/resources/thumbnails/044/570/540/small/single-water-drop-on-transparent-background-free-png.png',
      alt: 'Cartoon water drop',
      emoji: '💧',
    },
    {
      scrambled: ['i', 'l', 'p', 's'],
      answer: 'slip',
      image: 'https://static.vecteezy.com/system/resources/previews/060/016/230/non_2x/man-falls-sliding-on-slippery-wet-floor-person-slipping-falling-down-injury-danger-flat-illustration-isolated-on-white-background-vector.jpg',
      alt: 'Cartoon slip warning sign',
      emoji: '⚠️',
    },
  ]
  ;

export default function WorksheetTopic1H1(): React.ReactElement {
  const worksheetRef = React.useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Dynamic script loading helper (cdn)
  const loadScript = React.useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }, []);

  const handleDownload = React.useCallback(async () => {
    const container = worksheetRef.current;
    if (!container) return;

    setIsGenerating(true);
    try {
      // Load libraries
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

      const html2canvas = (window as any).html2canvas as (element: HTMLElement, opts?: any) => Promise<HTMLCanvasElement>;
      const { jsPDF } = (window as any).jspdf;

      // Clone the container to a hidden offscreen node for clean rendering
      const clone = container.cloneNode(true) as HTMLElement;
      document.body.appendChild(clone);
      clone.style.cssText = [
        'position:absolute',
        'left:-9999px',
        'top:0',
        'background:white !important',
        'margin:0 !important',
        'padding:0 !important',
        'display:block !important'
      ].join(';');

      // Hide any download buttons in the clone
      Array.from(clone.querySelectorAll('.download-button')).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      // Fix alignment of letters inside letter boxes for PDF
      Array.from(clone.querySelectorAll('.pdf-letter-box')).forEach(el => {
        const box = el as HTMLElement;
        box.style.display = 'flex';
        box.style.alignItems = 'center';
        box.style.justifyContent = 'center';
        box.style.lineHeight = '1';
        box.style.padding = '0';
        // Slightly smaller width/height so scrambled letters sit closer together in PDF
        box.style.width = '60px';
        box.style.height = '60px';
      });
      Array.from(clone.querySelectorAll('.pdf-letter')).forEach(el => {
        const span = el as HTMLElement;
        span.style.display = 'flex';
        span.style.alignItems = 'center';
        span.style.justifyContent = 'center';
        span.style.lineHeight = '1';
        span.style.margin = '0';
        span.style.padding = '0';
        span.style.transform = 'translateY(0)';
        // Increase font size and switch to a highly readable font in PDF
        span.style.fontSize = '44px';
        span.style.fontFamily = 'Arial, Helvetica, system-ui, -apple-system, sans-serif';
        span.style.fontWeight = '900';
      });
      // Ensure the scrambled letters row uses a tight gap in PDF output
      Array.from(clone.querySelectorAll('.pdf-scrambled-row')).forEach(el => {
        const row = el as HTMLElement;
        row.style.gap = '4px';
        (row.style as any).columnGap = '4px';
        (row.style as any).justifyContent = 'flex-start';
      });

      // Make the instruction heading readable in PDF (smaller than topic)
      Array.from(clone.querySelectorAll('.pdf-instruction')).forEach(el => {
        const instr = el as HTMLElement;
        instr.style.fontSize = '22px';
        instr.style.fontFamily = 'Arial, Helvetica, system-ui, -apple-system, sans-serif';
        instr.style.fontWeight = '900';
        instr.style.letterSpacing = '0.5px';
      });

      // PDF styling for topic line (larger than instruction)
      Array.from(clone.querySelectorAll('.pdf-topic')).forEach(el => {
        const topic = el as HTMLElement;
        topic.style.fontSize = '28px';
        topic.style.fontFamily = 'Arial, Helvetica, system-ui, -apple-system, sans-serif';
        topic.style.fontWeight = '800';
        topic.style.color = '#0f766e';
        topic.style.letterSpacing = '0.4px';
        topic.style.marginBottom = '4px';
      });

      // Ensure answer boxes are solid white without inner shadows for PDF
      Array.from(clone.querySelectorAll('.pdf-answer-box')).forEach(el => {
        const box = el as HTMLElement;
        box.style.backgroundColor = '#ffffff';
        box.style.boxShadow = 'none';
        box.style.backgroundImage = 'none';
        box.style.filter = 'none';
        // Enlarge answer blocks to match scrambled letters
        box.style.width = '80px';
        box.style.height = '80px';
        box.style.display = 'flex';
        box.style.alignItems = 'center';
        box.style.justifyContent = 'center';
        box.style.lineHeight = '1';
        box.style.borderWidth = '6px';
        box.style.borderRadius = '20px';
      });

      // Remove underscore characters inside blanks for PDF output
      Array.from(clone.querySelectorAll('.pdf-underscore')).forEach(el => {
        (el as HTMLElement).textContent = '';
      });

      // PDF-only image adjustments: remove borders, enlarge, ensure fit
      Array.from(clone.querySelectorAll('.pdf-image-box')).forEach(el => {
        const box = el as HTMLElement;
        box.style.border = 'none';
        box.style.boxShadow = 'none';
        box.style.padding = '0px';
        box.style.backgroundColor = '#ffffff';
        box.style.width = '240px';
        box.style.top = '0';
        box.style.bottom = '0';
        box.style.position = 'absolute';
        // Preserve side based on class
        if (box.classList.contains('right-0')) {
          (box.style as any).right = '0';
        } else {
          (box.style as any).left = '0';
        }
        box.style.display = 'flex';
        box.style.alignItems = 'center';
        box.style.justifyContent = 'center';
      });
      Array.from(clone.querySelectorAll('.pdf-image')).forEach(el => {
        const img = el as HTMLElement;
        (img as any).style.width = '100%';
        (img as any).style.height = '100%';
        (img as any).style.objectFit = 'cover';
      });

      // Ensure cloned images attempt CORS-safe loads
      const clonedImagesAll = Array.from(clone.querySelectorAll('img')) as HTMLImageElement[];
      clonedImagesAll.forEach(img => img.setAttribute('crossorigin', 'anonymous'));
      await Promise.all(clonedImagesAll.map(img => new Promise<void>((resolve) => {
        if (img.complete) return resolve();
        img.onload = () => resolve();
        img.onerror = () => resolve();
      })));

      const pageWidthPx = 794;
      const pageHeightPx = 1123; // A4 height in px @ 96DPI
      const renderScale = 3; // crisp output

      // Find each logical worksheet page inside the clone and render per-page
      const pageNodes = Array.from(clone.querySelectorAll('.worksheet-page')) as HTMLElement[];
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pageWidthPx, pageHeightPx], compress: true });

      // If no explicit page nodes found, fallback to rendering entire container once
      const targets = pageNodes.length > 0 ? pageNodes : [clone];

      for (let i = 0; i < targets.length; i++) {
        const pageEl = targets[i];
        // Prepare for edge-to-edge A4 capture with dynamic scale so 5 items fit
        pageEl.style.width = `${pageWidthPx}px`;
        pageEl.style.margin = '0';
        pageEl.style.boxSizing = 'border-box';
        pageEl.style.backgroundColor = '#ffffff';
        pageEl.style.overflow = 'hidden';
        // Remove rounded corners so borders touch page edges in PDF
        (pageEl.style as any).borderRadius = '0px';

        // Compute scale so the full natural content height fits into A4 height
        const naturalHeight = pageEl.scrollHeight;
        const scaleToA4 = naturalHeight > 0 ? Math.min(1, pageHeightPx / naturalHeight) : 1;
        // After scaling, ensure visual width still equals pageWidthPx
        if (scaleToA4 < 1) {
          pageEl.style.transformOrigin = 'top left';
          pageEl.style.transform = `scale(${scaleToA4})`;
          pageEl.style.width = `${pageWidthPx / scaleToA4}px`;
        }

        const pageCanvas = await html2canvas(pageEl, {
          scale: renderScale,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: pageWidthPx,
          windowHeight: pageHeightPx,
          width: pageWidthPx,
          height: pageHeightPx,
          imageTimeout: 15000,
        });

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.97);
        if (i > 0) pdf.addPage([pageWidthPx, pageHeightPx], 'portrait');

        // Draw edge-to-edge (no margins)
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidthPx, pageHeightPx);
      }

      // Clean up the clone
      document.body.removeChild(clone);

      pdf.save('ReadKraft_Worksheet.pdf');
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('There was an error generating the PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [loadScript]);

  return (
    <div className="relative min-h-screen p-4 md:p-8 print:p-0" style={{fontFamily:'system-ui, -apple-system, sans-serif'}}>
      {/* Whiteboard-style background */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden={true}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, hsl(var(--book-page-light)), hsl(var(--book-page-main)))' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(100% 60% at 50% 0%, hsl(var(--primary)/0.08), transparent 70%)' }} />
        <div className="absolute inset-0" style={{ backgroundImage: 'url(/backgrounds/random2.png)', backgroundRepeat: 'repeat', backgroundSize: '260px 260px', opacity: 0.15 }} />
        <div className="absolute inset-0" style={{ backgroundColor: 'hsl(var(--primary) / 0.10)', mixBlendMode: 'multiply' }} />
      </div>
      <div className="relative z-10" ref={worksheetRef} style={{fontFamily:'system-ui, -apple-system, sans-serif'}}>
        {Array.from({ length: Math.ceil(wordPuzzles.length / 5) }).map((_, pageIndex) => {
          const start = pageIndex * 5;
          const end = start + 5;
          const pagePuzzles = wordPuzzles.slice(start, end);
          return (
            <div
              key={pageIndex}
              className="worksheet-page w-[820px] md:w-[860px] mx-auto bg-card rounded-3xl shadow-2xl border-[8px] border-primary/80 overflow-hidden"
              style={{
                ...(pageIndex < Math.ceil(wordPuzzles.length / 5) - 1 ? { pageBreakAfter: 'always' } : {}),
                backgroundImage: 'linear-gradient(180deg, hsl(var(--book-page-light)), hsl(var(--book-page-main))), radial-gradient(100% 60% at 50% 0%, hsl(var(--primary)/0.08), transparent 70%), url(/backgrounds/random2.png)',
                backgroundRepeat: 'no-repeat, no-repeat, repeat',
                backgroundSize: 'cover, cover, 260px 260px'
              }}
            >
        {/* Header */}
        <header className="bg-gradient-to-r from-primary to-accent p-4 md:p-6">
                <div className="flex items-center justify-between gap-6">
            <div className="flex-1">
              <label
                htmlFor="student-name"
                className="block text-sm tracking-wider font-semibold text-primary-foreground mb-2"
              >
                NAME
              </label>
              <Input
                id="student-name"
                className="max-w-md bg-white/95 border-2 border-white h-12 text-lg rounded-xl print:border-b print:border-t-0 print:border-x-0 print:rounded-none"
                      placeholder=""
              />
            </div>
                  <div className="text-right self-center">
                    <h2 className="text-3xl md:text-4xl font-black text-primary-foreground font-kids leading-none tracking-tight drop-shadow-md whitespace-nowrap">
                      Read<span className="text-yellow-300">Kraft</span>
              </h2>
                    {pageIndex === 0 && (
              <Button
                onClick={handleDownload}
                variant="outline"
                        disabled={isGenerating}
                        className="download-button print:hidden mt-2 h-10 px-3 rounded-xl border-[3px] border-white bg-white/90 text-primary-foreground btn-animate shadow-[0_4px_0_rgba(0,0,0,0.25)]"
                aria-label="Download worksheet"
                title="Download worksheet"
              >
                <Download className="h-4 w-4 mr-2" />
                        {isGenerating ? 'Generating…' : 'Download'}
              </Button>
                    )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative p-6 md:p-10 rounded-3xl overflow-hidden">
          {/* Background plane behind instruction and cards */}
          <div className="absolute inset-0" aria-hidden={true}>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, hsl(var(--book-page-light)), hsl(var(--book-page-main)))' }} />
            <div className="absolute inset-0" style={{ background: 'radial-gradient(100% 60% at 50% 0%, hsl(var(--primary)/0.08), transparent 70%)' }} />
            <div className="absolute inset-0" style={{ backgroundImage: 'url(/backgrounds/random2.png)', backgroundRepeat: 'repeat', backgroundSize: '260px 260px', opacity: 0.15 }} />
            <div className="absolute inset-0" style={{ backgroundColor: 'hsl(var(--primary) / 0.10)', mixBlendMode: 'multiply' }} />
          </div>
          <div className="relative z-10">
            <h3 className="pdf-topic text-center text-xl md:text-2xl font-extrabold text-primary mb-1 tracking-wide">
              Topic: Consonant blends
            </h3>
            <p className="pdf-instruction text-center text-lg md:text-xl text-foreground mb-6 md:mb-8" style={{fontWeight:1000}}>
              Unscramble the letters and write the names of pictures!
            </p>

            {/* Word Puzzles */}
            <div className="space-y-6 md:space-y-8">
                  {pagePuzzles.map((puzzle, index) => {
              const isEven = index % 2 === 1;
              return (
                <div
                  key={index}
                  className="relative overflow-hidden flex flex-col md:flex-row items-center gap-6 p-6 rounded-3xl bg-gradient-to-r from-secondary to-secondary/60 border-2 border-primary/20 shadow-lg hover:shadow-xl transition-all hover:scale-[1.01]"
                >
                  {/* Image left for even rows */}
                  {isEven && (
                    <div className="flex-shrink-0 order-first md:order-first">
                      <div className="pdf-image-box absolute inset-y-0 left-0 w-44 md:w-64 bg-white flex items-center justify-center">
                        {puzzle.image ? (
                          <img
                            src={puzzle.image}
                            alt={puzzle.alt}
                            className="pdf-image w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-6xl" aria-label={puzzle.alt}>
                            {puzzle.emoji || '✨'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Puzzle section */}
                  <div className={`${isEven ? 'pl-48 md:pl-72 pr-6' : 'pr-48 md:pr-72 pl-6'} flex flex-col items-center gap-6 md:gap-8 flex-1`}>
                    {/* Scrambled Letters */}
                    <div className="pdf-scrambled-row flex gap-0.5 md:gap-1">
                      {puzzle.scrambled.map((letter, letterIndex) => (
                        <div
                          key={letterIndex}
                                className="pdf-letter-box w-14 h-14 md:w-16 md:h-16 flex items-center justify-center"
                        >
                                <span className="pdf-letter text-2xl md:text-3xl font-black text-primary">
                            {letter}
                          </span>
                        </div>
                      ))}
                    </div>

                    

                    {/* Answer Boxes */}
                    <div className="flex gap-2 md:gap-3">
                      {puzzle.answer.split('').map((_, answerIndex) => (
                        <div
                          key={answerIndex}
                                className="pdf-answer-box w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-white border-[3px] border-dashed border-accent rounded-2xl shadow-inner print:border-b-2 print:border-solid print:border-t-0 print:border-x-0 print:rounded-none"
                        >
                          <span className="pdf-underscore text-2xl text-muted-foreground/30 font-bold" aria-hidden>_</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Image right for odd rows */}
                  {!isEven && (
                    <div className="flex-shrink-0">
                      <div className="pdf-image-box absolute inset-y-0 right-0 w-44 md:w-64 bg-white flex items-center justify-center">
                        {puzzle.image ? (
                          <img
                            src={puzzle.image}
                            alt={puzzle.alt}
                            className="pdf-image w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-6xl" aria-label={puzzle.alt}>
                            {puzzle.emoji || '✨'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gradient-to-r from-secondary to-primary/20 p-6 flex items-center justify-between">
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Star key={i} className="w-6 h-6 text-accent fill-accent/50" />
            ))}
          </div>
                <p className="text-base md:text-xl font-bold text-primary tracking-wide">www.readkraft.com</p>
        </footer>
            </div>
          );
        })}
      </div>
    </div>
  );
}


