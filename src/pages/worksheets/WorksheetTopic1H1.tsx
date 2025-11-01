import React from 'react';
import pandaSticker from '@/assets/panda2.png';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Star, Download, Loader2, RotateCcw, Pencil } from 'lucide-react';
import { generateQuestionImageForWord, generateImageWithPrompt, buildDefaultPrompt } from '@/lib/question-image-channel';

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
      scrambled: ['L', 'A', 'B', 'K', 'C'],
      answer: 'black',
      image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBw0NDQ0NDQ0NDQ0NDQ0NDQ0NDQ8NDQ0NFREWFhURFRUYHSggGBolGxUVITEhJSk3Ljo6Fx8zODM4Nyg5LjcBCgoKDQ0NDg0NDisZFRkrKy0rNzcrKys3LS0tKzctKy0rLSs3LTcrLSsrKysrKystKysrKysrLSsrKysrKysrK//AABEIAQMAwgMBIgACEQEDEQH/xAAWAAEBAQAAAAAAAAAAAAAAAAAAAQf/xAAWEAEBAQAAAAAAAAAAAAAAAAAAARH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABURAQEAAAAAAAAAAAAAAAAAAAAR/9oADAMBAAIRAxEAPwDDgFABFAAABAAAFBAABUFBQRFAUAEABQBRFAEAQAVRAUBFABFAEVBFAABQAAAQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQBQQFEUAAABAAUAAAAAAAAAAAABFBBUBRAAARRFFAAAEAAABQAAAAAAQAAEABQAEAEUAVFAFAAAEABQAAAABAVAEAEABVAEQABUBQVFAAFAAAAAAAAAAEAAAQAAAAAAAQAUABVABAAUAAAAAAABAURABQAQAAFRAUBQBQAAAAAAAAAAABBQEAQABAFBAVQAAAFAAAAAAAAAAAAQUAAARQEUBAAAAUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABUUBAUEAAAAAAAAAAAAAAAAAABQAEAWooIoCCgIKAgoCAoIKAgoCCgIKAgoACgYKCxKigiQAAAAAAAAAAAAAAAAAFABFUAAUf/Z',
      alt: 'Black cat cartoon',
      emoji: '🐈‍⬛',
    },
    {
      scrambled: ['R', 'A', 'G', 'B'],
      answer: 'grab',
      image: 'https://images.pexels.com/photos/10821179/pexels-photo-10821179.jpeg',
      alt: 'Cartoon hand grabbing something',
      emoji: '✋',
    },
    {
      scrambled: ['T', 'E', 'S', 'P'],
      answer: 'step',
      image: 'https://media.istockphoto.com/id/1270884495/video/slow-motion-legs-of-confidence-business-man-office-worker-in-suit-and-leather-shoe-walking-up.jpg?s=640x640&k=20&c=917cdTN91UVI6_6MOcCoYbKw2YyKp9LgwOaWQcDNpdI=',
      alt: 'Cartoon footsteps or steps',
      emoji: '👣',
    },
    {
      scrambled: ['O', 'B', 'K', 'L', 'C'],
      answer: 'block',
      image: 'https://images.pexels.com/photos/1340185/pexels-photo-1340185.jpeg?cs=srgb&dl=pexels-magda-ehlers-pexels-1340185.jpg&fm=jpg',
      alt: 'Colorful toy building blocks',
      emoji: '🧱',
    },
    {
      scrambled: ['A', 'R', 'B', 'C'],
      answer: 'crab',
      image: 'https://www.shutterstock.com/image-vector/childrens-flat-vector-illustration-on-600nw-2473413989.jpg',
      alt: 'Red crab cartoon',
      emoji: '🦀',
    },
    {
      scrambled: ['R', 'A', 'T', 'P'],
      answer: 'trap',
      image: 'https://atlas-content-cdn.pixelsquid.com/stock-images/bear-trap-Od7Ged4-600.jpg',
      alt: 'Cartoon mouse trap',
      emoji: '🪤',
    },
    {
      scrambled: ['A', 'P', 'E', 'D', 'S'],
      answer: 'spade',
      image: 'https://m.media-amazon.com/images/I/51NQTFsGc4L.jpg',
      alt: 'Cartoon garden spade',
      emoji: '🛠️',
    },
    {
      scrambled: ['L', 'O', 'K', 'C', 'C'],
      answer: 'clock',
      image: 'https://media.istockphoto.com/id/931336618/vector/clock-vector-icon-isolated.jpg?s=612x612&w=0&k=20&c=I8EBJl8i6olqcrhAtKko74ydFEVbfCQ6s5Pbsx6vfas=',
      alt: 'Cartoon wall clock',
      emoji: '⏰',
    },
    {
      scrambled: ['R', 'P', 'D', 'O'],
      answer: 'drop',
      image: 'https://static.vecteezy.com/system/resources/thumbnails/044/570/540/small/single-water-drop-on-transparent-background-free-png.png',
      alt: 'Cartoon water drop',
      emoji: '💧',
    },
    {
      scrambled: ['I', 'L', 'P', 'S'],
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
  const [puzzles, setPuzzles] = React.useState<WordPuzzle[]>(() => wordPuzzles.map(p => ({ ...p })));
  const [loadingMap, setLoadingMap] = React.useState<Record<number, boolean>>({});
  const [isGeneratingAll, setIsGeneratingAll] = React.useState(false);
  const [activePromptIndex, setActivePromptIndex] = React.useState<number | null>(null);
  const [promptText, setPromptText] = React.useState<string>('');
  const [isSendingPrompt, setIsSendingPrompt] = React.useState(false);

  const retryOne = React.useCallback(async (index: number) => {
    try {
      setLoadingMap(prev => ({ ...prev, [index]: true }));
      const word = (puzzles[index]?.answer || '').trim();
      if (!word) return;
      const url = await generateQuestionImageForWord(word);
      setPuzzles(prev => prev.map((p, i) => i === index ? { ...p, image: url } : p));
    } catch (err) {
      // Silent error; provider already handles user feedback
    } finally {
      setLoadingMap(prev => ({ ...prev, [index]: false }));
    }
  }, [puzzles]);

  const generateAll = React.useCallback(async () => {
    if (isGeneratingAll) return;
    setIsGeneratingAll(true);
    try {
      for (let i = 0; i < puzzles.length; i++) {
        // Sequential to avoid throttling
        await retryOne(i);
      }
    } finally {
      setIsGeneratingAll(false);
    }
  }, [isGeneratingAll, puzzles.length, retryOne]);

  const openPromptEditor = React.useCallback((index: number) => {
    setActivePromptIndex(index);
    const word = (puzzles[index]?.answer || '').trim();
    setPromptText(buildDefaultPrompt(word));
  }, [puzzles]);

  const sendCustomPrompt = React.useCallback(async () => {
    const index = activePromptIndex;
    if (index === null) return;
    const prompt = (promptText || '').trim();
    if (!prompt) return;
    setIsSendingPrompt(true);
    setLoadingMap(prev => ({ ...prev, [index]: true }));
    try {
      const url = await generateImageWithPrompt(prompt);
      setPuzzles(prev => prev.map((p, i) => i === index ? { ...p, image: url } : p));
    } catch (e) {
      // ignore; provider surfaces any toasts
    } finally {
      setLoadingMap(prev => ({ ...prev, [index]: false }));
      setIsSendingPrompt(false);
    }
  }, [activePromptIndex, promptText]);

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
      // Ensure Fredoka font is available for PDF render
      const fontHref = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700;800;900&display=swap';
      if (!document.querySelector(`link[href="${fontHref}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontHref;
        document.head.appendChild(link);
      }
      try {
        if ((document as any).fonts?.load) {
          await (document as any).fonts.load('700 16px Fredoka');
        }
        if ((document as any).fonts?.ready) {
          await (document as any).fonts.ready;
        }
      } catch {}
      clone.style.cssText = [
        'position:absolute',
        'left:-9999px',
        'top:0',
        'background:white !important',
        'margin:0 !important',
        'padding:0 !important',
        'display:block !important'
      ].join(';');
      (clone.style as any).fontFamily = "'Fredoka', system-ui, -apple-system, Arial, Helvetica, sans-serif";

      // Hide any download buttons in the clone
      Array.from(clone.querySelectorAll('.download-button')).forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      // Ensure any Tailwind print:hidden elements are hidden in the canvas clone
      // Note: CSS class with ':' requires escaping in querySelector
      try {
        Array.from(clone.querySelectorAll('.print\\:hidden')).forEach(el => {
          (el as HTMLElement).style.display = 'none';
          (el as HTMLElement).style.visibility = 'hidden';
        });
      } catch {}

      // PDF-only: remove header and footer entirely
      Array.from(clone.querySelectorAll('header, footer, .pdf-remove'))
        .forEach(el => { (el as HTMLElement).style.display = 'none'; });

      // PDF-only: pull the content to the very top and add some bottom space
      Array.from(clone.querySelectorAll('main')).forEach(el => {
        const mainEl = el as HTMLElement;
        // keep panel sizes intact; only reduce top padding and add bottom padding
        mainEl.style.paddingTop = '12px';
        mainEl.style.paddingBottom = '72px';
      });

      // PDF-only: add mascot image at bottom-right of every worksheet page (local asset)
      const stickerUrl = pandaSticker as unknown as string;
      Array.from(clone.querySelectorAll('.worksheet-page')).forEach(page => {
        const pageEl = page as HTMLElement;
        // Ensure absolute children position against the page box
        if (getComputedStyle(pageEl).position === 'static') {
          pageEl.style.position = 'relative';
        }

        const img = document.createElement('img');
        // Set crossorigin before src (harmless for same-origin)
        img.setAttribute('crossorigin', 'anonymous');
        img.src = stickerUrl;
        img.alt = 'Panda super happy';
        const style = img.style as CSSStyleDeclaration & { [key: string]: any };
        style.position = 'absolute';
        style.right = '16px';
        style.bottom = '16px';
        style.width = '290px';
        style.height = 'auto';
        style.objectFit = 'contain';
        style.zIndex = '5';
        style.pointerEvents = 'none';
        pageEl.appendChild(img);

        // PDF-only: add a speech bubble near the panda with placeholder text
        const bubble = document.createElement('div');
        const b = bubble.style as CSSStyleDeclaration & { [key: string]: any };
        b.position = 'absolute';
        // place the bubble above-left of the panda
        b.right = '330px';
        b.bottom = '140px';
        b.maxWidth = '420px';
        b.minWidth = '200px';
        b.minHeight = '90px';
        b.padding = '1px 22px 24px 22px';
        b.display = 'flex';
        (b as any).alignItems = 'center';
        b.background = '#ffffff';
        b.border = '3px solid #00776d';
        b.borderRadius = '22px';
        b.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
        b.zIndex = '6';
        b.color = '#00776d';
        b.fontFamily = "'Fredoka', Arial, Helvetica, system-ui, -apple-system, sans-serif";
        b.fontWeight = '400';
        b.fontSize = '22px';
        b.lineHeight = '1.25';
        b.pointerEvents = 'none';

        // bubble tail
        const tail = document.createElement('div');
        const t = tail.style as CSSStyleDeclaration & { [key: string]: any };
        t.position = 'absolute';
        t.right = '-12px';
        t.bottom = '18px';
        t.width = '16px';
        t.height = '16px';
        t.background = '#ffffff';
        t.borderRight = '3px solid #00776d';
        t.borderBottom = '3px solid #00776d';
        t.transform = 'rotate(-45deg)';
        bubble.appendChild(tail);

        const bubbleText = document.createElement('div');
        bubbleText.textContent = 'Psst… here’s my little secret — I can’t jump, but oh boy, I can roll like a pro!';
        const bt = bubbleText.style as CSSStyleDeclaration & { [key: string]: any };
        bt.margin = '0';
        bt.display = 'block';
        bt.lineHeight = '1';
        bubble.appendChild(bubbleText);

        pageEl.appendChild(bubble);
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
        span.style.fontFamily = "'Fredoka', Arial, Helvetica, system-ui, -apple-system, sans-serif";
        span.style.fontWeight = '400';
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
        instr.style.fontFamily = "'Fredoka', Arial, Helvetica, system-ui, -apple-system, sans-serif";
        instr.style.fontWeight = '400';
        instr.style.letterSpacing = '0.5px';
        instr.style.marginTop = '10px';
      });

      // PDF styling for topic line (larger than instruction)
      Array.from(clone.querySelectorAll('.pdf-topic')).forEach(el => {
        const topic = el as HTMLElement;
        topic.style.fontSize = '28px';
        topic.style.fontFamily = "'Fredoka', Arial, Helvetica, system-ui, -apple-system, sans-serif";
        topic.style.fontWeight = '800';
        topic.style.color = '#0f766e';
        topic.style.letterSpacing = '0.4px';
        topic.style.marginBottom = '12px';
      });

      // PDF-only: Insert a simple Name line at the very top of content
      Array.from(clone.querySelectorAll('.worksheet-page')).forEach(page => {
        const main = page.querySelector('main');
        if (!main) return;
        const content = main.querySelector('.relative.z-10') as HTMLElement | null;
        const target = content || main;
        const nameRow = document.createElement('div');
        nameRow.setAttribute('aria-hidden', 'false');
        const style = nameRow.style as CSSStyleDeclaration & { [key: string]: any };
        style.display = 'flex';
        style.alignItems = 'center';
        style.gap = '12px';
        style.margin = '4px 6px 8px 6px';
        style.fontFamily = "'Fredoka', Arial, Helvetica, system-ui, -apple-system, sans-serif";
        style.fontWeight = '800';
        style.color = '#0f766e';
        style.fontSize = '24px';

        const label = document.createElement('span');
        label.textContent = 'Name:';
        // const line = document.createElement('div');
        // const lineStyle = line.style as CSSStyleDeclaration & { [key: string]: any };
        // lineStyle.flex = '1';
        // lineStyle.borderBottom = '3px solid rgba(15,118,110,0.7)';
        // lineStyle.height = '0px';
        // lineStyle.marginLeft = '4px';
        // lineStyle.minWidth = '240px';
        nameRow.appendChild(label);
        // nameRow.appendChild(line);
        target.insertBefore(nameRow, target.firstChild);
      });

      // PDF-only: branding bottom-left (word with link below)
      Array.from(clone.querySelectorAll('.worksheet-page')).forEach(page => {
        const pageEl = page as HTMLElement;
        if (getComputedStyle(pageEl).position === 'static') {
          pageEl.style.position = 'relative';
        }
        const brand = document.createElement('div');
        const bstyle = brand.style as CSSStyleDeclaration & { [key: string]: any };
        bstyle.position = 'absolute';
        bstyle.left = '16px';
        bstyle.bottom = '35px';
        bstyle.display = 'flex';
        bstyle.flexDirection = 'column';
        bstyle.gap = '10px';
        bstyle.fontFamily = "'Fredoka', Arial, Helvetica, system-ui, -apple-system, sans-serif";
        bstyle.zIndex = '5';
        bstyle.pointerEvents = 'none';

        const word = document.createElement('div');
        const wstyle = word.style as CSSStyleDeclaration & { [key: string]: any };
        wstyle.fontWeight = '900';
        wstyle.fontSize = '48px';
        wstyle.lineHeight = '1';
        wstyle.display = 'inline-flex';
        wstyle.alignItems = 'baseline';
        // Build Read (white) + Kraft (yellow)
        const readSpan = document.createElement('span');
        readSpan.textContent = 'Read';
        const rstyle = readSpan.style as CSSStyleDeclaration & { [key: string]: any };
        rstyle.color = '#00776d';
        rstyle.textShadow = 'none';

        const kraftSpan = document.createElement('span');
        kraftSpan.textContent = 'Kraft';
        const kstyle = kraftSpan.style as CSSStyleDeclaration & { [key: string]: any };
        kstyle.color = '#00776d';
        kstyle.marginLeft = '0px';
        kstyle.textShadow = 'none';

        word.appendChild(readSpan);
        word.appendChild(kraftSpan);

        brand.appendChild(word);
        pageEl.appendChild(brand);

        // After word is laid out, align URL so its first and last chars align with word edges
        const wordWidth = word.getBoundingClientRect().width;
        const linkRow = document.createElement('div');
        const lrStyle = linkRow.style as CSSStyleDeclaration & { [key: string]: any };
        lrStyle.display = 'flex';
        lrStyle.justifyContent = 'space-between';
        lrStyle.alignItems = 'baseline';
        lrStyle.width = `${wordWidth}px`;
        lrStyle.fontFamily = "'Fredoka', Arial, Helvetica, system-ui, -apple-system, sans-serif";
        lrStyle.fontWeight = '400';
        lrStyle.fontSize = '28px';
        lrStyle.color = '#00776d';
        lrStyle.lineHeight = '1.05';
        lrStyle.marginTop = '6px';

        const urlText = 'www.readkraft.com';
        for (const ch of urlText.split('')) {
          const s = document.createElement('span');
          s.textContent = ch;
          const ss = s.style as CSSStyleDeclaration & { [key: string]: any };
          ss.display = 'inline-block';
          ss.flex = '0 0 auto';
          linkRow.appendChild(s);
        }

        brand.appendChild(linkRow);
      });

      // PDF-only: make 5th question panel transparent (panel bg/border, image, letters, answer boxes)
      Array.from(clone.querySelectorAll('.worksheet-page')).forEach(page => {
        const scrambledRows = Array.from(page.querySelectorAll('.pdf-scrambled-row')) as HTMLElement[];
        if (scrambledRows.length >= 5) {
          const fifthCard = scrambledRows[4].closest('div.relative') as HTMLElement | null;
          if (fifthCard) {
            // Panel background/border transparent (keep layout)
            (fifthCard.style as any).background = 'transparent';
            (fifthCard.style as any).backgroundImage = 'none';
            (fifthCard.style as any).borderColor = 'transparent';
            (fifthCard.style as any).boxShadow = 'none';

            // Scrambled letters text transparent
            const letters = fifthCard.querySelectorAll('.pdf-letter');
            letters.forEach(el => { (el as HTMLElement).style.color = 'transparent'; });

            // Image transparent
            const imageBox = fifthCard.querySelector('.pdf-image-box') as HTMLElement | null;
            if (imageBox) { imageBox.style.opacity = '0'; }

            // Answer boxes transparent (keep spacing)
            const answerBoxes = fifthCard.querySelectorAll('.pdf-answer-box');
            answerBoxes.forEach(el => {
              const box = el as HTMLElement;
              box.style.backgroundColor = 'transparent';
              box.style.borderColor = 'transparent';
              box.style.boxShadow = 'none';
              box.style.opacity = '0';
            });
          }
        }
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

      // Ensure cloned images attempt CORS-safe loads (including the added sticker)
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

        // Explicitly draw bottom border (some renderers clip it by ~1px)
        try {
          const cs = getComputedStyle(pageEl);
          const bwTop = parseFloat(cs.borderTopWidth || '0') || 0;
          const bwBottom = parseFloat(cs.borderBottomWidth || '0') || 0;
          const borderWidthPx = (bwBottom || bwTop || 8);
          const borderColorCss = cs.borderBottomColor || cs.borderTopColor || 'rgb(20,184,166)';
          const match = borderColorCss.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          let r = 20, g = 184, b = 166;
          if (match) {
            r = parseInt(match[1], 10);
            g = parseInt(match[2], 10);
            b = parseInt(match[3], 10);
          }
          const scaledLineWidth = borderWidthPx * (scaleToA4 < 1 ? scaleToA4 : 1);
          pdf.setDrawColor(r, g, b);
          pdf.setLineWidth(scaledLineWidth);
          // draw inside page bounds to avoid cropping
          const inset = scaledLineWidth / 2;
          pdf.line(inset, pageHeightPx - inset, pageWidthPx - inset, pageHeightPx - inset);
        } catch {}
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
      <div className="relative z-10" style={{fontFamily:'system-ui, -apple-system, sans-serif'}}>
        <div className="flex gap-6 items-start">
          <div className="flex-1" ref={worksheetRef}>
        {Array.from({ length: Math.ceil(puzzles.length / 5) }).map((_, pageIndex) => {
          const start = pageIndex * 5;
          const end = start + 5;
          const pagePuzzles = puzzles.slice(start, end);
          return (
            <div
              key={pageIndex}
              className="worksheet-page w-[820px] md:w-[860px] mx-auto bg-card rounded-3xl shadow-2xl border-[8px] border-primary/80 overflow-hidden"
              style={{
                ...(pageIndex < Math.ceil(puzzles.length / 5) - 1 ? { pageBreakAfter: 'always' } : {}),
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
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={generateAll}
                          variant="outline"
                          disabled={isGeneratingAll}
                          className="print:hidden mt-2 h-10 px-3 rounded-xl border-[3px] border-white bg-white/90 text-primary-foreground btn-animate shadow-[0_4px_0_rgba(0,0,0,0.25)]"
                          aria-label="Generate images for all questions"
                          title="Generate all images"
                        >
                          {isGeneratingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          {isGeneratingAll ? 'Generating…' : 'Generate All'}
                        </Button>
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
                      </div>
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
              Consonant blends
            </h3>
            <p className="pdf-instruction text-center text-lg md:text-xl text-foreground mb-6 md:mb-8" style={{fontWeight:400}}>
            Unscramble the letters to name the pictures!
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
                        <div className="absolute top-2 right-2 flex items-center gap-2 print:hidden">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!loadingMap[start + index] || isGeneratingAll}
                            onClick={() => retryOne(start + index)}
                            className="h-7 px-2 rounded-lg border-[2px] bg-white/90"
                            title="Retry image"
                            aria-label="Retry image"
                          >
                            {loadingMap[start + index] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPromptEditor(start + index)}
                            className="h-7 px-2 rounded-lg border-[2px] bg-white/90"
                            title="Edit prompt"
                            aria-label="Edit prompt"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
                                <span className="pdf-letter text-2xl md:text-3xl text-primary">
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
                        <div className="absolute top-2 right-2 flex items-center gap-2 print:hidden">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!loadingMap[start + index] || isGeneratingAll}
                            onClick={() => retryOne(start + index)}
                            className="h-7 px-2 rounded-lg border-[2px] bg-white/90"
                            title="Retry image"
                            aria-label="Retry image"
                          >
                            {loadingMap[start + index] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPromptEditor(start + index)}
                            className="h-7 px-2 rounded-lg border-[2px] bg-white/90"
                            title="Edit prompt"
                            aria-label="Edit prompt"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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

          {/* Prompt editor (outside worksheet area) */}
          <aside className="w-[360px] hidden lg:block print:hidden sticky top-8 self-start bg-white/80 backdrop-blur border-2 border-primary/20 rounded-xl shadow-lg p-4">
            <div className="mb-3">
              <div className="text-sm font-semibold text-primary mb-1">Image Prompt</div>
              <div className="text-xs text-muted-foreground">Select a card, edit the prompt, then send.</div>
            </div>
            <div className="mb-2 text-sm">
              {activePromptIndex !== null ? (
                <span>Editing for word: <span className="font-semibold">{puzzles[activePromptIndex]?.answer}</span></span>
              ) : (
                <span className="text-muted-foreground">No card selected</span>
              )}
            </div>
            <textarea
              className="w-full h-48 text-sm rounded-lg border-2 border-primary/30 p-2 outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              placeholder="Type your image prompt…"
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={sendCustomPrompt}
                disabled={activePromptIndex === null || isSendingPrompt}
                className="h-9 px-3 rounded-lg"
              >
                {isSendingPrompt ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {isSendingPrompt ? 'Sending…' : 'Send'}
              </Button>
              <Button
                variant="outline"
                disabled={activePromptIndex === null}
                onClick={() => {
                  if (activePromptIndex === null) return;
                  const word = (puzzles[activePromptIndex]?.answer || '').trim();
                  setPromptText(buildDefaultPrompt(word));
                }}
                className="h-9 px-3 rounded-lg"
              >
                Reset to Default
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}



