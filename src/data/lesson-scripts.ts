// Minimal lesson script schema and a single 1-H.1 script entry
// This is intentionally lightweight so we can iterate on content without touching code.

export type LessonPractice = {
  word: string;
  prompt: string;
  hints?: string[];
};

export type LessonModel = {
  word: string;
  // highlight range [start, end) for the blend within the model word
  highlight: [number, number];
  voice: string[]; // short lines to speak/show
  tapAffordances?: { target: string; says: string }[];
};

export type LessonScript = {
  topicId: string;
  title: string;
  intro: string[];
  model?: LessonModel; // legacy single-step model (back-compat)
  modelWord?: string;  // new multi-step word
  modelSteps?: { highlights: [number, number][], say: string }[]; // new multi-step model
  practice: LessonPractice[]; // 1-3 short checks
  completion: string[];
  rewards?: { coins?: number };
};

export const lessonScripts: Record<string, LessonScript> = {
  '1-H.1': {
    topicId: '1-H.1',
    title: 'Consonant blends',
    intro: [
      'You will learn consonant blends in words like grab.'
    ],
    modelWord: 'grab',
    modelSteps: [
      { highlights: [[0,1]], say: '"g" says /g/.' },
      { highlights: [[1,2]], say: '"r" says /r/.' },
      { highlights: [[0,2]], say: "Together, they say /gr/ in 'grab'." },
    ],
    practice: [
      {
        word: 'grab',
        prompt: 'Let\'s spell grab.',
        hints: ['Listen: it starts with gr.', 'gr blends /g/ and /r/.'],
        // Prefill a-b so UI shows gr a b with g/r implied by instruction (optional)
        // extra fields used by WhiteboardLesson (not part of static type)
        ...( { isPrefilled: true, prefilledIndexes: [2, 3] } as any ),
      },
    ],
    completion: ['Nice blending! You built two words.', 'Ready to continue the adventure?'],
    rewards: { coins: 2 },
  },
};

export function getLessonScript(topicId: string): LessonScript | null {
  return lessonScripts[topicId] || null;
}


