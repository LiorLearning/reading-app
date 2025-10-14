// Minimal lesson script schema and a single 1-H.1 script entry
// This is intentionally lightweight so we can iterate on content without touching code.

export type LessonPractice = {
  word: string;
  prompt: string;
  hints?: string[];
  // Optional explicit phoneme reinforcement line. If omitted, UI will fallback to heuristic.
  reinforce?: string;
};

export type LessonModel = {
  word: string;
  // highlight range [start, end) for the blend within the model word
  highlight: [number, number];
  voice: string[]; // short lines to speak/show
  tapAffordances?: { target: string; says: string }[];
};

export type LessonSegment = {
  modelWord: string;
  modelSteps: { highlights: [number, number][], say: string }[];
  practice: LessonPractice;
};

export type LessonScript = {
  topicId: string;
  title: string;
  intro: string[];
  model?: LessonModel; // legacy single-step model (back-compat)
  modelWord?: string;  // new multi-step word
  modelSteps?: { highlights: [number, number][], say: string }[]; // new multi-step model
  segments?: LessonSegment[]; // optional segmented lessons (each has model+practice)
  practice?: LessonPractice[]; // 1-3 short checks (non-segment lessons)
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
        reinforce: 'Great, /gr/ /a/ /b/, grab.',
        // Prefill a-b so UI shows gr a b with g/r implied by instruction (optional)
        // extra fields used by WhiteboardLesson (not part of static type)
        ...( { isPrefilled: true, prefilledIndexes: [2, 3] } as any ),
      },
    ],
    completion: ['Nice blending! You built two words.', 'Ready to continue the adventure?'],
    rewards: { coins: 2 },
  },
  '1-H.4': {
    topicId: '1-H.4',
    title: 'Final consonant blends',
    intro: [
      "You'll learn how sounds blend at the end of a word, like in 'pond'."
    ],
    modelWord: 'pond',
    modelSteps: [
      { highlights: [[2,3]], say: '"n" says /n/.' },
      { highlights: [[3,4]], say: '"d" says /d/.' },
      { highlights: [[2,4]], say: "Together, they say /nd/ in 'pond'." },
    ],
    practice: [
      {
        word: 'pond',
        prompt: "Let's finish the word 'po__'.",
        hints: [
          'Listen: you hear /n/ and /d/ at the end.',
          "'nd' is the final blend joining /n/ and /d/."
        ],
        reinforce: 'Great, /p/ /o/ /nd/, pond.',
        ...( { isPrefilled: true, prefilledIndexes: [0,1] } as any ),
      },
    ],
    completion: ['Great job with final blends!', 'Ready for the next lesson?'],
    rewards: { coins: 2 },
  },
  '1-I.3': {
    topicId: '1-I.3',
    title: 'Short A Words',
    intro: [
      "You'll learn the short a sound in words like 'bag'."
    ],
    modelWord: 'bag',
    modelSteps: [
      { highlights: [[0,1]], say: '"b" says /b/.' },
      { highlights: [[1,2]], say: '"a" says /æ/.' },
      { highlights: [[2,3]], say: '"g" says /g/.' },
      { highlights: [[0,3]], say: "Together: /b/ /æ/ /g/ /bæg/." },
    ],
    practice: [
      {
        word: 'bag',
        prompt: "Let’s complete 'b_g'.",
        hints: [
          'Listen for the short /a/ sound in the middle.',
          'Spell it with the letter “a”.'
        ],
        reinforce: 'Great, /b/ /a/ /g/, bag.',
        ...( { isPrefilled: true, prefilledIndexes: [0, 2] } as any ),
      },
    ],
    completion: [
      "Nice work hearing the short 'a'!",
      "Ready for the next word?"
    ],
    rewards: { coins: 2 },
  },
  '1-T.2.1': {
    topicId: '1-T.2.1',
    title: 'R-sounds with "ar" and "or"',
    intro: [
      "Learn the r-sounds in 'car' and 'horn'."
    ],
    segments: [
      {
        modelWord: 'car',
        modelSteps: [
          { highlights: [[0,1]], say: '"c" says /k/.' },
          { highlights: [[1,3]], say: "'ar' says /ar/." },
          { highlights: [[0,3]], say: "Together: /k/ /ar/ 'car'." },
        ],
        practice: {
          word: 'car',
          prompt: "Complete the word: 'c__'.",
          hints: [
            'Listen for /ar/ after /k/.',
            "Spell the /ar/ sound with 'ar'."
          ],
          reinforce: 'Great, /k/ /ar/, car.',
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
        }
      },
      {
        modelWord: 'horn',
        modelSteps: [
          { highlights: [[0,1]], say: '"h" says /h/.' },
          { highlights: [[1,3]], say: "'o''r' says /or/." },
          { highlights: [[3,4]], say: '"n" says /n/.' },
          { highlights: [[0,4]], say: "Together: /h/ /or/ /n/ 'horn'." },
        ],
        practice: {
          word: 'horn',
          prompt: "Complete the word: 'h__n'.",
          hints: [
            'Hear the /or/ in the middle.',
            "Spell the /or/ sound with 'or'."
          ],
          reinforce: 'Great, /h/ /or/ /n/, horn.',
          ...( { isPrefilled: true, prefilledIndexes: [0,3] } as any ),
        }
      }
    ],
    completion: [
      "Great job with r-controlled vowels!",
      'Ready for the next lesson?'
    ],
    rewards: { coins: 2 },
  },
  '1-T.2.2': {
    topicId: '1-T.2.2',
    title: 'R-Controlled Vowels: er & ir',
    intro: [
      "Learn the /ər/ sound spelled 'er' and 'ir'."
    ],
    segments: [
      {
        modelWord: 'her',
        modelSteps: [
          { highlights: [[0,1]], say: '"h" says /h/.' },
          { highlights: [[1,3]], say: "'e''r' says /ər/." },
          { highlights: [[0,3]], say: "Together: /h/ /ər/ 'her'." }
        ],
        practice: {
          word: 'her',
          prompt: "Complete the word: 'h__'.",
          hints: [
            'Listen for /ər/ after /h/.',
            "Spell the /ər/ sound with 'er'."
          ],
          reinforce: 'Great, /h/ /ər/, her.',
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Great job! The word is 'her'.",
            aiHook: {
              targetWord: 'her',
              intent: 'fill_blank',
              questionLine: 'Complete the word: h__',
              imagePrompt: 'Educational scene showing er r-controlled vowel concepts'
            },
            aiTutor: {
              target_word: 'her',
              question: 'h _ _',
              student_entry: '',
              topic_to_reinforce: "R-controlled vowel sound /ər/ (spelled 'er')",
              spelling_pattern_or_rule: "The letters 'er' often make the same /ər/ sound as 'ir' — as in 'her', 'fern', and 'butter'."
            },
            audio: 'her'
          }
        }
      },
      {
        modelWord: 'bird',
        modelSteps: [
          { highlights: [[0,1]], say: '"b" says /b/.' },
          { highlights: [[1,3]], say: "'i''r' says /ər/." },
          { highlights: [[3,4]], say: '"d" says /d/.' },
          { highlights: [[0,4]], say: "Together: /b/ /ər/ /d/ 'bird'." }
        ],
        practice: {
          word: 'bird',
          prompt: "Complete the word: 'b__d'.",
          hints: [
            'Hear the /ər/ in the middle.',
            "Spell the /ər/ sound with 'ir'."
          ],
          reinforce: 'Great, /b/ /ər/ /d/, bird.',
          ...( { isPrefilled: true, prefilledIndexes: [0, 3] } as any ),
          meta: {
            explanation: "Excellent! The word is 'bird'.",
            aiHook: {
              targetWord: 'bird',
              intent: 'fill_blank',
              questionLine: 'Complete the word: b__d',
              imagePrompt: 'Educational scene showing ir r-controlled vowel concepts'
            },
            aiTutor: {
              target_word: 'bird',
              question: 'b _ _ d',
              student_entry: '',
              topic_to_reinforce: "R-controlled vowel sound /ər/ (spelled 'ir')",
              spelling_pattern_or_rule: "The letters 'ir' often make the same /ər/ sound as 'er' — as in 'bird', 'stir', and 'girl'."
            },
            audio: 'bird'
          }
        }
      }
    ],
    completion: [
      'Great work with er and ir!',
      'Ready for the next lesson?'
    ],
    rewards: { coins: 2 },
  },
  '1-T.2.3': {
    topicId: '1-T.2.3',
    title: 'R-Controlled Vowels: ur',
    intro: [
      "You'll learn words that contain 'ur'."
    ],
    segments: [
      {
        modelWord: 'fur',
        modelSteps: [
          { highlights: [[0,1]], say: '"f" says /f/.' },
          { highlights: [[1,3]], say: "'u''r' says /ər/." },
          { highlights: [[0,3]], say: "Together: /f/ /ər/ 'fur'." }
        ],
        practice: {
          word: 'fur',
          prompt: "Complete the word: 'f__'.",
          hints: [
            'Listen for the /ər/ sound after /f/.',
            "Spell the /ər/ sound with 'ur'."
          ],
          reinforce: 'Great, /f/ /ər/, fur.',
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "That's right! The word is 'fur'.",
            aiHook: {
              targetWord: 'fur',
              intent: 'fill_blank',
              questionLine: 'Complete the word: f__',
              imagePrompt: 'Educational scene showing ur r-controlled vowel concepts'
            },
            aiTutor: {
              target_word: 'fur',
              question: 'f _ _',
              student_entry: '',
              topic_to_reinforce: "R-controlled vowel sound /ər/ (spelled 'ur')",
              spelling_pattern_or_rule: "The letters 'ur' often make the same /ər/ sound as 'er' and 'ir' — as in 'fur', 'burn', and 'hurt'."
            },
            audio: 'fur'
          }
        }
      }
    ],
    completion: [
      'Nice job with ur words!',
      'Ready for the next lesson?'
    ],
    rewards: { coins: 2 },
  },
};

export function getLessonScript(topicId: string): LessonScript | null {
  return lessonScripts[topicId] || null;
}


