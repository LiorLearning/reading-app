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
  emoji?: string; // optional visual emoji for the model word
  familyExamples?: {
    title: string;
    words: { word: string; emoji?: string }[];
    voiceSteps: { highlights: [number, number][], say: string; targetIndex?: number }[];
  };
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
  'K-O.3': {
  topicId: 'K-O.3',
  title: "Short a /ă/: CVC (cat)",
  intro: [
    "You will practice the short a sound in words like cat."
  ],
  segments: [
    // --- Single Segment — model/practice: cat (no family words) ---
    {
      modelWord: 'cat',
      emoji: '🐱',
      modelSteps: [
        { highlights: [],       say: "In short a words, the vowel 'a' says /æ/." },
        { highlights: [[0,1]],  say: '"c" says /k/.' },
        { highlights: [[1,2]],  say: '"a" says /æ/.' },
        { highlights: [[2,3]],  say: '"t" says /t/.' },
        { highlights: [[0,3]],  say: "/k/ /æ/ /t/ 'cat'." }
      ],
      practice: {
        word: 'cat',
        prompt: "Let's spell 'cat'.",
        hints: [
          "Listen for /k/ /æ/ /t/.",
          "Fill the first two letters to make the CVC word."
        ],
        reinforce: "Great! /k/ /æ/ /t/ — 'cat'.",
        ...( { isPrefilled: true, prefilledIndexes: [0,2] } as any ),
        meta: {
          explanation: "Nice! The short a /æ/ is in the middle of the CVC word 'cat'.",
          aiHook: {
            targetWord: 'cat',
            intent: 'fill_blank',
            questionLine: 'c_t',
            imagePrompt: 'A cute orange kitten sitting and looking at the viewer'
          },
          aiTutor: {
            target_word: 'cat',
            question: 'c_t',
            student_entry: '',
            topic_to_reinforce: 'Complete the short a word',
            spelling_pattern_or_rule:
              "Short a says /æ/ in CVC words (consonant-vowel-consonant). Blend the sounds to spell the word."
          },
          audio: 'cat'
        }
      }
    }
  ],
  completion: [
    "Pattern check: In CVC words like 'cat', the middle 'a' says short /æ/.",
    "Awesome work—ready for more short a words next?"
  ],
  rewards: { coins: 1 }
},
'K-P.2': {
  topicId: 'K-P.2',
  title: "Short e /ĕ/: CVC (red)",
  intro: [
    "You will practice the short e sound in words like red."
  ],
  segments: [
    // --- Single Segment — model/practice: red ---
    {
      modelWord: 'red',
      emoji: '🟥',
      modelSteps: [
        { highlights: [],       say: "In short e words, the vowel 'e' says /ĕ/." },
        { highlights: [[0,1]],  say: '"r" says /r/.' },
        { highlights: [[1,2]],  say: "'e' says /ĕ/." },
        { highlights: [[2,3]],  say: '"d" says /d/.' },
        { highlights: [[0,3]],  say: "/r/ /ĕ/ /d/ — 'red'." }
      ],
      practice: {
        word: 'red',
        prompt: "Let’s spell 'red'.",
        hints: [
          "Listen for /r/ /ĕ/ /d/.",
          "Fill the missing first sound to make the word."
        ],
        reinforce: "Nice! /r/ /ĕ/ /d/ — 'red'.",
        ...( { isPrefilled: true, prefilledIndexes: [0,2] } as any ),
        meta: {
          explanation: "Good work! The middle 'e' says short /ĕ/ in the word 'red'.",
          aiHook: {
            targetWord: 'red',
            intent: 'fill_blank',
            questionLine: 'r_d',
            imagePrompt: 'A bright red paintbrush painting a red line'
          },
          aiTutor: {
            target_word: 'red',
            question: 'r_d',
            student_entry: '',
            topic_to_reinforce: 'Complete the short e word',
            spelling_pattern_or_rule:
              "In CVC short e words, 'e' says /ĕ/. Blend the sounds together to spell the full word."
          },
          audio: 'red'
        }
      }
    }
  ],
  completion: [
    "Pattern check: In CVC words like 'red', the middle 'e' says short /ĕ/.",
    "Awesome! You’re learning how vowels sound in the middle of short words."
  ],
  rewards: { coins: 1 }
},
'K-Q.2': {
  topicId: 'K-Q.2',
  title: "Short i /ĭ/: CVC (kit)",
  intro: [
    "You will practice the short i sound in words like kit."
  ],
  segments: [
    // --- Single Segment — model/practice: kit ---
    {
      modelWord: 'kit',
      emoji: '🧰',
      modelSteps: [
        { highlights: [],       say: "In short i words, the vowel 'i' says /ĭ/." },
        { highlights: [[0,1]],  say: '"k" says /k/.' },
        { highlights: [[1,2]],  say: '"i" says /ĭ/.' },
        { highlights: [[2,3]],  say: '"t" says /t/.' },
        { highlights: [[0,3]],  say: "/k/ /ĭ/ /t/ — 'kit'." }
      ],
      practice: {
        word: 'kit',
        prompt: "Let’s spell 'kit'.",
        hints: [
          "Listen for /k/ /ĭ/ /t/.",
          "Fill the missing middle vowel with 'i'."
        ],
        reinforce: "Nice! /k/ /ĭ/ /t/ — 'kit'.",
        ...( { isPrefilled: true, prefilledIndexes: [0,2] } as any ),
        meta: {
          explanation: "Great! The middle short i /ĭ/ completes the CVC word 'kit'.",
          aiHook: {
            targetWord: 'kit',
            intent: 'fill_blank',
            questionLine: 'k_t',
            imagePrompt: 'A small toolkit with simple tools arranged neatly'
          },
          aiTutor: {
            target_word: 'kit',
            question: 'k_t',
            student_entry: '',
            topic_to_reinforce: 'Complete the short i word',
            spelling_pattern_or_rule:
              "In CVC short i words, the middle 'i' says /ĭ/. Blend the sounds to spell the word."
          },
          audio: 'kit'
        }
      }
    }
  ],
  completion: [
    "Pattern check: In CVC words like 'kit', the middle 'i' says short /ĭ/.",
    "Awesome! You’re getting strong at hearing and spelling short vowels."
  ],
  rewards: { coins: 1 }
},
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
      "You will learn r-sounds in words like 'car' and 'horn'."
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
      "You will learn r sounds like her and bird."
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
            explanation: "Great job! 'e''r' says /ər/ in 'her'.",
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
            explanation: "Excellent! 'i''r' says /ər/ in 'bird'.",
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
      "You'll learn sounds in words like fur."
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
      'You will learn about sneaky e! It can make vowels say their names.',
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
          { highlights: [[1,2]], say: '"i" says /ī/ and not /ĭ/ — because of the "e" at the end!' },
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
      "You will learn about long A sounds in words like ray and rain."
    ],
    segments: [
      // --- Segment 1: ray (AY at the end) ---
      {
        modelWord: 'ray',
        modelSteps: [
          { highlights: [[0,1]], say: '"r" says /r/.' },
          { highlights: [[1,3]], say: "'a''y' makes /ā/." },
          { highlights: [[0,3]], say: "/r/ /ā/ → 'ray'. We usually use 'ay' at the end for the long /ā/ sound." }
        ],
        practice: {
          word: 'ray',
          prompt: "Let’s spell 'ray'.",
          hints: [
            "Use 'ay' when /ā/ is at the end (day, play, ray).",
            "Say it and check: r + ay → 'ray'."
          ],
          reinforce: "Great! /r//ā/ makes 'ray'.",
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
          prompt: "Let’s spell 'rain'.",
          hints: [
            "Use 'ai' when /ā/ is inside the word (rain, train, chain).",
            "Say it and check: r + ai + n → 'rain'."
          ],
          reinforce: "Yes! /r/ /ā/ /n/ makes 'rain'.",
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
    '2-K.3': {
    topicId: '2-K.3',
    title: 'Long E Patterns: ee & ea',
    intro: [
      "You will learn about long E sounds in words like bee and leaf."
    ],
    segments: [
      // --- Segment 1: EE Family (bee, see, tree, feet) ---
      {
        modelWord: 'bee',
        emoji: '🐝',
        modelSteps: [
          { highlights: [[0,1]], say: '"b" says /b/.' },
          { highlights: [[1,3]], say: "'e' and 'e' work together to make /ē/." },
          { highlights: [[0,3]], say: "/b/ /ē/ 'bee'! 'ee' often comes in the middle or end of short words." }
        ],
        familyExamples: {
          title: "Other 'ee' Family Words",
          words: [
            { word: 'see', emoji: '👀' },
            { word: 'tree', emoji: '🌳' },
            { word: 'feet', emoji: '🦶' }
          ],
          voiceSteps: [
            { highlights: [], say: "Let's look at some other 'ee' family words!" },
            { highlights: [[0,3]], say: "see'", targetIndex: 0 },
            { highlights: [[0,4]], say: "tree'", targetIndex: 1 },
            { highlights: [[0,4]], say: "feet'", targetIndex: 2 }
            
          ]
        },
        practice: {
          word: 'bee',
          prompt: "Let’s spell 'bee'.",
          hints: [
            "Use 'ee' to show the long /ē/ sound, like in 'see' and 'tree'.",
            "Say it slowly: /b/ + /ē/ → 'bee'."
          ],
          reinforce: "Great! /b/ /ē/ makes 'bee'.",
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Nice! The word is 'bee' (long E spelled with 'ee').",
            aiHook: {
              targetWord: 'bee',
              intent: 'fill_blank',
              questionLine: 'b__',
              imagePrompt: 'A buzzing yellow bee on a flower'
            },
            aiTutor: {
              target_word: 'bee',
              question: 'b__',
              student_entry: '',
              topic_to_reinforce: 'Spell the long E word',
              spelling_pattern_or_rule:
                "Use 'ee' to spell the long E /ē/ in the MIDDLE or END of short words (see, tree, bee). Both 'ee' and 'ea' say /ē/, but 'ee' is more common in smaller words."
            },
            audio: 'bee'
          }
        }
      },
      // --- Segment 2: EA Family (leaf, sea, eat) ---
      {
        modelWord: 'leaf',
        emoji: '🍃',
        modelSteps: [
          { highlights: [], say: "Now let's meet the other long E team — 'ea'! It also makes the /ē/ sound." },
          { highlights: [[0,1]], say: '"l" says /l/.' },
          { highlights: [[1,3]], say: "'e''a' work together to make the long /ē/." },
          { highlights: [[3,4]], say: '"f" says /f/.' },
          { highlights: [[0,4]], say: "/l/ /ē/ /f/ makes 'leaf'! 'ea' often appears at the start or middle of words." }
        ],
        familyExamples: {
          title: "Other 'ea' Family Words",
          words: [
            { word: 'sea', emoji: '🌊' },
            { word: 'eat', emoji: '🍽️' },
            { word: 'leaf', emoji: '🍃' }
          ],
          voiceSteps: [
            { highlights: [], say: "Now let’s meet the 'e''a' family!" },
            { highlights: [[0,3]], say: "'sea'", targetIndex: 0 },
            { highlights: [[0,3]], say: "'eat'", targetIndex: 1 },
            { highlights: [[0,4]], say: "And 'leaf'", targetIndex: 2 },
            { highlights: [], say: "So both 'ee' and 'ea' say /ē/" }
          ]
        },
        practice: {
          word: 'leaf',
          prompt: "Let’s spell 'leaf'.",
          hints: [
            "Use 'ea' for /ē/ when it’s in the middle (leaf, eat, sea).",
            "Say it slowly: /l/ + /ē/ + /f/ → 'leaf'."
          ],
          reinforce: "Excellent! /l/ /ē/ /f/ 'leaf'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 3] } as any ),
          meta: {
            explanation: "Awesome! The word is 'leaf' (long E spelled with 'ea').",
            aiHook: {
              targetWord: 'leaf',
              intent: 'fill_blank',
              questionLine: 'l__f',
              imagePrompt: 'A bright green leaf on a branch'
            },
            aiTutor: {
              target_word: 'leaf',
              question: 'l__f',
              student_entry: '',
              topic_to_reinforce: 'Spell the long E word',
              spelling_pattern_or_rule:
                "Use 'ea' to spell the long E /ē/ sound in the MIDDLE of a word (leaf, eat, sea). 'ee' and 'ea' both say /ē/, but 'ea' often appears in longer or middle-position words."
            },
            audio: 'leaf'
          }
        }
      }
    ],
    completion: [
      "Great job! Both 'ee' and 'ea' make the long E sound.",
      "Now you know: 'ee' loves the end, 'ea' likes the middle! 👏"
    ],
    rewards: { coins: 2 }
  },
  '2-K.4': {
    topicId: '2-K.4',
    title: 'Long I Patterns: y, ie & sneaky silent e',
    intro: [
      "You will learn about long I sounds in words like try and pie."
    ],
    segments: [
      // --- Segment 1: Y says /ī/ at the end (try, my, fly, cry) ---
      {
        modelWord: 'try',
        emoji: '💪',
        modelSteps: [
          { highlights: [[0,1]], say: '"t" says /t/.' },
          { highlights: [[1,2]], say: '"r" says /r/.' },
          { highlights: [[2,3]], say: '"y" says /ī/ at the end.' },
          { highlights: [[0,3]], say: "/t/ /r/ /ī/ → 'try'." }
        ],
        familyExamples: {
          title: "Other 'y' Family Words",
          words: [
            { word: 'my',  emoji: '🧒' },
            { word: 'fly', emoji: '🪰' },
            { word: 'cry', emoji: '😢' }
          ],
          voiceSteps: [
            { highlights: [],      say: "Let's look at other 'y' words that say /ī/ at the end." },
            { highlights: [[0,2]], say: "'my'.",   targetIndex: 0 },
            { highlights: [[0,3]], say: "'fly'", targetIndex: 1 },
            { highlights: [[0,3]], say: "'cry'", targetIndex: 2 }
          ]
        },
        practice: {
          word: 'try',
          prompt: "Let’s spell 'try'.",
          hints: [
            "At the end of short words, 'y' often says /ī/ (my, fly, cry, try).",
            'Blend it: /t/ + /r/ + /ī/.',
          ],
          reinforce: "Great! /t/ /r/ /ī/ 'try'.",
          ...( { isPrefilled: true, prefilledIndexes: [0,1] } as any ),
          meta: {
            explanation: "Nice! The word is 'try' (long I with 'y' at the end).",
            aiHook: {
              targetWord: 'try',
              intent: 'fill_blank',
              questionLine: 't r __',
              imagePrompt: 'A kid trying to reach a high shelf'
            },
            aiTutor: {
              target_word: 'try',
              question: 't r __',
              student_entry: '',
              topic_to_reinforce: 'Spell the long I word',
              spelling_pattern_or_rule:
                "Use 'y' to spell the long I /ī/ at the END of short words (my, fly, cry, try). 'ie' can also spell /ī/, usually at the end (pie, tie)."
            },
            audio: 'try'
          }
        }
      },
      // --- Segment 2: IE says /ī/ (pie, tie, die) ---
      {
        modelWord: 'pie',
        emoji: '🥧',
        modelSteps: [
          { highlights: [],       say: "Now let's meet another long I team — 'ie'! It also makes /ī/." },
          { highlights: [[0,1]],  say: '"p" says /p/.' },
          { highlights: [[1,3]],  say: "'i' and 'e' together say /ī/." },
          { highlights: [[0,3]],  say: "/p/ /ī/ 'pie'." }
        ],
        familyExamples: {
          title: "Other 'ie' Family Words",
          words: [
            { word: 'lie', emoji: '🤥' },
            { word: 'tie', emoji: '👔' }
          ],
          voiceSteps: [
            { highlights: [],      say: "Here are more 'ie' words that say /ī/." },
            { highlights: [[0,3]], say: "'lie'", targetIndex: 0 },
            { highlights: [[0,3]], say: "'tie'", targetIndex: 1 }
          ]
        },
        practice: {
          word: 'pie',
          prompt: "Let’s spell 'pie'.",
          hints: [
            "'ie' often spells /ī/ at the end of words (pie, tie, die).",
            'Blend it: /p/ + /ī/.',
          ],
          reinforce: "Excellent! /p/ /ī/ 'pie'.",
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Great! The word is 'pie' (long I with 'ie').",
            aiHook: {
              targetWord: 'pie',
              intent: 'fill_blank',
              questionLine: 'p __ __',
              imagePrompt: 'A tasty slice of pie on a plate'
            },
            aiTutor: {
              target_word: 'pie',
              question: 'p __ __',
              student_entry: '',
              topic_to_reinforce: 'Spell the long I word',
              spelling_pattern_or_rule:
                "Use 'ie' to spell the long I /ī/ at the END of words (pie, tie, die). Use 'y' for /ī/ at the end of short words (my, fly, cry, try). Sneaky silent e can also make long I (kite, time)."
            },
            audio: 'pie'
          }
        }
      },
      // --- Segment 3: Sneaky Silent E Review (kite) — direct to practice ---
      {
        modelWord: 'kite',
        emoji: '🪁',
        modelSteps: [],
        practice: {
          word: 'kite',
          prompt: "And finally, let’s spell 'kite' — remember the sneaky silent e?",
          hints: [
            'Sneaky e makes the vowel say its name.',
            "Say it slowly: /k/ /ī/ /t/ → 'kite'."
          ],
          reinforce: "Perfect! Sneaky e made the i long — 'kite'.",
          ...( { isPrefilled: true, prefilledIndexes: [0,2] } as any ),
          meta: {
            explanation: "Nice review! The word 'kite' uses the sneaky silent e to make i long.",
            aiHook: {
              targetWord: 'kite',
              intent: 'fill_blank',
              questionLine: 'k __ __ __',
              imagePrompt: 'A colorful kite flying high in the sky'
            },
            aiTutor: {
              target_word: 'kite',
              question: 'k __ t __',
              student_entry: '',
              topic_to_reinforce: 'Review: Sneaky silent e',
              spelling_pattern_or_rule:
                'The sneaky silent e makes the vowel say its name — i becomes /ī/ (kite, time, line).'
            },
            audio: 'kite'
          }
        }
      }
    ],
    completion: [
      "Awesome! You practiced how 'y', 'ie', and sneaky silent e make the long I sound /ī/.",
      'You’re a long I expert now! 🎉'
    ],
    rewards: { coins: 2 }
  },
  '2-K.5': {
    topicId: '2-K.5',
    title: 'Long O Patterns: oa, ow & sneaky silent e',
    intro: [
      "You will learn about long O sounds in words like boat and crow."
    ],
    segments: [
      // --- Segment 1: OA says /ō/ in the middle (boat, goat, road, soap) ---
      {
        modelWord: 'boat',
        emoji: '⛵',
        modelSteps: [
          { highlights: [[0,1]], say: '"b" says /b/.' },
          { highlights: [[1,3]], say: "'o' and 'a' together say /ō/." },
          { highlights: [[3,4]], say: '"t" says /t/.' },
          { highlights: [[0,4]], say: "/b/ /ō/ /t/ 'boat'. We usually use 'oa' in the middle of a word." }
        ],
        familyExamples: {
          title: "Other 'oa' Family Words",
          words: [
            { word: 'goat', emoji: '🐐' },
            { word: 'road', emoji: '🛣️' },
            { word: 'soap', emoji: '🧼' }
          ],
          voiceSteps: [
            { highlights: [],      say: "Here are more words with 'oa' saying /ō/ in the middle." },
            { highlights: [[0,4]], say: 'goat.', targetIndex: 0 },
            { highlights: [[0,4]], say: 'road.', targetIndex: 1 },
            { highlights: [[0,4]], say: 'soap.', targetIndex: 2 },
            { highlights: [],      say: "'oa' likes the middle of words for the long /ō/." }
          ]
        },
        practice: {
          word: 'boat',
          prompt: "Let’s spell 'boat'.",
          hints: [
            "Use 'oa' for /ō/ inside a word (boat, goat, road, soap).",
            'Say it: /b/ /ō/ /t/.'
          ],
          reinforce: "Great! /b/ /ō/ /t/ 'boat'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 3] } as any ),
          meta: {
            explanation: "Nice! The word is 'boat' (long O spelled with 'oa').",
            aiHook: {
              targetWord: 'boat',
              intent: 'fill_blank',
              questionLine: 'b __ __ t',
              imagePrompt: 'A small sailboat floating on calm water'
            },
            aiTutor: {
              target_word: 'boat',
              question: 'b __ __ t',
              student_entry: '',
              topic_to_reinforce: 'Spell the long O word',
              spelling_pattern_or_rule:
                "Use 'oa' to spell long O /ō/ in the MIDDLE of words (boat, goat, road, soap). 'ow' often spells /ō/ at the end, and o_e uses a silent e (pole, home)."
            },
            audio: 'boat'
          }
        }
      },

      // --- Segment 2: OW says /ō/ (crow, snow, show, grow) ---
      {
        modelWord: 'crow',
        emoji: '🐦',
        modelSteps: [
          { highlights: [],      say: "Now let's look at another way to spell long O." },
          { highlights: [[0,1]], say: "'c' says /k/." },
          { highlights: [[1,2]], say: "'r' says /r/." },
          { highlights: [[2,4]], say: "'o' and 'w' together say /ō/." },
          { highlights: [[0,4]], say: "/k/ /r/ /ō/ → 'crow'." }
        ],
        familyExamples: {
          title: "Other 'ow' Family Words",
          words: [
            { word: 'snow', emoji: '❄️' },
            { word: 'show', emoji: '🎬' },
            { word: 'grow', emoji: '🌱' }
          ],
        	voiceSteps: [
          	{ highlights: [],      say: "Here are more words with 'ow' saying /ō/, often at the end." },
          	{ highlights: [[0,4]], say: 'snow.', targetIndex: 0 },
          	{ highlights: [[0,4]], say: 'show.', targetIndex: 1 },
          	{ highlights: [[0,4]], say: 'grow.', targetIndex: 2 },
          	{ highlights: [],      say: "'ow' often comes at the end for the long /ō/." }
        	]
        },
        practice: {
          word: 'crow',
          prompt: "Let’s spell 'crow'.",
          hints: [
            "Use 'ow' for /ō/ at the end (snow, show, grow, crow).",
            'Blend it: /k/ /r/ /ō/.'
          ],
          reinforce: "Excellent! /k/ /r/ /ō/ 'crow'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 1] } as any ),
          meta: {
            explanation: "Great! The word is 'crow' (long O with 'ow' at the end).",
            aiHook: {
              targetWord: 'crow',
              intent: 'fill_blank',
              questionLine: 'c r __ __',
              imagePrompt: 'A crow perched on a fence'
            },
            aiTutor: {
              target_word: 'crow',
              question: 'c r __ __',
              student_entry: '',
              topic_to_reinforce: 'Spell the long O word',
              spelling_pattern_or_rule:
                "Use 'ow' to spell long O /ō/ at the END of words (snow, show, grow, crow). 'oa' stays in the middle; o_e uses a silent e (pole, rope)."
            },
            audio: 'crow'
          }
        }
      },

      // --- Final Short Practice: Sneaky Silent E Review (pole) ---
      {
        modelWord: 'pole',
        modelSteps: [],
        practice: {
          word: 'pole',
          prompt: "And finally, let’s spell 'pole' — remember the sneaky silent e!",
          hints: [
            "Silent e is quiet but makes 'o' say its name /ō/.",
            "Say it: /p/ /ō/ /l/ → 'pole'."
          ],
          reinforce: "Perfect! Sneaky e made the o long — 'pole'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 2] } as any ),
          meta: {
            explanation: "Nice review! The word 'pole' uses o_e (sneaky silent e) for long O.",
            aiHook: {
              targetWord: 'pole',
              intent: 'fill_blank',
              questionLine: 'p __ l __',
              imagePrompt: 'A child carrying a tall pole'
            },
            aiTutor: {
              target_word: 'pole',
              question: 'p __ l __',
              student_entry: '',
              topic_to_reinforce: 'Review: Sneaky silent e for long O',
              spelling_pattern_or_rule:
                'Use o_e to spell long O /ō/ in CVCe words (pole, home, rope). OA stays in the middle; OW often ends.'
            },
            audio: 'pole'
          }
        }
      }
    ],
    completion: [
      "Awesome work! 'oa' in the middle, 'ow' at the end, and sneaky silent e reaching back for long O.",
      'You’re a long O pro! 🎉'
    ],
    rewards: { coins: 2 }
  },
  '2-K.6.1': {
    topicId: '2-K.6.1',
    title: 'Long U Patterns: u_e & oo',
    intro: [
      "You will learn about long U sounds in words like cube and moon."
    ],
    segments: [
      // --- Segment 1: cube (u_e pattern) ---
      {
        modelWord: 'cube',
        emoji: '🧊',
        modelSteps: [
          { highlights: [[0,1]], say: '"c" says /k/.' },
          { highlights: [[1,2]], say: '"u" says /yoo/ because of the sneaky e!' },
          { highlights: [[2,3]], say: '"b" says /b/.' },
          { highlights: [[3,4]], say: '"e" is silent but helps u say /yoo/.' },
          { highlights: [[0,4]], say: "Together: /k/ /yoo/ /b/ 'cube'." }
        ],
        practice: {
          word: 'cube',
          prompt: "Let’s spell 'cube' together!",
          hints: [
            'Listen for the /yoo/ sound after /k/.',
            'The silent e makes the u say its name.'
          ],
          reinforce: "Great! The sneaky e made 'u' say /yoo/ in 'cube'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 2] } as any ),
          meta: {
            explanation: "That's right! The word is 'cube' — u_e makes the long /yoo/ sound.",
            aiHook: {
              targetWord: 'cube',
              intent: 'fill_blank',
              questionLine: 'Complete the word: c _ b _',
              imagePrompt: 'A 3D cube block shape on a table'
            },
            aiTutor: {
              target_word: 'cube',
              question: 'c _ b _',
              student_entry: '',
              topic_to_reinforce: 'Spell the long U word',
              spelling_pattern_or_rule:
                'Use u_e when you hear the /yoo/ sound (cube, tune). The silent e makes u say its name.'
            },
            audio: 'cube'
          }
        }
      },

      // --- Segment 2: moon (oo pattern) ---
      {
        modelWord: 'moon',
        emoji: '🌕',
        modelSteps: [
          { highlights: [], say: "Now let's look at 'o''o', which together make the smooth /oo/ sound usually in the middle of words." },
          { highlights: [[0,1]], say: '"m" says /m/.' },
          { highlights: [[1,3]], say: "'oo' say /oo/." },
          { highlights: [[3,4]], say: '"n" says /n/.' },
          { highlights: [[0,4]], say: "Together: /m/ /oo/ /n/ 'moon'." }
        ],
        practice: {
          word: 'moon',
          prompt: "Now let’s spell 'moon'!",
          hints: [
            "'oo' makes the smooth /oo/ sound in the middle.",
            'Say it slowly: /m/ /oo/ /n/.'
          ],
          reinforce: "Nice! 'oo' makes the smooth /oo/ in 'moon'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 3] } as any ),
          meta: {
            explanation: "Good work! The word is 'moon' — 'oo' makes the smooth /oo/ sound.",
            aiHook: {
              targetWord: 'moon',
              intent: 'fill_blank',
              questionLine: 'Complete the word: m _ _ n',
              imagePrompt: 'A bright full moon in the night sky'
            },
            aiTutor: {
              target_word: 'moon',
              question: 'm _ _ n',
              student_entry: '',
              topic_to_reinforce: 'Spell the long U word',
              spelling_pattern_or_rule:
                "Use oo when you hear the smooth /oo/ sound (moon, spoon), usually in the middle of the word."
            },
            audio: 'moon'
          }
        }
      }
    ],
    completion: [
      "Great job! Sneaky e made /yoo/, and 'oo' made a smooth /oo/ sound!",
      'You’re ready for more long U words next time!'
    ],
    rewards: { coins: 2 }
  },
  '2-K.6.2': {
    topicId: '2-K.6.2',
    title: 'Long U Patterns: ue & ew',
    intro: [
      'You will learn about long U sounds in words like glue and new.'
    ],
    segments: [
      // --- Segment 1: glue (ue pattern) ---
      {
        modelWord: 'glue',
        emoji: '🧴',
        modelSteps: [
          { highlights: [[0,1]], say: '"g" says /g/.' },
          { highlights: [[1,2]], say: '"l" says /l/.' },
          { highlights: [[2,4]], say: "'ue' makes the /oo/ sound at the end." },
          { highlights: [[0,4]], say: "Together: /g/ /l/ /oo/ 'glue'." }
        ],
        familyExamples: {
          title: 'Family of words (ue)',
          words: [
            { word: 'blue', emoji: '🔵' },
            { word: 'true', emoji: '✅' },
            { word: 'clue', emoji: '🕵️' }
          ],
          voiceSteps: [
            { highlights: [], say: "Here are more 'ue' words." },
            { highlights: [[0,4]], say: 'blue.', targetIndex: 0 },
            { highlights: [[0,4]], say: 'true.', targetIndex: 1 },
            { highlights: [[0,4]], say: 'clue.', targetIndex: 2 }
          ]
        },
        practice: {
          word: 'glue',
          prompt: "Let’s spell 'glue' together!",
          hints: [
            '‘ue’ makes the long U sound at the end.',
            'Say it slowly: /g/ /l/ /oo/.'
          ],
          reinforce: "Awesome! 'ue' makes the long /oo/ sound in 'glue'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 1] } as any ),
          meta: {
            explanation: "The word is 'glue' — 'ue' makes the long /oo/ sound at the end.",
            aiHook: {
              targetWord: 'glue',
              intent: 'fill_blank',
              questionLine: 'Complete the word: g l _ _',
              imagePrompt: 'A bottle of glue used for crafts'
            },
            aiTutor: {
              target_word: 'glue',
              question: 'g l _ _',
              student_entry: '',
              topic_to_reinforce: 'Spell the long U word',
              spelling_pattern_or_rule:
                "Words ending with 'ew' are usually one-syllable (chew, stew, new). Words ending with 'ue' are often two-syllable (rescue, continue, argue) but can also be short like 'blue' or 'glue'."
            },
            audio: 'glue'
          }
        }
      },

      // --- Segment 2: new (ew pattern) ---
      {
        modelWord: 'new',
        emoji: '🧸',
        modelSteps: [
          { highlights: [], say: "Now let's look at 'e' 'w' which makes the same sound as 'u''e' at the end!" },
          { highlights: [[0,1]], say: '"n" says /n/.' },
          { highlights: [[1,3]], say: "'e' 'w' makes the /oo/ or /yoo/ sound at the end." },
          { highlights: [[0,3]], say: "Together: /n/ /oo/ → 'new'." }
        ],
        familyExamples: {
          title: 'Family of words (ew)',
          words: [
            { word: 'chew', emoji: '🐶' },
            { word: 'stew', emoji: '🥣' },
            { word: 'grew', emoji: '🌱' }
          ],
          voiceSteps: [
            { highlights: [], say: "Here are some 'e' 'w' words." },
            { highlights: [[0,4]], say: 'chew.', targetIndex: 0 },
            { highlights: [[0,4]], say: 'stew.', targetIndex: 1 },
            { highlights: [[0,4]], say: 'grew.', targetIndex: 2 }
          ]
        },
        practice: {
          word: 'new',
          prompt: "Now let’s spell 'new'!",
          hints: [
            "'ew' makes the /yoo/ sound at the end.",
            'Say it slowly: /n/ /yoo/.'
          ],
          reinforce: "Nice! 'ew' makes the long /oo/ sound in 'new'.",
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Good job! 'ew' makes the /yoo/ sound at the end in 'new'.",
            aiHook: {
              targetWord: 'new',
              intent: 'fill_blank',
              questionLine: 'Complete the word: n _ _',
              imagePrompt: 'A new toy in a box'
            },
            aiTutor: {
              target_word: 'new',
              question: 'n _ _',
              student_entry: '',
              topic_to_reinforce: 'Spell the long U word',
              spelling_pattern_or_rule:
                "Words ending with 'ew' are usually one-syllable (chew, flew, stew, new). Words ending with 'ue' are often two-syllable (rescue, continue, argue) but can also be short like 'blue' or 'glue'."
            },
            audio: 'new'
          }
        }
      }
    ],
    completion: [
      "Great work! 'ue' and 'ew' both spell the long U sound at the end of words.",
      'You’re doing amazing — keep spelling those long U words!'
    ],
    rewards: { coins: 2 }
  },
  '2-M.2.1': {
    topicId: '2-M.2.1',
    title: 'Diphthongs /oi/: oi & oy',
    intro: [
      "You will learn about /oi/ sounds in words like coin and toy."
    ],
    segments: [
      // --- Segment 1: coin (oi in the middle) ---
      {
        modelWord: 'coin',
        emoji: '🪙',
        modelSteps: [
          { highlights: [],       say: "We usually use 'o''i' in the middle to spell /oi/." },
          { highlights: [[0,1]],  say: '"c" says /k/.' },
          { highlights: [[1,3]],  say: "'o''i' says /oi/." },
          { highlights: [[3,4]],  say: '"n" says /n/.' },
          { highlights: [[0,4]],  say: "/k/ /oi/ /n/ 'coin'." }
        ],
        practice: {
          word: 'coin',
          prompt: "Let’s spell 'coin'.",
          hints: [
            'Listen for /oi/ between the first and last sound.',
            "Spell /oi/ with 'oi' in the middle."
          ],
          reinforce: "Great! /k/ /oi/ /n/ 'coin'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 3] } as any ),
          meta: {
            explanation: "Nice! 'o''i' spells /oi/ in the middle in 'coin'.",
            aiHook: {
              targetWord: 'coin',
              intent: 'fill_blank',
              questionLine: 'Complete the word: c__n',
              imagePrompt: 'A shiny gold coin on a table'
            },
            aiTutor: {
              target_word: 'coin',
              question: 'c__n',
              student_entry: '',
              topic_to_reinforce: 'Spell the /oi/ diphthong',
              spelling_pattern_or_rule: "Use 'oi' to spell /oi/ in the middle of a word (coin, boil, soil)."
            },
            audio: 'coin'
          }
        }
      },

      // --- Segment 2: toy (oy at the end) ---
      {
        modelWord: 'toy',
        emoji: '🧸',
        modelSteps: [
          { highlights: [],       say: "We usually use 'o''y' at the end to spell /oi/." },
          { highlights: [[0,1]],  say: '"t" says /t/.' },
          { highlights: [[1,3]],  say: "'o''y' says /oi/ at the end." },
          { highlights: [[0,3]],  say: "/t/ /oi/ 'toy'." }
        ],
        practice: {
          word: 'toy',
          prompt: "Let’s spell 'toy'.",
          hints: [
            'Listen for /oi/ at the end.',
            "Spell /oi/ at the end with 'oy'."
          ],
          reinforce: "Great! /t/ /oi/ 'toy'!",
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Excellent! 'o''y' spells /oi/ at the end in 'toy'.",
            aiHook: {
              targetWord: 'toy',
              intent: 'fill_blank',
              questionLine: 'Complete the word: t__',
              imagePrompt: 'A colorful toy car'
            },
            aiTutor: {
              target_word: 'toy',
              question: 't__',
              student_entry: '',
              topic_to_reinforce: 'Spell the /oi/ diphthong',
              spelling_pattern_or_rule: "Use 'oy' to spell /oi/ at the end of a word (toy, boy, joy)."
            },
            audio: 'toy'
          }
        }
      }
    ],
    completion: [
      "Pattern check: 'oi' = middle, 'oy' = end — both say /oi/!",
      'Awesome job—ready for mixed practice next?'
    ],
    rewards: { coins: 2 }
  },
  '2-M.2.2': {
    topicId: '2-M.2.2',
    title: 'Diphthongs /ow/: ou & ow',
    intro: [
      "You will learn about /ow/ sounds in words like cloud and brown."
    ],
    segments: [
      // --- Segment 1: OU Family — model/practice: cloud ---
      {
        modelWord: 'cloud',
        emoji: '☁️',
        modelSteps: [
          { highlights: [],       say: "We usually use 'ou' to spell /ow/ in the middle of a word." },
          { highlights: [[0,1]],  say: '"c" says /k/.' },
          { highlights: [[1,2]],  say: '"l" says /l/.' },
          { highlights: [[2,4]],  say: "'ou' says /ow/." },
          { highlights: [[4,5]],  say: '"d" says /d/.' },
          { highlights: [[0,5]],  say: "/k/ /l/ /ow/ /d/ 'cloud'." }
        ],
        familyExamples: {
          title: "Other 'ou' Family Words",
          words: [
            { word: 'shout', emoji: '📣' },
            { word: 'house', emoji: '🏠' },
            { word: 'mouse', emoji: '🐭' }
          ],
          voiceSteps: [
            { highlights: [], say: "More 'ou' words that say /ow/" },
            { highlights: [[0,5]], say: "shout", targetIndex: 0 },
            { highlights: [[0,5]], say: "house", targetIndex: 1 },
            { highlights: [[0,5]], say: "mouse", targetIndex: 2 }
          ]
        },
        practice: {
          word: 'cloud',
          prompt: "Let’s spell 'cloud'.",
          hints: [
            'Listen for /ow/ between the first and last sounds.',
            "Spell the middle /ow/ with 'ou'."
          ],
          reinforce: "Great! /k/ /l/ /ow/ /d/ 'cloud'.",
          ...( { isPrefilled: true, prefilledIndexes: [0,1,4] } as any ),
          meta: {
            explanation: "Nice! 'ou' spells /ow/ in the middle in 'cloud'.",
            aiHook: {
              targetWord: 'cloud',
              intent: 'fill_blank',
              questionLine: 'Complete the word: cl__d',
              imagePrompt: 'A fluffy white cloud in a blue sky'
            },
            aiTutor: {
              target_word: 'cloud',
              question: 'cl__d',
              student_entry: '',
              topic_to_reinforce: 'Spell the /ow/ diphthong',
              spelling_pattern_or_rule: "Use 'ou' to spell /ow/ in the middle of words (cloud, house, mouse)."
            },
            audio: 'cloud'
          }
        }
      },

      // --- Segment 2: OW Family — model/practice: brown ---
      {
        modelWord: 'brown',
        emoji: '🟫',
        modelSteps: [
          { highlights: [],       say: "Use 'o''w' to spell /ow/ at the end or before n/l." },
          { highlights: [[0,2]],  say: '"br" says /br/.' },
          { highlights: [[2,4]],  say: "'ow' says /ow/." },
          { highlights: [[4,5]],  say: '"n" says /n/.' },
          { highlights: [[0,5]],  say: "/br/ /ow/ /n/ 'brown'." }
        ],
        familyExamples: {
          title: "Other 'o''w' Family Words",
          words: [
            { word: 'cow',   emoji: '🐄' },
            { word: 'crown', emoji: '👑' },
            { word: 'owl',   emoji: '🦉' }
          ],
          voiceSteps: [
            { highlights: [], say: "More 'o''w' words for /ow/" },
            { highlights: [[0,3]], say: "cow", targetIndex: 0 },
            { highlights: [[0,5]], say: "crown", targetIndex: 1 },
            { highlights: [[0,3]], say: "owl", targetIndex: 2 }
          ]
        },
        practice: {
          word: 'brown',
          prompt: "Let’s spell 'brown'.",
          hints: [
            'Listen for /ow/ right before the last sound.',
            "Spell that /ow/ with 'ow'."
          ],
          reinforce: "Great! /br/ /ow/ /n/ 'brown'.",
          ...( { isPrefilled: true, prefilledIndexes: [0,1,4] } as any ),
          meta: {
            explanation: "Excellent! 'o''w' spells /ow/ before n in 'brown'.",
            aiHook: {
              targetWord: 'brown',
              intent: 'fill_blank',
              questionLine: 'Complete the word: br__n',
              imagePrompt: 'A brown crayon drawing a line'
            },
            aiTutor: {
              target_word: 'brown',
              question: 'br__n',
              student_entry: '',
              topic_to_reinforce: 'Spell the /ow/ diphthong',
              spelling_pattern_or_rule: "Use 'ow' to spell /ow/ at the end or before n/l (cow, brown, owl)."
            },
            audio: 'brown'
          }
        }
      }
    ],
    completion: [
      "Pattern check: 'ou' = middle /ow/, 'ow' = end or before n/l — both say /ow/!",
      'Great work—ready for mixed diphthong practice next?'
    ],
    rewards: { coins: 2 }
  },
  '3-A.3.1': {
    topicId: '3-A.3.1',
    title: 'Long A Patterns: ai & ay',
    intro: [
      "You will learn about long A sounds in words like ray and rain."
    ],
    segments: [
      // --- Segment 1: ray (AY at the end) ---
      {
        modelWord: 'ray',
        modelSteps: [
          { highlights: [[0,1]], say: '"r" says /r/.' },
          { highlights: [[1,3]], say: "'a''y' makes /ā/." },
          { highlights: [[0,3]], say: "/r/ /ā/ → 'ray'. We usually use 'ay' at the end for the long /ā/ sound." }
        ],
        practice: {
          word: 'ray',
          prompt: "Let’s spell 'ray'.",
          hints: [
            "Use 'ay' when /ā/ is at the end (day, play, ray).",
            "Say it and check: r + ay → 'ray'."
          ],
          reinforce: "Great! /r//ā/ makes 'ray'.",
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
          // --- Segment 2: rain (AI in the middle) ---
          { highlights: [], say: "We usually use 'ai' in the middle for the long A sound." },
          { highlights: [[0,1]], say: '"r" says /r/.' },
          { highlights: [[1,3]], say: "'ai' makes /ā/." },
          { highlights: [[3,4]], say: '"n" says /n/.' },
          { highlights: [[0,4]], say: "/r/ /ā/ /n/ → 'rain'. We usually use 'ai' in the middle for the long /ā/ sound." }
        ],
        practice: {
          word: 'rain',
          prompt: "Let’s spell 'rain'.",
          hints: [
            "Use 'ai' when /ā/ is inside the word (rain, train, chain).",
            "Say it and check: r + ai + n → 'rain'."
          ],
          reinforce: "Yes! /r/ /ā/ /n/ makes 'rain'.",
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

  '3-A.3.2': {
  topicId: '3-A.3.2',
  title: "Long A /ā/: 'ea' & 'ey'",
  intro: [
    "You will learn two slightly unusual ways to spell the long A sound: 'ea' (in the middle) and 'ey' (at the end)."
  ],
  segments: [
    // --- Segment 1: EA Family — model/practice: great ---
    {
      modelWord: 'great',
      emoji: '✨',
      modelSteps: [
        { highlights: [],       say: "Sometimes 'ea' spells the long /ā/ in the middle of a word." },
        { highlights: [[0,1]],  say: '"g" says /g/.' },
        { highlights: [[1,2]],  say: '"r" says /r/.' },
        { highlights: [[2,4]],  say: "'ea' says /ā/." },
        { highlights: [[4,5]],  say: '"t" says /t/.' },
        { highlights: [[0,5]],  say: "/g/ /r/ /ā/ /t/ — 'great'." }
      ],
      familyExamples: {
        title: "Other 'ea' (long A) words",
        words: [
          { word: 'steak', emoji: '🥩' },
          { word: 'break', emoji: '🧱' },
          { word: 'great', emoji: '🌟' }
        ],
        voiceSteps: [
          { highlights: [],       say: "More 'e''a' words that say /ā/." },
          { highlights: [[0,5]],  say: "steak",  targetIndex: 0 },
          { highlights: [[0,5]],  say: "break",  targetIndex: 1 },
          { highlights: [[0,5]],  say: "great",  targetIndex: 2 }
        ]
      },
      practice: {
        word: 'great',
        prompt: "Let’s spell 'great'.",
        hints: [
          "Listen for the middle /ā/ sound.",
          "Spell the middle /ā/ with 'ea'."
        ],
        reinforce: "Nice! /g/ /r/ /ā/ /t/ — 'great'.",
        ...( { isPrefilled: true, prefilledIndexes: [0,1,4] } as any ),
        meta: {
          explanation: "Good work! 'ea' spells the long /ā/ in the middle of 'great'.",
          aiHook: {
            targetWord: 'great',
            intent: 'fill_blank',
            questionLine: 'Complete the word: gr__t',
            imagePrompt: 'A student giving a thumbs-up with a gold star sticker'
          },
          aiTutor: {
            target_word: 'great',
            question: 'gr__t',
            student_entry: '',
            topic_to_reinforce: 'Spell the long A word: ea and ey',
            spelling_pattern_or_rule:
              "‘ea’ can spell long A /ā/ in the middle of words (great, steak, break)."
          },
          audio: 'great'
        }
      }
    },

    // --- Segment 2: EY Family — model/practice: they ---
    {
      modelWord: 'they',
      emoji: '🧑‍🤝‍🧑',
      modelSteps: [
        { highlights: [],       say: "Sometimes, we use 'e''y' to spell the long /ā/ at the end of some words." },
        { highlights: [[0,2]],  say: '"th" says /th/.' },
        { highlights: [[2,4]],  say: "'ey' says /ā/." },
        { highlights: [[0,4]],  say: "/th/ /ā/ — 'they'." }
      ],
      familyExamples: {
        title: "Other 'ey' (long A) words",
        words: [
          { word: 'prey', emoji: '🦅' },
          { word: 'obey', emoji: '✅' },
          { word: 'grey', emoji: '⚪️' }
        ],
        voiceSteps: [
          { highlights: [],       say: "More 'ey' words that say /ā/ at the end." },
          { highlights: [[0,4]],  say: "prey", targetIndex: 0 },
          { highlights: [[0,4]],  say: "obey", targetIndex: 1 },
          { highlights: [[0,4]],  say: "grey", targetIndex: 2 }
        ]
      },
      practice: {
        word: 'they',
        prompt: "Let’s spell 'they'.",
        hints: [
          "Listen for /th/ then long A at the end.",
          "Spell that ending /ā/ with 'ey'."
        ],
        reinforce: "Great! /th/ /ā/ — 'they'.",
        ...( { isPrefilled: true, prefilledIndexes: [0,1] } as any ),
        meta: {
          explanation: "Excellent! 'ey' spells the ending long /ā/ in 'they'.",
          aiHook: {
            targetWord: 'they',
            intent: 'fill_blank',
            questionLine: 'Complete the word: th__',
            imagePrompt: 'Two friends waving at each other'
          },
          aiTutor: {
            target_word: 'they',
            question: 'th__',
            student_entry: '',
            topic_to_reinforce: 'Spell the long A word: ea and ey',
            spelling_pattern_or_rule:
              "‘ey’ can spell long /ā/ at the end of words (they, prey, obey, grey)."
          },
          audio: 'they'
        }
      }
    }
  ],
  completion: [
    "Pattern check: 'ea' = middle /ā/ (great, steak, break). 'ey' = ending /ā/ (they, prey, obey).",
    "Awesome work—ready for mixed long A practice next?"
  ],
  rewards: { coins: 2 }
},
'3-A.3.3': {
  topicId: '3-A.3.3',
  title: "Long A /ā/: 'eigh' (weight)",
  intro: [
    "The spelling 'eigh' is an unusual way to make the long A /ā/ sound.",
    "You’ll see it in just a few special words like 'eight', 'weigh', and 'neighbor'."
  ],
  segments: [
    // --- Single Segment: EIGH — model/practice: weight ---
    {
      modelWord: 'weight',
      emoji: '⚖️',
      modelSteps: [
        { highlights: [],        say: "'eigh' is an unusual way to spell /ā/ in some words." },
        { highlights: [[0,1]],   say: '"w" says /w/.' },
        { highlights: [[1,5]],   say: "'eigh' says /ā/." },
        { highlights: [[5,6]],   say: '"t" says /t/.' },
        { highlights: [[0,6]],   say: "/w/ /ā/ /t/ — 'weight'." }
      ],
      familyExamples: {
        title: "Other 'eigh' (long A) words",
        words: [
          { word: 'eight', emoji: '8️⃣' },
          { word: 'neighbor', emoji: '🏘️' },
          { word: 'sleigh', emoji: '🛷' }
        ],
        voiceSteps: [
          { highlights: [],        say: "These 'eigh' words also say /ā/." },
          { highlights: [[0,5]],   say: "eight", targetIndex: 0 },
          { highlights: [[0,8]],   say: "neighbor", targetIndex: 1 },
          { highlights: [[0,6]],   say: "sleigh", targetIndex: 2 }
        ]
      },
      practice: {
        word: 'weight',
        prompt: "Let’s spell 'weight'.",
        hints: [
          "Listen for the /ā/ in the middle.",
          "Spell that sound with 'eigh'."
        ],
        reinforce: "Great! /w/ /ā/ /t/ — 'weight'.",
        ...( { isPrefilled: true, prefilledIndexes: [0,5] } as any ),
        meta: {
          explanation: "Nice! 'eigh' spells the long /ā/ in 'weight', a rare pattern.",
          aiHook: {
            targetWord: 'weight',
            intent: 'fill_blank',
            questionLine: 'Complete the word: w____t',
            imagePrompt: 'A kitchen scale measuring apples'
          },
          aiTutor: {
            target_word: 'weight',
            question: 'w____t',
            student_entry: '',
            topic_to_reinforce: 'Spell the long A word',
            spelling_pattern_or_rule:
              "'eigh' can spell the long A /ā/ sound in a few special words (weight, eight, neighbor). It’s unusual—so remember this pattern!"
          },
          audio: 'weight'
        }
      }
    }
  ],
  completion: [
    "Pattern check: 'eigh' is an unusual way to spell /ā/, found in words like 'weight', 'eight', and 'neighbor'.",
    "Excellent work—you're mastering even the tricky spellings!"
  ],
  rewards: { coins: 1 }
},

'3-A.4.1': {
    topicId: '3-A.4.1',
    title: 'Spell the long E word: ee & ea',
    intro: [
      "You will learn about long E sounds in words like bee and leaf."
    ],
    segments: [
      // --- Segment 1: EE Family (bee, see, tree, feet) ---
      {
        modelWord: 'bee',
        emoji: '🐝',
        modelSteps: [
          { highlights: [[0,1]], say: '"b" says /b/.' },
          { highlights: [[1,3]], say: "'e' and 'e' work together to make /ē/." },
          { highlights: [[0,3]], say: "/b/ /ē/ 'bee'! 'ee' often comes in the middle or end of short words." }
        ],
        familyExamples: {
          title: "Other 'ee' Family Words",
          words: [
            { word: 'see', emoji: '👀' },
            { word: 'tree', emoji: '🌳' },
            { word: 'feet', emoji: '🦶' }
          ],
          voiceSteps: [
            { highlights: [], say: "Let's look at some other 'ee' family words!" },
            { highlights: [[0,3]], say: "see'", targetIndex: 0 },
            { highlights: [[0,4]], say: "tree'", targetIndex: 1 },
            { highlights: [[0,4]], say: "feet'", targetIndex: 2 }
            
          ]
        },
        practice: {
          word: 'bee',
          prompt: "Let’s spell 'bee'.",
          hints: [
            "Use 'ee' to show the long /ē/ sound, like in 'see' and 'tree'.",
            "Say it slowly: /b/ + /ē/ → 'bee'."
          ],
          reinforce: "Great! /b/ /ē/ makes 'bee'.",
          ...( { isPrefilled: true, prefilledIndexes: [0] } as any ),
          meta: {
            explanation: "Nice! The word is 'bee' (long E spelled with 'ee').",
            aiHook: {
              targetWord: 'bee',
              intent: 'fill_blank',
              questionLine: 'b__',
              imagePrompt: 'A buzzing yellow bee on a flower'
            },
            aiTutor: {
              target_word: 'bee',
              question: 'b__',
              student_entry: '',
              topic_to_reinforce: 'Spell the long E word',
              spelling_pattern_or_rule:
                "Use 'ee' to spell the long E /ē/ in the MIDDLE or END of short words (see, tree, bee). Both 'ee' and 'ea' say /ē/, but 'ee' is more common in smaller words."
            },
            audio: 'bee'
          }
        }
      },
      // --- Segment 2: EA Family (leaf, sea, eat) ---
      {
        modelWord: 'leaf',
        emoji: '🍃',
        modelSteps: [
          { highlights: [], say: "Now let's meet the other long E team — 'ea'! It also makes the /ē/ sound." },
          { highlights: [[0,1]], say: '"l" says /l/.' },
          { highlights: [[1,3]], say: "'e''a' work together to make the long /ē/." },
          { highlights: [[3,4]], say: '"f" says /f/.' },
          { highlights: [[0,4]], say: "/l/ /ē/ /f/ makes 'leaf'! 'ea' often appears at the start or middle of words." }
        ],
        familyExamples: {
          title: "Other 'ea' Family Words",
          words: [
            { word: 'sea', emoji: '🌊' },
            { word: 'eat', emoji: '🍽️' },
            { word: 'leaf', emoji: '🍃' }
          ],
          voiceSteps: [
            { highlights: [], say: "Now let’s meet the 'e''a' family!" },
            { highlights: [[0,3]], say: "'sea'", targetIndex: 0 },
            { highlights: [[0,3]], say: "'eat'", targetIndex: 1 },
            { highlights: [[0,4]], say: "And 'leaf'", targetIndex: 2 },
            { highlights: [], say: "So both 'ee' and 'ea' say /ē/" }
          ]
        },
        practice: {
          word: 'leaf',
          prompt: "Let’s spell 'leaf'.",
          hints: [
            "Use 'ea' for /ē/ when it’s in the middle (leaf, eat, sea).",
            "Say it slowly: /l/ + /ē/ + /f/ → 'leaf'."
          ],
          reinforce: "Excellent! /l/ /ē/ /f/ 'leaf'.",
          ...( { isPrefilled: true, prefilledIndexes: [0, 3] } as any ),
          meta: {
            explanation: "Awesome! The word is 'leaf' (long E spelled with 'ea').",
            aiHook: {
              targetWord: 'leaf',
              intent: 'fill_blank',
              questionLine: 'l__f',
              imagePrompt: 'A bright green leaf on a branch'
            },
            aiTutor: {
              target_word: 'leaf',
              question: 'l__f',
              student_entry: '',
              topic_to_reinforce: 'Spell the long E word',
              spelling_pattern_or_rule:
                "Use 'ea' to spell the long E /ē/ sound in the MIDDLE of a word (leaf, eat, sea). 'ee' and 'ea' both say /ē/, but 'ea' often appears in longer or middle-position words."
            },
            audio: 'leaf'
          }
        }
      }
    ],
    completion: [
      "Great job! Both 'ee' and 'ea' make the long E sound.",
      "Now you know: 'ee' loves the end, 'ea' likes the middle! 👏"
    ],
    rewards: { coins: 2 }
  },
'3-A.4.2': {
  topicId: '3-A.4.2',
  title: "Long E /ē/: e_e (silent e) & ie",
  intro: [
    "You will learn two ways to spell the long E sound: the sneaky silent e and ie."
  ],
  segments: [
    // --- Segment 1: e_e (silent e) — model/practice: scene ---
    {
      modelWord: 'scene',
      emoji: '🎭',
      modelSteps: [
        { highlights: [],        say: "Silent e can make the earlier e say its name /ē/." },
        { highlights: [[0,2]],   say: "'sc' says /s/ here." },
        { highlights: [[2,3]],   say: "This 'e' says /ē/ because of the silent e at the end." },
        { highlights: [[3,4]],   say: '"n" says /n/.' },
        { highlights: [[4,5]],   say: "Final 'e' is silent but makes the first e long." },
        { highlights: [[0,5]],   say: "/s/ /ē/ /n/ — 'scene'." }
      ],
      familyExamples: {
        title: "Other e_e (long E) words",
        words: [
          { word: 'these', emoji: '☝️' },
          { word: 'theme', emoji: '🎨' },
          { word: 'scene', emoji: '🎬' }
        ],
        voiceSteps: [
          { highlights: [],        say: "More e_e words where silent e makes /ē/." },
          { highlights: [[0,5]],   say: "these", targetIndex: 0 },
          { highlights: [[0,5]],   say: "theme", targetIndex: 1 },
          { highlights: [[0,5]],   say: "scene", targetIndex: 2 }
        ]
      },
      practice: {
        word: 'scene',
        prompt: "Let’s spell 'scene'.",
        hints: [
          "Hear the long /ē/ in the middle.",
          "Use e_e: the final e makes the earlier e say /ē/."
        ],
        reinforce: "Great! /s/ /ē/ /n/ — 'scene'.",
        ...( { isPrefilled: true, prefilledIndexes: [0,1,3] } as any ),
        meta: {
          explanation: "Silent e makes the earlier e long in 'scene' (e_e).",
          aiHook: {
            targetWord: 'scene',
            intent: 'fill_blank',
            questionLine: 'Complete the word: sc _ n _',
            imagePrompt: 'Actors performing on a stage; theater scene'
          },
          aiTutor: {
            target_word: 'scene',
            question: 'sc _ n _',
            student_entry: '',
            topic_to_reinforce: 'Spell the long E word',
            spelling_pattern_or_rule:
              "Magic/silent e makes a previous e long (e_e) as in these, theme, scene."
          },
          audio: 'scene'
        }
      }
    },

    // --- Segment 2: ie — model/practice: field ---
    {
      modelWord: 'field',
      emoji: '🌾',
      modelSteps: [
        { highlights: [],        say: "'i''e' can spell the long E /ē/ in some words." },
        { highlights: [[0,1]],   say: '"f" says /f/.' },
        { highlights: [[1,3]],   say: "'i''e' says /ē/." },
        { highlights: [[3,5]],   say: "'l''d' says /ld/." },
        { highlights: [[0,5]],   say: "/f/ /ē/ /ld/ — 'field'." }
      ],
      familyExamples: {
        title: "Other 'ie' (long E) words",
        words: [
          { word: 'chief',  emoji: '🪶' },
          { word: 'thief',  emoji: '🕵️' }, 
          { word: 'shield', emoji: '🛡️' }
        ],
        voiceSteps: [
          { highlights: [],        say: "More 'i''e' words that say /ē/." },
          { highlights: [[0,5]],   say: "chief",  targetIndex: 0 },
          { highlights: [[0,5]],   say: "thief",  targetIndex: 1 },
          { highlights: [[0,6]],   say: "shield", targetIndex: 2 }
        ]
      },
      practice: {
        word: 'field',
        prompt: "Let’s spell 'field'.",
        hints: [
          "Hear the long /ē/ after the first sound.",
          "Spell that /ē/ with 'ie'."
        ],
        reinforce: "Nice! /f/ /ē/ /ld/ — 'field'.",
        ...( { isPrefilled: true, prefilledIndexes: [0,3,4] } as any ),
        meta: {
          explanation: "'ie' spells the long E /ē/ in 'field'.",
          aiHook: {
            targetWord: 'field',
            intent: 'fill_blank',
            questionLine: 'Complete the word: f _ _ l d',
            imagePrompt: 'A wide green grassy field under blue sky'
          },
          aiTutor: {
            target_word: 'field',
            question: 'f _ _ l d',
            student_entry: '',
            topic_to_reinforce: 'Spell the long E word',
            spelling_pattern_or_rule:
              "'ie' can spell /ē/ in words like field, chief, thief, shield. Use ee/ea for many mid-word /ē/ words (green, leaf)."
          },
          audio: 'field'
        }
      }
    }
  ],
  completion: [
    "Pattern check: e_e (silent e) makes an earlier e long (scene). 'ie' can also spell /ē/ (field).",
    "Great work—ready for mixed long E practice next?"
  ],
  rewards: { coins: 2 }
}
};

export function getLessonScript(topicId: string): LessonScript | null {
  return lessonScripts[topicId] || null;
}