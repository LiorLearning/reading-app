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
      "Meet long A teams: 'ai' and 'ay'."
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
      "Meet the long E teams! Both 'ee' and 'ea' say /ē/ — let's learn when to use each."
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
      "Meet the long I team! 'y', 'ie', and sneaky silent e can all say /ī/."
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
      "Long O can be spelled with 'oa', 'ow', and sneaky silent e. Let's learn where each is used!"
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
          { highlights: [[0,1]], say: '"c" says /k/.' },
          { highlights: [[1,2]], say: '"r" says /r/.' },
          { highlights: [[2,4]], say: "'o' and 'w' together say /ō/." },
          { highlights: [[0,4]], say: "/k/ /r/ /ō/ → 'crow'. We usually use 'ow' at the end to show /ō/." }
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
          	{ highlights: [],      say: "'ow' often comes at the end to show the long O /ō/." }
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
};

export function getLessonScript(topicId: string): LessonScript | null {
  return lessonScripts[topicId] || null;
}


