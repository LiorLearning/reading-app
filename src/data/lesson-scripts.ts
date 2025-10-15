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
        prompt: "Let\'s spell pond.",
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
        prompt: "Let’s spell bag.",
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
          prompt: "Let’s spell car.",
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
          prompt: "Let’s spell horn.",
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
          prompt: "Let’s spell her.",
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
          prompt: "Let’s spell bird.",
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
            prompt: "Let’s spell fur.",
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
  '2-J.1': {
    topicId: '2-J.1',
    title: 'Sneaky Silent E: Short and Long Vowel Sounds',
    intro: [
      'Let\'s meet sneaky e! It can make vowels say their names.',
    ],
    segments: [
      {
        modelWord: 'kit',
        modelSteps: [
          { highlights: [[0,1]], say: '"k" says /k/.' },
          { highlights: [[1,2]], say: '"i" says /ĭ/, the short \"i\" sound.' },
          { highlights: [[2,3]], say: '"t" says /t/.' },
          { highlights: [[0,3]], say: "/k/ /ĭ/ /t/ — 'kit', with the short /ĭ/!" }
        ],
        practice: {
          word: 'kit',
          prompt: "Let’s spell 'kit'",
          hints: [
            "Does the vowel say its name? No — it's short.",
            "Short i makes /ĭ/ (like 'sit', 'fish')."
          ],
          reinforce: "Nice! /k/ /ĭ/ /t/ — with the short /ĭ/.",
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Nice job! The word 'kit' has a short i sound.",
            aiHook: {
              targetWord: 'kit',
              intent: 'fill_blank',
              questionLine: "Listen to the word 'kit'. Does it have a short or long vowel sound?",
              imagePrompt: 'A small first-aid kit on a table for the word kit'
            },
            aiTutor: {
              target_word: 'kit',
              question: "Listen carefully to the word 'kit'. Does the vowel say its name or make a short sound?",
              student_entry: '',
              topic_to_reinforce: 'Sort short and long vowel sounds',
              spelling_pattern_or_rule:
                "The vowel i is short in 'kit' because there’s no silent e at the end. Short vowels make quick sounds — /ĭ/ in 'kit'."
            },
            audio: 'kit'
          }
        }
      },
      {
        modelWord: 'kite',
        modelSteps: [
          { highlights: [[0,1]], say: '"k" says /k/.' },
          { highlights: [[1,2]], say: '"i" says /ī/ — because of the "e" at the end!' },
          { highlights: [[2,3]], say: '"t" says /t/.' },
          { highlights: [[3,4]], say: '"e" is silent, but it changes the /ĭ/ to a long /ī/. Sneaky e!' },
          { highlights: [[0,4]], say: "/k/ /ī/ /t/ — 'kite'." }
        ],
        practice: {
          word: 'kite',
          prompt: "Let’s spell 'kite'",
          hints: [
            'There’s a silent e — it doesn’t talk, but it changes the vowel.',
            'Now i says its name: /ī/. '
          ],
          reinforce: "Excellent! Sneaky e made the i long in 'kite'.",
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Excellent! The word 'kite' has a long i sound made by the sneaky silent e.",
            aiHook: {
              targetWord: 'kite',
              intent: 'fill_blank',
              questionLine: "Listen to the word 'kite'. Does it have a short or long vowel sound?",
              imagePrompt: 'A bright red kite flying high in the blue sky for the word kite'
            },
            aiTutor: {
              target_word: 'kite',
              question: "Listen carefully to the word 'kite'. Does the vowel say its name or make a short sound?",
              student_entry: '',
              topic_to_reinforce: 'Sort short and long vowel sounds',
              spelling_pattern_or_rule:
                "Add a silent e to the end and the vowel says its name. 'Kit' becomes 'kite' — short i turns into long i."
            },
            audio: 'kite'
          }
        }
      }
    ],
    completion: [
      'Sneaky e spotted! You turned short i into long i.',
      'Awesome work — ready for another vowel pair?'
    ],
    rewards: { coins: 2 }
  },
  '2-K.2': {
    topicId: '2-K.2',
    title: 'Long A Patterns: ai & ay',
    intro: [
      "Meet long A teams: 'ai' and 'ay'."
    ],
    segments: [
      // --- Segment 1: ray (AY at the end) ---
      {
        modelWord: 'ray',
        modelSteps: [
          { highlights: [[0,1]], say: '"r" says /r/.' },
          { highlights: [[1,3]], say: "'ay' makes /ā/." },
          { highlights: [[0,3]], say: "/r/ /ā/ → 'ray'. We usually use 'ay' at the end for the long /ā/ sound." }
        ],
        practice: {
          word: 'ray',
          prompt: "Let’s spell 'ray'.",
          hints: [
            "Use 'ay' when /ā/ is at the end (day, play, ray).",
            "Say it and check: r + ay → 'ray'."
          ],
          reinforce: "Great! 'ay' makes /ā/ — /r/ /ā/ = 'ray'.",
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Nice! The word is 'ray' (long A spelled with 'ay' at the end).",
            aiHook: {
              targetWord: 'ray',
              intent: 'fill_blank',
              questionLine: 'r__',
              imagePrompt: 'A sunbeam (ray) shining through clouds'
            },
            aiTutor: {
              target_word: 'ray',
              question: 'r__',
              student_entry: '',
              topic_to_reinforce: 'Spell the long A word',
              spelling_pattern_or_rule:
                "Use 'ay' to spell the long A /ā/ at the END of a word (day, play, ray). Use 'ai' in the MIDDLE (rain, train). Use a_e when there’s a silent e (cake, name). Trick: “AI stays inside, AY says goodbye!”"
            },
            audio: 'ray'
          }
        }
      },
      // --- Segment 2: rain (AI in the middle) ---
      {
        modelWord: 'rain',
        modelSteps: [
          { highlights: [[0,1]], say: '"r" says /r/.' },
          { highlights: [[1,3]], say: "'ai' makes /ā/." },
          { highlights: [[3,4]], say: '"n" says /n/.' },
          { highlights: [[0,4]], say: "/r/ /ā/ /n/ → 'rain'. We usually use 'ai' in the middle for the long /ā/ sound." }
        ],
        practice: {
          word: 'rain',
          prompt: "Let’s spell 'rain'. Which letters make the /ā/ in the middle?",
          hints: [
            "Use 'ai' when /ā/ is inside the word (rain, train, chain).",
            "Say it and check: r + ai + n → 'rain'."
          ],
          reinforce: "Yes! 'ai' makes /ā/ — /r/ /ā/ /n/ = 'rain'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 3] } as any ),
          meta: {
            explanation: "Excellent! The word is 'rain' (long A spelled with 'ai' in the middle).",
            aiHook: {
              targetWord: 'rain',
              intent: 'fill_blank',
              questionLine: 'r__n',
              imagePrompt: 'Rain falling from clouds with puddles'
            },
            aiTutor: {
              target_word: 'rain',
              question: 'r__n',
              student_entry: '',
              topic_to_reinforce: 'Spell the long A word',
              spelling_pattern_or_rule:
                "Use 'ai' to spell the long A /ā/ in the MIDDLE of a word (rain, train, paint). Use 'ay' at the END (day, play). Trick: “AI stays inside, AY says goodbye!”"
            },
            audio: 'rain'
          }
        }
      }
    ],
    completion: [
      "Pattern power! You found 'ai' in the middle and 'ay' at the end for long A.",
      'Awesome spelling — ready to explore more long vowels?'
    ],
    rewards: { coins: 2 }
  },
};

export function getLessonScript(topicId: string): LessonScript | null {
  return lessonScripts[topicId] || null;
}


