import { sampleMCQData } from '@/data/mcq-questions';

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
        
        spellingQuestions.push({
          id: question.id,
          topicId: question.topicId,
          topicName: question.topicName,
          word: question.word,
          questionText: question.questionText,
          correctAnswer: question.correctAnswer.toString(),
          audio: spellingTarget, // Use the determined spelling target
          explanation: question.explanation,
          templateType: question.templateType
        });
      }
    });
  });
  
  return spellingQuestions;
};

/**
 * Get a random spelling question from the question bank
 */
export const getRandomSpellingQuestion = (): SpellingQuestion | null => {
  const spellingQuestions = getAllSpellingQuestions();
  console.log('🎲 Available spelling questions:', spellingQuestions.length);
  
  if (spellingQuestions.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * spellingQuestions.length);
  const selectedQuestion = spellingQuestions[randomIndex];
  
  console.log('🎯 Selected spelling question:', {
    id: selectedQuestion.id,
    word: selectedQuestion.word,
    audio: selectedQuestion.audio,
    questionText: selectedQuestion.questionText
  });
  
  return selectedQuestion;
};