import { sampleMCQData } from '@/data/mcq-questions';
import { lessonScripts } from '@/data/lesson-scripts';
import { mapSelectedGradeToContentGrade, getNextSpellboxTopic, getSpellboxTopicProgress } from './utils';

// Interface for spelling question data
export interface SpellingQuestion {
  id: number;
  topicId: string;
  topicName: string;
  word: string;
  questionText: string;
  correctAnswer: string;
  audio: string;
  explanation: string;
  templateType: string;
  isPrefilled?: boolean;
  prefilledIndexes?: number[];
  /** Optional: metadata for the realtime spelling tutor prompt */
  aiTutor?: {
    target_word?: string;
    question?: string; // mask like "_ _ p"
    student_entry?: string;
    topic_to_reinforce?: string;
    spelling_pattern_or_rule?: string;
  };
}

// Interface for generated story context message
export interface StoryContextMessage {
  message: string;
  spellingQuestion: SpellingQuestion;
  targetWord: string;
  storyPrompt: string;
}

/**
 * Get all spelling questions from the question bank
 */
export const getAllSpellingQuestions = (): SpellingQuestion[] => {
  const spellingQuestions: SpellingQuestion[] = [];
  
  Object.values(sampleMCQData.topics).forEach(topic => {
    topic.questions.forEach(question => {
      if (question.isSpelling === true) {
        // Determine the actual spelling target word
        let spellingTarget = question.audio || question.word;
        
        // If the audio field contains a phonetic concept (multiple words), use the word field instead
        if (spellingTarget && spellingTarget.includes(' ') && spellingTarget.includes('sounds')) {
          spellingTarget = question.word;
        }
        
        const spellingQuestion = {
          id: question.id,
          topicId: question.topicId,
          topicName: question.topicName,
          word: question.word,
          questionText: question.questionText,
          correctAnswer: question.correctAnswer.toString(),
          audio: spellingTarget, // Use the determined spelling target
          explanation: question.explanation,
          templateType: question.templateType,
          isPrefilled: question.isPrefilled,
          prefilledIndexes: question.prefilledIndexes,
          // Pass through any aiTutor metadata from the MCQ source so SpellBox can enrich the realtime prompt
          aiTutor: question.aiTutor
        };
        
        // Debug: Log prefilled questions
        if (spellingQuestion.isPrefilled) {
          // console.log('🔤 PREFILLED QUESTION LOADED:', {
          //   id: spellingQuestion.id,
          //   word: spellingQuestion.word,
          //   isPrefilled: spellingQuestion.isPrefilled,
          //   prefilledIndexes: spellingQuestion.prefilledIndexes,
          //   expectedDisplay: spellingQuestion.word.split('').map((char, i) => 
          //     spellingQuestion.prefilledIndexes?.includes(i) ? char : '_'
          //   ).join('')
          // });
        }
        
        spellingQuestions.push(spellingQuestion);
      }
    });
  });
  
  return spellingQuestions;
};

/**
 * Get a random spelling question from the question bank, optionally filtered by grade
 */
export const getRandomSpellingQuestion = (gradeDisplayName?: string): SpellingQuestion | null => {
  const allSpellingQuestions = getAllSpellingQuestions();
  // console.log('🎲 Total available spelling questions:', allSpellingQuestions.length);
  // console.log('🎓 Grade display name received:', gradeDisplayName);
  
  if (allSpellingQuestions.length === 0) {
    return null;
  }
  
  let spellingQuestions = allSpellingQuestions;
  
  // Filter by grade if provided
  if (gradeDisplayName) {
    // Special-case: assignment pulls only from assignment topic(s)
    if ((gradeDisplayName || '').toLowerCase() === 'assignment') {
      const assignmentQuestions = allSpellingQuestions.filter(q => q.topicId === 'A-');
      if (assignmentQuestions.length === 0) return null;
      spellingQuestions = assignmentQuestions;
    } else {
    // Use the existing utility function to map display name to content grade
    const contentGrade = mapSelectedGradeToContentGrade(gradeDisplayName);
    
    // Filter questions by grade prefix
    const gradeFilteredQuestions = allSpellingQuestions.filter(question => {
      return question.topicId.startsWith(`${contentGrade}-`);
    });
    
    // console.log(`🎯 Grade filtering - Display: ${gradeDisplayName} → Content: ${contentGrade}`);
    // console.log(`🔍 Filtered spelling questions for grade ${contentGrade}:`, gradeFilteredQuestions.length);
    
    // Use filtered questions if available, otherwise fall back to all questions
    if (gradeFilteredQuestions.length > 0) {
      spellingQuestions = gradeFilteredQuestions;
    } else {
      // console.log('⚠️ No spelling questions found for grade, using all questions as fallback');
    }
    }
  }
  
  const randomIndex = Math.floor(Math.random() * spellingQuestions.length);
  const selectedQuestion = spellingQuestions[randomIndex];
  
  // console.log('🎯 Selected spelling question:', {
  //   id: selectedQuestion.id,
  //   topicId: selectedQuestion.topicId,
  //   word: selectedQuestion.word,
  //   audio: selectedQuestion.audio,
  //   questionText: selectedQuestion.questionText,
  //   gradeFilter: gradeDisplayName || 'none'
  // });
  
  return selectedQuestion;
};

/**
 * Get a sequential spelling question from the question bank, filtered by grade
 * This function returns questions in a consistent order for sequential learning
 */
export const getSequentialSpellingQuestion = (
  gradeDisplayName?: string, 
  currentIndex: number = 0
): SpellingQuestion | null => {
  const allSpellingQuestions = getAllSpellingQuestions();
  // console.log('📚 Total available spelling questions:', allSpellingQuestions.length);
  // console.log('🎓 Grade display name received:', gradeDisplayName);
  // console.log('📍 Current index:', currentIndex);
  
  if (allSpellingQuestions.length === 0) {
    // console.log('❌ No spelling questions found in question bank');
    return null;
  }
  
  let spellingQuestions = allSpellingQuestions;
  
  // Filter by grade if provided
  if (gradeDisplayName) {
    // Special-case: assignment pulls only from assignment topic(s)
    if ((gradeDisplayName || '').toLowerCase() === 'assignment') {
      const assignmentQuestions = allSpellingQuestions.filter(q => q.topicId === 'A-');
      if (assignmentQuestions.length === 0) return null;
      spellingQuestions = assignmentQuestions;
    } else {
    // Use the existing utility function to map display name to content grade
    const contentGrade = mapSelectedGradeToContentGrade(gradeDisplayName);
    
    // Filter questions by grade prefix
    const gradeFilteredQuestions = allSpellingQuestions.filter(question => {
      return question.topicId.startsWith(`${contentGrade}-`);
    });
    
    // console.log(`🎯 Grade filtering - Display: ${gradeDisplayName} → Content: ${contentGrade}`);
    // console.log(`🔍 Filtered spelling questions for grade ${contentGrade}:`, gradeFilteredQuestions.length);
    
    // Use filtered questions if available, otherwise fall back to all questions
    if (gradeFilteredQuestions.length > 0) {
      spellingQuestions = gradeFilteredQuestions;
    } else {
      // console.log('⚠️ No spelling questions found for grade, using all questions as fallback');
    }
    }
  }
  
  // Sort questions by topicId and then by id to ensure consistent order
  spellingQuestions.sort((a, b) => {
    if (a.topicId !== b.topicId) {
      return a.topicId.localeCompare(b.topicId);
    }
    return a.id - b.id;
  });
  
  // console.log(`📋 Sorted spelling questions: ${spellingQuestions.length} total`);
  
  // Return question at current index, or null if we've reached the end
  if (currentIndex >= spellingQuestions.length) {
    // console.log(`🏁 Reached end of spelling questions for grade ${gradeDisplayName}. Index ${currentIndex} >= Length ${spellingQuestions.length}`);
    return null; // All questions completed
  }
  
  const selectedQuestion = spellingQuestions[currentIndex];
  
  // console.log('🎯 Selected sequential spelling question:', {
  //   index: currentIndex,
  //   totalQuestions: spellingQuestions.length,
  //   id: selectedQuestion.id,
  //   topicId: selectedQuestion.topicId,
  //   word: selectedQuestion.word,
  //   audio: selectedQuestion.audio,
  //   questionText: selectedQuestion.questionText,
  //   gradeFilter: gradeDisplayName || 'none',
  //   progress: `${currentIndex + 1}/${spellingQuestions.length}`
  // });
  
  return selectedQuestion;
};

/**
 * Get the total count of spelling questions for a specific grade
 */
export const getSpellingQuestionCount = (gradeDisplayName?: string): number => {
  const allSpellingQuestions = getAllSpellingQuestions();
  
  if (!gradeDisplayName) {
    return allSpellingQuestions.length;
  }
  
  // Special-case: assignment pulls only from 'A-'
  if ((gradeDisplayName || '').toLowerCase() === 'assignment') {
    return allSpellingQuestions.filter(q => q.topicId === 'A-').length;
  }

  const contentGrade = mapSelectedGradeToContentGrade(gradeDisplayName);
  const gradeFilteredQuestions = allSpellingQuestions.filter(question => {
    return question.topicId.startsWith(`${contentGrade}-`);
  });
  
  return gradeFilteredQuestions.length;
};

/**
 * Get all unique topic IDs for spelling questions in a specific grade
 */
export const getSpellingTopicIds = (gradeDisplayName?: string): string[] => {
  const allSpellingQuestions = getAllSpellingQuestions();

  // If a grade is provided, map to content grade (e.g. "2nd Grade" → "2")
  // Special-case: assignment → only 'A-'
  if ((gradeDisplayName || '').toLowerCase() === 'assignment') {
    // Ensure A- exists in the topics ordering
    return Object.keys(sampleMCQData.topics).includes('A-') ? ['A-'] : ['A-'];
  }

  const contentGrade = gradeDisplayName
    ? mapSelectedGradeToContentGrade(gradeDisplayName)
    : null;

  // Build a set of allowed topicIds (filtered by grade if provided)
  const allowedTopicIds = new Set(
    allSpellingQuestions
      .filter((question) => {
        if (!contentGrade) return true;
        return question.topicId.startsWith(`${contentGrade}-`);
      })
      .map((q) => q.topicId)
  );

  // Preserve the canonical insertion order from sampleMCQData.topics
  const orderedTopicIds: string[] = [];
  for (const topicId of Object.keys(sampleMCQData.topics)) {
    if (allowedTopicIds.has(topicId)) {
      orderedTopicIds.push(topicId);
    }
  }

  return orderedTopicIds;
};

/**
 * Get spelling questions for a specific topic
 */
export const getSpellingQuestionsByTopic = (topicId: string): SpellingQuestion[] => {
  const allSpellingQuestions = getAllSpellingQuestions();
  return allSpellingQuestions.filter(question => question.topicId === topicId);
};

/**
 * Lookup a spelling question by word (case-insensitive match on audio field)
 */
export const getSpellingQuestionByWord = (word: string): SpellingQuestion | null => {
  const allSpellingQuestions = getAllSpellingQuestions();
  const normalized = word.trim().toLowerCase();
  return allSpellingQuestions.find(q => q.audio.toLowerCase() === normalized) || null;
};

/**
 * Get the global sequential lesson number for a topic across ALL grades,
 * considering only topics that have at least one question where isSpelling === true.
 * The sequence follows the insertion order in sampleMCQData.topics which is our
 * canonical curriculum ordering (starts at Kindergarten, then Grade 1, ...).
 */
export const getGlobalSpellingLessonNumber = (topicId: string): number | null => {
  try {
    const topics = sampleMCQData.topics as Record<string, any>;
    const idSet = new Set<string>();

    // 1) Collect spelling-topic IDs from MCQ data
    for (const [id, topic] of Object.entries(topics)) {
      const hasSpelling = Array.isArray(topic?.questions)
        && topic.questions.some((q: any) => q?.isSpelling === true);
      if (hasSpelling) idSet.add(id);
    }

    // 2) Include all whiteboard lesson script topic IDs
    Object.keys(lessonScripts).forEach((id) => idSet.add(id));

    // 3) Sort by natural topicId order so 1-T.2.3 follows 1-T.2.2, K precedes 1, etc.
    const tokenize = (id: string): (string | number)[] => {
      const parts = id.replace(/[.-]/g, ' ').split(/\s+/).filter(Boolean);
      const tokens: (string | number)[] = [];
      for (const part of parts) {
        const matches = part.match(/\d+|[A-Za-z]+/g) || [];
        for (const m of matches) {
          if (/^\d+$/.test(m)) tokens.push(parseInt(m, 10));
          else tokens.push(m.toLowerCase());
        }
      }
      // Special-case grade K → numeric 0 so it sorts before 1
      if (typeof tokens[0] === 'string' && tokens[0] === 'k') tokens[0] = 0;
      return tokens;
    };

    const compareIds = (a: string, b: string): number => {
      const ta = tokenize(a);
      const tb = tokenize(b);
      const len = Math.max(ta.length, tb.length);
      for (let i = 0; i < len; i++) {
        const va = ta[i];
        const vb = tb[i];
        if (va === undefined) return -1;
        if (vb === undefined) return 1;
        const aNum = typeof va === 'number';
        const bNum = typeof vb === 'number';
        if (aNum && bNum) {
          if (va as number !== (vb as number)) return (va as number) - (vb as number);
        } else if (!aNum && !bNum) {
          if ((va as string) !== (vb as string)) return (va as string).localeCompare(vb as string);
        } else {
          // numbers come before letters at the same position
          return aNum ? -1 : 1;
        }
      }
      return 0;
    };

    const orderedTopicIds = Array.from(idSet).sort(compareIds);

    const index = orderedTopicIds.indexOf(topicId);
    if (index === -1) return null;
    return index + 1; // 1-based numbering for display
  } catch {
    return null;
  }
};

/**
 * Get the next spelling question based on Spellbox topic progression
 * This function respects the 70% first-attempt requirement and topic-based progression
 */
export const getNextSpellboxQuestion = (
  gradeDisplayName?: string,
  completedQuestionIds: number[] = []
): SpellingQuestion | null => {
  if (!gradeDisplayName) {
    console.warn('🚫 getNextSpellboxQuestion: No grade provided');
    return null;
  }

  // Topic progress functions are now imported at the top of the file
  
  // Get all topic IDs for this grade
  const allTopicIds = getSpellingTopicIds(gradeDisplayName);
  
  if (allTopicIds.length === 0) {
    console.warn(`🚫 getNextSpellboxQuestion: No topics found for grade ${gradeDisplayName}`);
    return null;
  }
  
  // Get the current topic based on progression logic
  const currentTopicId = getNextSpellboxTopic(gradeDisplayName, allTopicIds);
  console.log(`🎯 getNextSpellboxQuestion: Determined topic`, { gradeDisplayName, currentTopicId, allTopicIds: allTopicIds.slice(0, 3) });
  
  if (!currentTopicId) {
    console.log('🏁 getNextSpellboxQuestion: All topics completed with passing grades');
    return null;
  }
  
  // Get questions for the current topic
  const topicQuestions = getSpellingQuestionsByTopic(currentTopicId);
  
  if (topicQuestions.length === 0) {
    console.warn(`🚫 getNextSpellboxQuestion: No questions found for topic ${currentTopicId}`);
    return null;
  }
  
  // Get topic progress to see how many questions have been attempted
  const topicProgress = getSpellboxTopicProgress(gradeDisplayName, currentTopicId);
  const questionsAttempted = topicProgress?.questionsAttempted || 0;
  
  // If topic is completed but didn't pass, we'll let the progress system handle the restart
  // The topic will be restarted when updateSpellboxTopicProgress detects a failed topic
  if (topicProgress?.isCompleted && topicProgress.successRate < 70) {
    // console.log(`🔄 getNextSpellboxQuestion: Topic ${currentTopicId} needs restart (${topicProgress.successRate.toFixed(1)}% < 70%)`);
    // Return first question of this topic - the progress will be reset when the next question is answered
    const firstQuestion = topicQuestions[0];
    // console.log(`🎯 getNextSpellboxQuestion: Selected first question for restart of topic ${currentTopicId}:`, {
    //   id: firstQuestion.id,
    //   word: firstQuestion.word,
    //   topicName: firstQuestion.topicName
    // });
    return firstQuestion;
  }
  
  // For ongoing topics, select the next question in sequence (up to 10 questions max)
  const questionIndex = Math.min(questionsAttempted, 9); // Max 10 questions (0-9 index)
  const selectedQuestion = topicQuestions[questionIndex] || topicQuestions[0];
  
  // console.log(`🎯 getNextSpellboxQuestion: Selected question ${questionIndex + 1}/10 for topic ${currentTopicId}:`, {
  //   id: selectedQuestion.id,
  //   word: selectedQuestion.word,
  //   topicName: selectedQuestion.topicName,
  //   questionsAttempted,
  //   topicProgress: topicProgress?.successRate?.toFixed(1) + '%' || 'New topic'
  // });
  
  return selectedQuestion;
};