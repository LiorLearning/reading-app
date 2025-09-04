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
        spellingQuestions.push({
          id: question.id,
          topicId: question.topicId,
          topicName: question.topicName,
          word: question.word,
          questionText: question.questionText,
          correctAnswer: question.correctAnswer.toString(),
          audio: question.audio,
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
  
  if (spellingQuestions.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * spellingQuestions.length);
  return spellingQuestions[randomIndex];
};