import { useState, useEffect, useCallback } from 'react';
import { sampleMCQData as mcqData } from '@/data/mcq-questions';

interface MCQQuestion {
  id: number;
  topicId: string;
  topicName: string;
  questionElements: string;
  answerElements: string;
  templateType: string;
  word: string;
  imageUrl?: string | null;
  explanation: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  template: string;
  isSpacing: boolean;
  isSorting: boolean;
  isSpelling: boolean;
  aiHook: {
    targetWord: string;
    intent: string;
    questionLine: string;
    imagePrompt: string;
  };
}

interface MCQTopic {
  topicInfo: {
    topicId: string;
    topicName: string;
    questionElements: string;
    answerElements: string;
    templateType: string;
  };
  questions: MCQQuestion[];
}

interface MCQAnswerHistory {
  questionId: number;
  isCorrect: boolean;
  selectedAnswer: number;
  timestamp: number;
}

interface UseMCQReturn {
  allQuestions: MCQQuestion[];
  currentQuestion: MCQQuestion | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  hasNextQuestion: boolean;
  hasPreviousQuestion: boolean;
  answerHistory: MCQAnswerHistory[];
  score: number;
  percentage: number;
  nextQuestion: () => void;
  previousQuestion: () => void;
  goToQuestion: (index: number) => void;
  recordAnswer: (questionId: number, isCorrect: boolean, selectedAnswer: number) => void;
  resetQuiz: () => void;
  getQuestionsForTopic: (topicId: string) => MCQQuestion[];
  getAllTopics: () => string[];
}

export const useMCQ = (selectedTopics?: string[]): UseMCQReturn => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerHistory, setAnswerHistory] = useState<MCQAnswerHistory[]>([]);
  
  // Extract all questions from the JSON data
  const allQuestions = useState(() => {
    const questions: MCQQuestion[] = [];
    
    Object.entries(mcqData.topics).forEach(([topicId, topic]) => {
      const typedTopic = topic as MCQTopic;
      if (!selectedTopics || selectedTopics.includes(topicId)) {
        questions.push(...typedTopic.questions);
      }
    });
    
    // Shuffle questions for variety
    return questions.sort(() => Math.random() - 0.5);
  })[0];

  const currentQuestion = allQuestions[currentQuestionIndex] || null;
  const totalQuestions = allQuestions.length;
  const hasNextQuestion = currentQuestionIndex < totalQuestions - 1;
  const hasPreviousQuestion = currentQuestionIndex > 0;

  // Calculate score and percentage
  const score = answerHistory.filter(answer => answer.isCorrect).length;
  const percentage = answerHistory.length > 0 ? Math.round((score / answerHistory.length) * 100) : 0;

  const nextQuestion = useCallback(() => {
    if (hasNextQuestion) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [hasNextQuestion]);

  const previousQuestion = useCallback(() => {
    if (hasPreviousQuestion) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }, [hasPreviousQuestion]);

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentQuestionIndex(index);
    }
  }, [totalQuestions]);

  const recordAnswer = useCallback((questionId: number, isCorrect: boolean, selectedAnswer: number) => {
    const newAnswer: MCQAnswerHistory = {
      questionId,
      isCorrect,
      selectedAnswer,
      timestamp: Date.now()
    };

    setAnswerHistory(prev => {
      // Remove any existing answer for this question (in case of retake)
      const filtered = prev.filter(answer => answer.questionId !== questionId);
      return [...filtered, newAnswer];
    });
  }, []);

  const resetQuiz = useCallback(() => {
    setCurrentQuestionIndex(0);
    setAnswerHistory([]);
  }, []);

  const getQuestionsForTopic = useCallback((topicId: string): MCQQuestion[] => {
    const topic = mcqData.topics[topicId as keyof typeof mcqData.topics] as MCQTopic | undefined;
    return topic ? topic.questions : [];
  }, []);

  const getAllTopics = useCallback((): string[] => {
    return Object.keys(mcqData.topics);
  }, []);

  return {
    allQuestions,
    currentQuestion,
    currentQuestionIndex,
    totalQuestions,
    hasNextQuestion,
    hasPreviousQuestion,
    answerHistory,
    score,
    percentage,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    recordAnswer,
    resetQuiz,
    getQuestionsForTopic,
    getAllTopics
  };
};
