import React, { useCallback, useState, useEffect } from "react";
import { cn, loadUserAdventure, markTopicCompleted, setCurrentTopic } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Volume2, Check, X, Loader2, Mic } from "lucide-react";
import { playClickSound, playMessageSound } from "@/lib/sounds";
import ChatAvatar from "@/components/comic/ChatAvatar";
import InputBar from "@/components/comic/InputBar";
import { aiService } from "@/lib/ai-service";
import { ttsService } from "@/lib/tts-service";
import TopicComplete from "./TopicComplete";
import PracticeNeeded from "./PracticeNeeded";
import confetti from 'canvas-confetti';

// TypeScript interfaces for MCQ data structure
interface AIHook {
  targetWord: string;
  intent: string;
  questionLine: string;
  imagePrompt: string;
}

interface MCQQuestion {
  id: number;
  topicId: string;
  topicName: string;
  questionElements: string;
  answerElements: string;
  templateType: string;
  word: string;
  imageUrl: string | null;
  explanation: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  template: string;
  isSpacing: boolean;
  isSorting: boolean;
  isSpelling: boolean;
  aiHook: AIHook;
  passage?: string; // Optional for reading comprehension
  audio: string; // Audio text for speaker button
}

interface DragDropQuestion {
  id: number;
  topicId: string;
  topicName: string;
  questionElements: string;
  answerElements: string;
  templateType: string;
  word: string;
  imageUrl: string | null;
  explanation: string;
  questionText: string;
  sortingWords: string[];
  sortingBins: string[];
  correctAnswer: Record<string, string[]>;
  template: string;
  isSpacing: boolean;
  isSorting: boolean;
  isSpelling: boolean;
  aiHook: AIHook;
  passage?: string; // Optional for reading comprehension
  audio: string; // Audio text for speaker button
}

interface FillBlankQuestion {
  id: number;
  topicId: string;
  topicName: string;
  questionElements: string;
  answerElements: string;
  templateType: string;
  word: string;
  imageUrl: string | null;
  explanation: string;
  questionText: string;
  correctAnswer: string;
  template: string;
  isSpacing: boolean;
  isSorting: boolean;
  isSpelling: boolean;
  aiHook: AIHook;
  passage?: string; // Optional for reading comprehension
  audio: string; // Audio text for speaker button
}

interface TopicInfo {
  topicId: string;
  topicName: string;
  questionElements: string;
  answerElements: string;
  templateType: string;
}

interface Topic {
  topicInfo: TopicInfo;
  questions: (MCQQuestion | DragDropQuestion | FillBlankQuestion)[];
}

interface MCQData {
  topics: Record<string, Topic>;
}

// Speech Recognition interfaces
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface MCQScreenTypeAProps {
  getAspectRatio: string;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  chatMessages: any[];
  setChatMessages: React.Dispatch<React.SetStateAction<any[]>>;
  onGenerate: (text: string) => void;
  onGenerateImage: () => void;
  chatPanelWidthPercent: number;
  setChatPanelWidthPercent: (width: number) => void;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  messagesScrollRef: React.RefObject<HTMLDivElement>;
  lastMessageCount: number;
  handleResizeStart: (e: React.MouseEvent) => void;
  selectedTopicId?: string;
  onBackToTopics?: () => void;
  onRetryTopic?: () => void;
  onNextTopic?: (nextTopicId?: string) => void;
}

// Sample MCQ data - this would normally come from an API or JSON file
export const sampleMCQData: MCQData = {
  "topics": {
    'K-F.2': {
      topicInfo: {
        topicId: 'K-F.2',
        topicName: 'Choose_the_sentence_that_is_spaced_correctly',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Great job! That sentence is spaced correctly.",
          questionText: "Which sentence is spaced correctly?",
          options: ["Myname is John.", "My nameis John.", "My name is John.", "MynameisJohn."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Which sentence is spaced correctly?",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "My name is John."
        },
        {
          id: 2,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Well done! That sentence is correctly spaced.",
          questionText: "Identify the correctly spaced sentence.",
          options: ["The sun is hot.", "Thesunis hot.", "The sunishot.", "Thesu nis hot."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Identify the correctly spaced sentence.",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "The sun is hot."
        },
        {
          id: 3,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Correct! You found the right sentence spacing.",
          questionText: "Select the sentence with the correct spacing.",
          options: ["Thecat is furry.", "The cat is furry.", "Thecatis furry.", "The catis furry."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Select the sentence with the correct spacing.",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "The cat is furry."
        },
        {
          id: 4,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Nice work! That sentence has the correct spacing.",
          questionText: "Find the correctly spaced sentence.",
          options: ["Ilovemy dog.", "I lovemydog.", "Ilove mydog.", "I love my dog."],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Find the correctly spaced sentence.",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "I love my dog."
        },
        {
          id: 5,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "You're right! That sentence is spaced correctly.",
          questionText: "Which of these sentences is spaced correctly?",
          options: ["We go swimming.", "Wegoswimming.", "We goswimming.", "Wego swimming."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Which of these sentences is spaced correctly?",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "We go swimming."
        },
        {
          id: 6,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Well done! That sentence is correctly spaced.",
          questionText: "Choose the sentence that is spaced correctly.",
          options: ["Heis a teacher.", "He isa teacher.", "He is a teacher.", "Heis ateacher."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Choose the sentence that is spaced correctly.",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "He is a teacher."
        },
        {
          id: 7,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Correct! You've chosen the right sentence.",
          questionText: "Select the sentence with the proper spacing.",
          options: ["Weplay soccer.", "We play soccer.", "Weplaysoccer.", "We play soccer."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Select the sentence with the proper spacing.",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "We play soccer."
        },
        {
          id: 8,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Nice work! That sentence is spaced correctly.",
          questionText: "Find the sentence with correct spacing.",
          options: ["Thebird is flying.", "The birdis flying.", "The bird isflying.", "The bird is flying."],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Find the sentence with correct spacing.",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "The bird is flying."
        },
        {
          id: 9,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "You're right! That sentence is spaced correctly.",
          questionText: "Which sentence has the correct spacing?",
          options: ["I like ice cream.", "Ilike ice cream.", "I likeice cream.", "Ilikeicecream."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Which sentence has the correct spacing?",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "I like ice cream."
        },
        {
          id: 10,
          topicId: 'K-F.2',
          topicName: 'Choose_the_sentence_that_is_spaced_correctly',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Well done! That's the correctly spaced sentence.",
          questionText: "Pick the sentence that is spaced correctly.",
          options: ["Sheloves cats.", "Shelovescats.", "She loves cats.", "She lovescats."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: true,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Pick the sentence that is spaced correctly.",
            imagePrompt: 'Educational scene showing choose_the_sentence_that_is_spaced_correctly concepts'
          },
          audio: "She loves cats"
        }
      ],
    },
  
    '1-B.1': {
      topicInfo: {
        topicId: '1-B.1',
        topicName: 'How_many_syllables_does_the_word_have',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'elephant',
          imageUrl: null,
          explanation: "Great job! 'Elephant' has three syllables: el-e-phant.",
          questionText: "Listen to the word 'elephant.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'elephant',
            intent: 'mcq',
            questionLine: "Listen to the word 'elephant.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "elephant"
        },
        {
          id: 2,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'banana',
          imageUrl: null,
          explanation: "Well done! 'Banana' has three syllables: ba-na-na.",
          questionText: "Listen to the word 'banana.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'banana',
            intent: 'mcq',
            questionLine: "Listen to the word 'banana.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "banana"
        },
        {
          id: 3,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'computer',
          imageUrl: null,
          explanation: "Nice work! 'Computer' has three syllables: com-pu-ter.",
          questionText: "Listen to the word 'computer.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'computer',
            intent: 'mcq',
            questionLine: "Listen to the word 'computer.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "computer"
        },
        {
          id: 4,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'umbrella',
          imageUrl: null,
          explanation: "Excellent! 'Umbrella' has three syllables: um-brel-la.",
          questionText: "Listen to the word 'umbrella.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'umbrella',
            intent: 'mcq',
            questionLine: "Listen to the word 'umbrella.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "umbrella"
        },
        {
          id: 5,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'giraffe',
          imageUrl: null,
          explanation: "Good job! 'Giraffe' has two syllables: gi-raffe.",
          questionText: "Listen to the word 'giraffe.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'giraffe',
            intent: 'mcq',
            questionLine: "Listen to the word 'giraffe.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "giraffe"
        },
        {
          id: 6,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'cucumber',
          imageUrl: null,
          explanation: "Great! 'Cucumber' has three syllables: cu-cum-ber.",
          questionText: "Listen to the word 'cucumber.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'cucumber',
            intent: 'mcq',
            questionLine: "Listen to the word 'cucumber.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "cucumber"
        },
        {
          id: 7,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'chocolate',
          imageUrl: null,
          explanation: "Correct! 'Chocolate' usually has three syllables: cho-co-late.",
          questionText: "Listen to the word 'chocolate.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'chocolate',
            intent: 'mcq',
            questionLine: "Listen to the word 'chocolate.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "chocolate"
        },
        {
          id: 8,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'dinosaur',
          imageUrl: null,
          explanation: "Awesome! 'Dinosaur' has three syllables: di-no-saur.",
          questionText: "Listen to the word 'dinosaur.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'dinosaur',
            intent: 'mcq',
            questionLine: "Listen to the word 'dinosaur.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "dinosaur"
        },
        {
          id: 9,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'avocado',
          imageUrl: null,
          explanation: "Fantastic! 'Avocado' has four syllables: a-vo-ca-do.",
          questionText: "Listen to the word 'avocado.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'avocado',
            intent: 'mcq',
            questionLine: "Listen to the word 'avocado.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "avocado"
        },
        {
          id: 10,
          topicId: '1-B.1',
          topicName: 'How_many_syllables_does_the_word_have',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'butterfly',
          imageUrl: null,
          explanation: "You're right! 'Butterfly' has three syllables: but-ter-fly.",
          questionText: "Listen to the word 'butterfly.' How many syllables does it have?",
          options: ["2", "3", "4", "5"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'butterfly',
            intent: 'mcq',
            questionLine: "Listen to the word 'butterfly.' How many syllables does it have?",
            imagePrompt: 'Educational scene showing how_many_syllables_does_the_word_have concepts'
          },
          audio: "butterfly"
        }
      ],
    },
    '1-S.3': {
      topicInfo: {
        topicId: '1-S.3',
        topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! 'Tie' matches the picture.",
          questionText: "Which word matches the picture?",
          options: ["tie", "tick", "tin", "tide"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "tie"
        },
        {
          id: 2,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! 'Dime' is the correct choice.",
          questionText: "Which word matches the picture?",
          options: ["dim", "dime", "dine", "dip"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "dime"
        },
        {
          id: 3,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "That's right! 'Fill' is the word that fits.",
          questionText: "Which word matches the picture?",
          options: ["fill", "file", "fin", "five"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "fill"
        },
        {
          id: 4,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Correct! 'Pine' matches the picture.",
          questionText: "Which word matches the picture?",
          options: ["pin", "pile", "pill", "pine"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "pine"
        },
        {
          id: 5,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice work! 'Mile' is the matching word.",
          questionText: "Which word matches the picture?",
          options: ["mill", "milk", "mile", "mint"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "mile"
        },
        {
          id: 6,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "You got it! 'Sit' is the correct choice.",
          questionText: "Which word matches the picture?",
          options: ["sit", "site", "sight", "sip"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "sit"
        },
        {
          id: 7,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent! 'Ripe' is the matching word.",
          questionText: "Which word matches the picture?",
          options: ["rip", "rid", "ride", "ripe"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "ripe"
        },
        {
          id: 8,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Correct! 'Five' matches the picture.",
          questionText: "Which word matches the picture?",
          options: ["fin", "five", "fit", "fig"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "five"
        },
        {
          id: 9,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! 'File' is the correct choice.",
          questionText: "Which word matches the picture?",
          options: ["fill", "file", "flit", "fist"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "file"
        },
        {
          id: 10,
          topicId: '1-S.3',
          topicName: 'Choose_the_short_i_or_long_i_word_that_matches_the_picture',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice! 'Line' is the word that matches.",
          questionText: "Which word matches the picture?",
          options: ["lip", "lit", "line", "lid"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_i_or_long_i_word_that_matches_the_picture concepts'
          },
          audio: "line"
        }
      ],
    },
    '1-S.4': {
      topicInfo: {
        topicId: '1-S.4',
        topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Great job! The picture shows a pot.",
          questionText: "Which word matches the picture?",
          options: ["pot", "pote", "pat", "pate"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "pot"
        },
        {
          id: 2,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'long o sounds',
          imageUrl: null,
          explanation: "Well done! The picture shows a cone.",
          questionText: "Which word matches the picture?",
          options: ["con", "cone", "can", "cane"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'long o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "cone"
        },
        {
          id: 3,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Nice work! The picture shows a log.",
          questionText: "Which word matches the picture?",
          options: ["lug", "leg", "lag", "log"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "log"
        },
        {
          id: 4,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'long o sounds',
          imageUrl: null,
          explanation: "Excellent! The picture shows a rope.",
          questionText: "Which word matches the picture?",
          options: ["rop", "rap", "rope", "reap"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'long o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "rope"
        },
        {
          id: 5,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'long o sounds',
          imageUrl: null,
          explanation: "Good job! The picture shows a bone.",
          questionText: "Which word matches the picture?",
          options: ["bone", "bon", "bin", "bane"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'long o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "bone"
        },
        {
          id: 6,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "You're right! The picture shows a sock.",
          questionText: "Which word matches the picture?",
          options: ["sack", "sock", "suck", "seek"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "sock"
        },
        {
          id: 7,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'long o sounds',
          imageUrl: null,
          explanation: "Correct! The picture shows a rose.",
          questionText: "Which word matches the picture?",
          options: ["rise", "rice", "race", "rose"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'long o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "rose"
        },
        {
          id: 8,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Well done! The picture shows a frog.",
          questionText: "Which word matches the picture?",
          options: ["frug", "flag", "frog", "frag"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "frog"
        },
        {
          id: 9,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'long o sounds',
          imageUrl: null,
          explanation: "Nice choice! The picture shows a coat.",
          questionText: "Which word matches the picture?",
          options: ["cot", "coat", "cat", "cut"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'long o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "coat"
        },
        {
          id: 10,
          topicId: '1-S.4',
          topicName: 'Choose_the_short_o_or_long_o_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Good choice! The picture shows a dog.",
          questionText: "Which word matches the picture?",
          options: ["dog", "dag", "dig", "dug"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_o_or_long_o_word_that_matches_the_picture concepts'
          },
          audio: "dog"
        }
      ],
    },
    '1-S.5': {
      topicInfo: {
        topicId: '1-S.5',
        topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! The picture matches the word with the correct vowel sound.",
          questionText: "Which word matches the picture?",
          options: ["glue", "glum", "gloom", "glow"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "glue"
        },
        {
          id: 2,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! You chose the correct word for the image.",
          questionText: "Which word matches the picture?",
          options: ["tub", "tube", "tab", "tubing"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "tube"
        },
        {
          id: 3,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "That's right! The word matches the picture perfectly.",
          questionText: "Which word matches the picture?",
          options: ["bug", "bag", "bugle", "bog"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "bugle"
        },
        {
          id: 4,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent! You picked the right word for the image.",
          questionText: "Which word matches the picture?",
          options: ["bun", "bunk", "bank", "bent"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "bunk"
        },
        {
          id: 5,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice work! You selected the correct word.",
          questionText: "Which word matches the picture?",
          options: ["sun", "son", "sin", "sang"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "sun"
        },
        {
          id: 6,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Correct! The word matches the picture.",
          questionText: "Which word matches the picture?",
          options: ["dune", "done", "din", "dune"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "dune"
        },
        {
          id: 7,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Awesome! You matched the word correctly.",
          questionText: "Which word matches the picture?",
          options: ["cub", "cab", "cube", "curb"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "cube"
        },
        {
          id: 8,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Good choice! The word matches the image.",
          questionText: "Which word matches the picture?",
          options: ["crum", "crumb", "cramp", "cream"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "crumb"
        },
        {
          id: 9,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "You got it! The word fits the picture.",
          questionText: "Which word matches the picture?",
          options: ["jump", "jamp", "jimp", "jamb"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "jump"
        },
        {
          id: 10,
          topicId: '1-S.5',
          topicName: 'Choose_the_short_u_or_long_u_word_that_matches_the_picture',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "That's right! You chose the correct word.",
          questionText: "Which word matches the picture?",
          options: ["mug", "meg", "mog", "mule"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word matches the picture?",
            imagePrompt: 'Educational scene showing choose_the_short_u_or_long_u_word_that_matches_the_picture concepts'
          },
          audio: "mule"
        }
      ],
      
    },
    '1-S.6': {
      topicInfo: {
        topicId: '1-S.6',
        topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
        questionElements: 'text+image',
        answerElements: 'text',
        templateType: 'drag_and_drop_sorting'
      },
      questions: [
        {
          id: 1,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! 'Fin' has a short 'i' sound, and 'fine' has a long 'i' sound.",
          questionText: "Sort the words 'fin' and 'fine' by their vowel sounds.",
          sortingWords: ["fin", "fine"],
          sortingBins: ["Short i", "Long i"],
          correctAnswer: {"Short i": ["fin"], "Long i": ["fine"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'fin' and 'fine' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "fin, fine"
        },
        {
          id: 2,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! 'Fell' has a short 'e' sound, and 'feel' has a long 'e' sound.",
          questionText: "Sort the words 'fell' and 'feel' by their vowel sounds.",
          sortingWords: ["fell", "feel"],
          sortingBins: ["Short e", "Long e"],
          correctAnswer: {"Short e": ["fell"], "Long e": ["feel"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'fell' and 'feel' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "fell, feel"
        },
        {
          id: 3,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent! 'Back' has a short 'a' sound, and 'bake' has a long 'a' sound.",
          questionText: "Sort the words 'back' and 'bake' by their vowel sounds.",
          sortingWords: ["back", "bake"],
          sortingBins: ["Short a", "Long a"],
          correctAnswer: {"Short a": ["back"], "Long a": ["bake"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'back' and 'bake' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "back, bake"
        },
        {
          id: 4,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice work! 'Hot' has a short 'o' sound, and 'hope' has a long 'o' sound.",
          questionText: "Sort the words 'hot' and 'hope' by their vowel sounds.",
          sortingWords: ["hot", "hope"],
          sortingBins: ["Short o", "Long o"],
          correctAnswer: {"Short o": ["hot"], "Long o": ["hope"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'hot' and 'hope' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "hot, hope"
        },
        {
          id: 5,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Good job! 'Cub' has a short 'u' sound, and 'cube' has a long 'u' sound.",
          questionText: "Sort the words 'cub' and 'cube' by their vowel sounds.",
          sortingWords: ["cub", "cube"],
          sortingBins: ["Short u", "Long u"],
          correctAnswer: {"Short u": ["cub"], "Long u": ["cube"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'cub' and 'cube' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "cub,cube"
        },
        {
          id: 6,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Awesome! 'Bit' has a short 'i' sound, and 'bite' has a long 'i' sound.",
          questionText: "Sort the words 'bit' and 'bite' by their vowel sounds.",
          sortingWords: ["bit", "bite"],
          sortingBins: ["Short i", "Long i"],
          correctAnswer: {"Short i": ["bit"], "Long i": ["bite"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'bit' and 'bite' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "bit, bite"
        },
        {
          id: 7,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great! 'Pet' has a short 'e' sound, and 'peat' has a long 'e' sound.",
          questionText: "Sort the words 'pet' and 'peat' by their vowel sounds.",
          sortingWords: ["pet", "peat"],
          sortingBins: ["Short e", "Long e"],
          correctAnswer: {"Short e": ["pet"], "Long e": ["peat"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'pet' and 'peat' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "pet, peat"
        },
        {
          id: 8,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice! 'Cot' has a short 'o' sound, and 'coat' has a long 'o' sound.",
          questionText: "Sort the words 'cot' and 'coat' by their vowel sounds.",
          sortingWords: ["cot", "coat"],
          sortingBins: ["Short o", "Long o"],
          correctAnswer: {"Short o": ["cot"], "Long o": ["coat"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'cot' and 'coat' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "cot, coat"
        },
        {
          id: 9,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! 'Tub' has a short 'u' sound, and 'tube' has a long 'u' sound.",
          questionText: "Sort the words 'tub' and 'tube' by their vowel sounds.",
          sortingWords: ["tub", "tube"],
          sortingBins: ["Short u", "Long u"],
          correctAnswer: {"Short u": ["tub"], "Long u": ["tube"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'tub' and 'tube' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "tub, tube"
        },
        {
          id: 10,
          topicId: '1-S.6',
          topicName: 'Use_spelling_patterns_to_sort_long_and_short_vowel_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Fantastic! 'Cat' has a short 'a' sound, and 'cake' has a long 'a' sound.",
          questionText: "Sort the words 'cat' and 'cake' by their vowel sounds.",
          sortingWords: ["cat", "cake"],
          sortingBins: ["Short a", "Long a"],
          correctAnswer: {"Short a": ["cat"], "Long a": ["cake"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words 'cat' and 'cake' by their vowel sounds.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_and_short_vowel_words concepts'
          },
          audio: "cat, cake"
        }
      ],
    },
    '1-G.2': {
      topicInfo: {
        topicId: '1-G.2',
        topicName: 'Choose_the_correct_digraph',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Great job! The word 'ship' starts with the 'sh' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "th", "ch", "ph"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "ship"
        },
        {
          id: 2,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Well done! The word 'thumb' starts with the 'th' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "th", "ch", "wh"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "thumb"
        },
        {
          id: 3,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Nice work! The word 'chip' starts with the 'ch' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "th", "ch", "ph"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "chip"
        },
        {
          id: 4,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Correct! The word 'sheep' starts with the 'sh' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "wh", "th", "ch"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "sheep"
        },
        {
          id: 5,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Great job! The word 'whale' starts with the 'wh' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "wh", "ch", "th"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "whale"
        },
        {
          id: 6,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Well done! The word 'phone' starts with the 'ph' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "ch", "ph", "th"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "phone"
        },
        {
          id: 7,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Nice work! The word 'whisper' starts with the 'wh' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "wh", "th", "ch"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "whisper"
        },
        {
          id: 8,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Correct! The word 'chair' starts with the 'ch' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["th", "wh", "ch", "sh"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "chair"
        },
        {
          id: 9,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Great job! The word 'shell' starts with the 'sh' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "th", "wh", "ch"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "shell"
        },
        {
          id: 10,
          topicId: '1-G.2',
          topicName: 'Choose_the_correct_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'digraph identification',
          imageUrl: null,
          explanation: "Well done! The word 'this' starts with the 'th' sound.",
          questionText: "Listen to the word. Which sound does it start with?",
          options: ["sh", "ch", "wh", "th"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'digraph identification',
            intent: 'mcq',
            questionLine: "Listen to the word. Which sound does it start with?",
            imagePrompt: 'Educational scene showing choose_the_correct_digraph concepts'
          },
          audio: "this"
        }
      ],
    },
    '1-N.1': {
      topicInfo: {
        topicId: '1-N.1',
        topicName: 'Identify_the_short_vowel_sound_in_a_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short a sound',
          imageUrl: null,
          explanation: "Great job! The word has a short 'a' sound.",
          questionText: "Listen to the word 'cat'. Which vowel sound does it have?",
          options: ["a", "e", "i", "o"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'cat'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "cat"
        },
        {
          id: 2,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short e sound',
          imageUrl: null,
          explanation: "Well done! The word has a short 'e' sound.",
          questionText: "Listen to the word 'bed'. Which vowel sound does it have?",
          options: ["a", "e", "i", "u"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'bed'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "bed"
        },
        {
          id: 3,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short i sound',
          imageUrl: null,
          explanation: "Awesome! The word has a short 'i' sound.",
          questionText: "Listen to the word 'fish'. Which vowel sound does it have?",
          options: ["a", "e", "i", "o"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'fish'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "fish"
        },
        {
          id: 4,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short o sound',
          imageUrl: null,
          explanation: "Great choice! The word has a short 'o' sound.",
          questionText: "Listen to the word 'dog'. Which vowel sound does it have?",
          options: ["a", "e", "i", "o"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'dog'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "dog"
        },
        {
          id: 5,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short u sound',
          imageUrl: null,
          explanation: "Nice work! The word has a short 'u' sound.",
          questionText: "Listen to the word 'cup'. Which vowel sound does it have?",
          options: ["a", "e", "i", "u"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'cup'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "cup"
        },
        {
          id: 6,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short a sound',
          imageUrl: null,
          explanation: "Correct! The word has a short 'a' sound.",
          questionText: "Listen to the word 'bat'. Which vowel sound does it have?",
          options: ["a", "e", "i", "o"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'bat'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "bat"
        },
        {
          id: 7,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short e sound',
          imageUrl: null,
          explanation: "You got it! The word has a short 'e' sound.",
          questionText: "Listen to the word 'pen'. Which vowel sound does it have?",
          options: ["a", "e", "i", "u"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'pen'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "pen"
        },
        {
          id: 8,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short i sound',
          imageUrl: null,
          explanation: "Well done! The word has a short 'i' sound.",
          questionText: "Listen to the word 'sit'. Which vowel sound does it have?",
          options: ["a", "e", "i", "o"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'sit'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "sit"
        },
        {
          id: 9,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short o sound',
          imageUrl: null,
          explanation: "Excellent! The word has a short 'o' sound.",
          questionText: "Listen to the word 'log'. Which vowel sound does it have?",
          options: ["a", "e", "i", "o"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'log'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "log"
        },
        {
          id: 10,
          topicId: '1-N.1',
          topicName: 'Identify_the_short_vowel_sound_in_a_word',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short u sound',
          imageUrl: null,
          explanation: "Great job! The word has a short 'u' sound.",
          questionText: "Listen to the word 'mud'. Which vowel sound does it have?",
          options: ["a", "e", "i", "u"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sound',
            intent: 'mcq',
            questionLine: "Listen to the word 'mud'. Which vowel sound does it have?",
            imagePrompt: 'Educational scene showing identify_the_short_vowel_sound_in_a_word concepts'
          },
          audio: "mud"
        }
      ],
    },
    '1-D.2': {
      topicInfo: {
        topicId: '1-D.2',
        topicName: 'Identify_each_sound_in_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Great job! The first sound in the word is 'b'.",
          questionText: "Listen to the word. What is the first sound in the word 'bat'?",
          options: ["b", "t", "a", "d"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'bat'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "bat"
        },
        {
          id: 2,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Correct! The first sound in 'cat' is 'c'.",
          questionText: "Listen to the word. What is the first sound in the word 'cat'?",
          options: ["t", "c", "a", "k"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'cat'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "cat"
        },
        {
          id: 3,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Well done! The first sound in 'dog' is 'd'.",
          questionText: "Listen to the word. What is the first sound in the word 'dog'?",
          options: ["g", "o", "d", "f"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'dog'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "dog"
        },
        {
          id: 4,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Nice! The first sound in 'fish' is 'f'.",
          questionText: "Listen to the word. What is the first sound in the word 'fish'?",
          options: ["i", "s", "h", "f"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'fish'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "fish"
        },
        {
          id: 5,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Great! The first sound in 'hat' is 'h'.",
          questionText: "Listen to the word. What is the first sound in the word 'hat'?",
          options: ["h", "t", "a", "s"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'hat'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "hat"
        },
        {
          id: 6,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Correct! The first sound in 'log' is 'l'.",
          questionText: "Listen to the word. What is the first sound in the word 'log'?",
          options: ["o", "l", "g", "n"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'log'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "log"
        },
        {
          id: 7,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Well done! The first sound in 'net' is 'n'.",
          questionText: "Listen to the word. What is the first sound in the word 'net'?",
          options: ["t", "e", "n", "r"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'net'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "net"
        },
        {
          id: 8,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Nice! The first sound in 'pen' is 'p'.",
          questionText: "Listen to the word. What is the first sound in the word 'pen'?",
          options: ["e", "n", "l", "p"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'pen'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "pen"
        },
        {
          id: 9,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Great job! The first sound in 'rat' is 'r'.",
          questionText: "Listen to the word. What is the first sound in the word 'rat'?",
          options: ["r", "a", "t", "f"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'rat'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "rat"
        },
        {
          id: 10,
          topicId: '1-D.2',
          topicName: 'Identify_each_sound_in_a_word',
          questionElements: 'image + audio + text',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'beginning sounds',
          imageUrl: null,
          explanation: "Correct! The first sound in 'sun' is 's'.",
          questionText: "Listen to the word. What is the first sound in the word 'sun'?",
          options: ["u", "s", "n", "t"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'beginning sounds',
            intent: 'mcq',
            questionLine: "Listen to the word. What is the first sound in the word 'sun'?",
            imagePrompt: 'Educational scene showing identify_each_sound_in_a_word concepts'
          },
          audio: "sun"
        }
      ],
    },
    '1-G.3': {
      topicInfo: {
        topicId: '1-G.3',
        topicName: 'Complete_the_word_with_the_right_digraph',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Great job! The correct digraph completes the word.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _ank",
          options: ["ch", "th", "sh", "wh"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _ank",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "thank"
        },
        {
          id: 2,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Well done! You selected the right digraph.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _at",
          options: ["sh", "ch", "th", "wh"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _at",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "what"
        },
        {
          id: 3,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Correct! That’s the right digraph.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _ip",
          options: ["ch", "th", "sh", "ph"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _ip",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "chip"
        },
        {
          id: 4,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Nice work! You got it right.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _ick",
          options: ["wh", "ch", "th", "sh"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _ick",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "thick"
        },
        {
          id: 5,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "That's correct! You've chosen the right digraph.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _eese",
          options: ["ch", "wh", "sh", "th"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _eese",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "cheese"
        },
        {
          id: 6,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Good choice! You completed the word correctly.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _row",
          options: ["sh", "th", "ch", "wh"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _row",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "throw"
        },
        {
          id: 7,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Excellent! That is the right digraph.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _ip",
          options: ["ch", "sh", "th", "wh"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _ip",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "whip"
        },
        {
          id: 8,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Great job! You picked the right digraph.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _ark",
          options: ["th", "ch", "sh", "wh"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _ark",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "shark"
        },
        {
          id: 9,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Correct! You chose the right digraph.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _ain",
          options: ["ch", "sh", "th", "ph"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _ain",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "chain"
        },
        {
          id: 10,
          topicId: '1-G.3',
          topicName: 'Complete_the_word_with_the_right_digraph',
          questionElements: 'audio + text+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Nicely done! That’s the correct digraph.",
          questionText: "Listen to the word. Then, fill in the missing digraph: _eel",
          options: ["ch", "wh", "th", "sh"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Listen to the word. Then, fill in the missing digraph: _eel",
            imagePrompt: 'Educational scene showing complete_the_word_with_the_right_digraph concepts'
          },
          audio: "wheel"
        }
      ],
    },
    '1-H.1': {
      topicInfo: {
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank'
      },
    questions: [
      {
        id: 1,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Great job! The word is 'flack'.",
        questionText: "Complete the word to match the picture: _ack",
        correctAnswer: 'flack',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ack",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
          audio: "whack"
        },
      {
        id: 2,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Excellent! The word is 'grab'.",
        questionText: "Complete the word to match the picture: _ab",
        correctAnswer: 'grab',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ab",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
          audio: "grab"
        },
      {
        id: 3,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Well done! The word is 'step'.",
        questionText: "Complete the word to match the picture: _ep",
        correctAnswer: 'step',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ep",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
        audio: "step"
      },
      {
        id: 4,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Awesome! The word is 'block'.",
        questionText: "Complete the word to match the picture: _ock",
        correctAnswer: 'blend',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ock",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
        audio: "block"
      },
      {
        id: 5,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Nice work! The word is 'crab'.",
        questionText: "Complete the word to match the picture: _ab",
        correctAnswer: 'crab',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ab",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
        audio: "crab"
      },
      {
        id: 6,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "You did it! The word is 'trap'.",
        questionText: "Complete the word to match the picture: _ap",
        correctAnswer: 'trap',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ap",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
        audio: "trap"
      },
      {
        id: 7,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Fantastic! The word is 'spade'.",
        questionText: "Complete the word to match the picture: _ade",
        correctAnswer: 'spade',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ade",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
        audio: "spade"
      },
      {
        id: 8,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Good job! The word is 'clock'.",
        questionText: "Complete the word to match the picture: _ock",
        correctAnswer: 'clock',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ock",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
        audio: "clock"
      },
      {
        id: 9,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Terrific! The word is 'drop'.",
        questionText: "Complete the word to match the picture: _op",
        correctAnswer: 'drop',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _op",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
        audio: "drop"
      },
      {
        id: 10,
        topicId: '1-H.1',
        topicName: 'Complete_the_word_with_the_right_initial_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Wonderful! The word is 'slip'.",
        questionText: "Complete the word to match the picture: _ip",
        correctAnswer: 'slip',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word to match the picture: _ip",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_initial_consonant_blend concepts'
        },
        audio: "slip"
      }
    ],
    
  },
  '1-H.2': {
    topicInfo: {
      topicId: '1-H.2',
      topicName: 'Does_the_word_start_with_a_consonant_blend',
      questionElements: 'image + audio + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Great job! 'Blush' starts with the consonant blend 'bl'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["blush", "lush", "rush", "hush"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "blush"
        },
      {
        id: 2,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Excellent! 'Clap' starts with the consonant blend 'cl'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["cap", "clap", "map", "tap"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "clap"
        },
      {
        id: 3,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Well done! 'Frog' starts with the consonant blend 'fr'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["fog", "log", "frog", "dog"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "frog"
        },
      {
        id: 4,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Nice work! 'Stump' starts with the consonant blend 'st'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["ump", "bump", "jump", "stump"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "stump"
        },
      {
        id: 5,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "You got it! 'Crab' starts with the consonant blend 'cr'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["crab", "rab", "cab", "dab"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "crab"
        },
      {
        id: 6,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Good choice! 'Slide' starts with the consonant blend 'sl'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["side", "hide", "slide", "stride"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "slide"
        },
      {
        id: 7,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Correct! 'Glove' starts with the consonant blend 'gl'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["love", "glove", "shove", "dove"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "glove"
        },
      {
        id: 8,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Well done! 'Snail' starts with the consonant blend 'sn'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["nail", "rail", "tail", "snail"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "snail"
        },
      {
        id: 9,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Awesome! 'Brush' starts with the consonant blend 'br'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["brush", "rush", "lush", "mush"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
          audio: "brush"
        },
      {
        id: 10,
        topicId: '1-H.2',
        topicName: 'Does_the_word_start_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Nice! 'Slide' starts with the consonant blend 'sl'.",
        questionText: "Which word starts with a consonant blend?",
        options: ["side", "ride", "slide", "glide"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word starts with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_start_with_a_consonant_blend concepts'
        },
        audio: "slide"
      }
    ],
    
  },
  '1-H.4': {
    topicInfo: {
      topicId: '1-H.4',
      topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'fill_blank'
    },
    questions: [
      {
        id: 1,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Great job! The word is 'pond'.",
        questionText: "Complete the word: po__",
        correctAnswer: 'pond',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: po__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
          audio: "pond"
        },
      {
        id: 2,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Well done! The word is 'hump'.",
        questionText: "Complete the word: hu__",
        correctAnswer: 'hump',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: hu__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
        audio: "hump"
      },
      {
        id: 3,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Nice work! The word is 'pink'.",
        questionText: "Complete the word: pi__",
        correctAnswer: 'pink',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: pi__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
        audio: "pink"
      },
      {
        id: 4,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Excellent! The word is 'task'.",
        questionText: "Complete the word: ta__",
        correctAnswer: 'task',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: ta__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
        audio: "task"
      },
      {
        id: 5,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "You're right! The word is 'lift'.",
        questionText: "Complete the word: li__",
        correctAnswer: 'lift',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: li__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
        audio: "lift"
      },
      {
        id: 6,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Nice job! The word is 'nest'.",
        questionText: "Complete the word: ne__",
        correctAnswer: 'nest',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: ne__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
        audio: "nest"
      },
      {
        id: 7,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Great! The word is 'hand'.",
        questionText: "Complete the word: ha__",
        correctAnswer: 'hand',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: ha__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
        audio: "hand"
      },
      {
        id: 8,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Correct! The word is 'tent'.",
        questionText: "Complete the word: te__",
        correctAnswer: 'tent',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: te__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
        audio: "tent"
      },
      {
        id: 9,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Awesome! The word is 'fork'.",
        questionText: "Complete the word: fo__",
        correctAnswer: 'fork',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: fo__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
        },
        audio: "fork"
      },
      {
        id: 10,
        topicId: '1-H.4',
        topicName: 'Complete_the_word_with_the_right_final_consonant_blend',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'blend',
        imageUrl: null,
        explanation: "Excellent! The word is 'cold'.",
        questionText: "Complete the word: co__",
        correctAnswer: 'cold',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'blend',
          intent: 'fill_blank',
          questionLine: "Complete the word: co__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_final_consonant_blend concepts'
            },
        audio: "cold"
      }
    ],
    
  },
  '1-H.5': {
    topicInfo: {
      topicId: '1-H.5',
      topicName: 'Does_the_word_end_with_a_consonant_blend',
      questionElements: 'image + audio + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Great job! 'Cast' ends with the consonant blend 'st'.",
        questionText: "Which word ends with a consonant blend?",
        options: ["Can", "Cap", "Cast", "Cat"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word ends with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Cast"
        },
      {
        id: 2,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Well done! 'Lamp' ends with the consonant blend 'mp'.",
        questionText: "Select the word that ends with a consonant blend.",
        options: ["Lap", "Lay", "Lab", "Lamp"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Select the word that ends with a consonant blend.",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Lamp"
        },
      {
        id: 3,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Correct! 'Bend' ends with the consonant blend 'nd'.",
        questionText: "Which of these words ends with a consonant blend?",
        options: ["Bend", "Bee", "Bow", "Bat"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which of these words ends with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Bend"
        },
      {
        id: 4,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Nice work! 'Milk' ends with the consonant blend 'lk'.",
        questionText: "Identify the word that ends with a consonant blend.",
        options: ["Mile", "Milk", "Mild", "Mill"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Identify the word that ends with a consonant blend.",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Milk"
        },
      {
        id: 5,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Excellent! 'Desk' ends with the consonant blend 'sk'.",
        questionText: "Choose the word that ends with a consonant blend.",
        options: ["Den", "Dig", "Dab", "Desk"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Choose the word that ends with a consonant blend.",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Desk"
        },
      {
        id: 6,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Good job! 'Bark' ends with the consonant blend 'rk'.",
        questionText: "Which word ends with a consonant blend?",
        options: ["Bar", "Bark", "Bat", "Bee"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word ends with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Bark"
        },
      {
        id: 7,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "You've got it! 'Task' ends with the consonant blend 'sk'.",
        questionText: "Select the word that ends with a consonant blend.",
        options: ["Tap", "Tie", "Task", "Tug"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Select the word that ends with a consonant blend.",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Task"
        },
      {
        id: 8,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Correct! 'Gift' ends with the consonant blend 'ft'.",
        questionText: "Which of these words ends with a consonant blend?",
        options: ["Gift", "Give", "Go", "Gas"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which of these words ends with a consonant blend?",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Gift"
        },
      {
        id: 9,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Nice choice! 'Help' ends with the consonant blend 'lp'.",
        questionText: "Identify the word that ends with a consonant blend.",
        options: ["Hot", "Hip", "Help", "Hat"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Identify the word that ends with a consonant blend.",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
        },
          audio: "Help"
        },
      {
        id: 10,
        topicId: '1-H.5',
        topicName: 'Does_the_word_end_with_a_consonant_blend',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Great! 'Mask' ends with the consonant blend 'sk'.",
        questionText: "Choose the word that ends with a consonant blend.",
        options: ["Mat", "Mask", "Man", "Mud"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Choose the word that ends with a consonant blend.",
          imagePrompt: 'Educational scene showing does_the_word_end_with_a_consonant_blend concepts'
              },
        audio: "mask"
      }
    ],
    
  },
  '1-I.1': {
    topicInfo: {
      topicId: '1-I.1',
      topicName: 'Choose_the_short_a_word_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Great job! The word 'cat' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["cat", "cot", "cut", "kit"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "Mask"
        },
      {
        id: 2,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Well done! The word 'bat' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["bet", "bat", "bit", "bot"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "bat"
        },
      {
        id: 3,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Nice choice! The word 'mat' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["met", "mit", "mat", "mot"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "mat"
        },
      {
        id: 4,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "You got it! The word 'rat' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["rot", "rat", "rut", "ret"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "rat"
        },
      {
        id: 5,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Correct! The word 'hat' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["hat", "hit", "hot", "hut"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "hat"
        },
      {
        id: 6,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Great! The word 'pan' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["pen", "pin", "pan", "pun"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "pan"
        },
      {
        id: 7,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Nicely done! The word 'can' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["con", "can", "cin", "cun"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "can"
        },
      {
        id: 8,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Excellent! The word 'bag' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["beg", "bug", "big", "bag"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "bag"
        },
      {
        id: 9,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "You did it! The word 'jam' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["jam", "jim", "jum", "jom"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
        },
          audio: "jam"
        },
      {
        id: 10,
        topicId: '1-I.1',
        topicName: 'Choose_the_short_a_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Good choice! The word 'lap' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["lip", "lop", "lep", "lap"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_word_that_matches_the_picture concepts'
                    },
        audio: "lap"
      }
    ],
    
  },
  '1-I.2': {
    topicInfo: {
      topicId: '1-I.2',
      topicName: 'Read_words_with_am_and_an',
      questionElements: 'image + audio + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Great job! 'Ram' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["rag", "ran", "ram", "rat"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "lap"
        },
      {
        id: 2,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Excellent! 'Fan' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["fat", "tan", "fan", "pan"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "fan"
        },
      {
        id: 3,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Well done! 'Ham' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["hall", "ham", "jam", "han"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "ham"
        },
      {
        id: 4,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel sorting',
        imageUrl: null,
        explanation: "That's correct! 'Can' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["cap", "cat", "cab", "can"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel sorting',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "can"
        },
      {
        id: 5,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Nice work! 'Dam' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["dam", "dim", "dum", "dom"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "dam"
        },
      {
        id: 6,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel sorting',
        imageUrl: null,
        explanation: "Correct! 'Pan' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["pin", "pan", "pen", "pun"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel sorting',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "pan"
        },
      {
        id: 7,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "You got it! 'Jam' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["jam", "jog", "jug", "jag"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "jug"
        },
      {
        id: 8,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Awesome! 'Man' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["man", "men", "min", "mon"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "man"
        },
      {
        id: 9,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel sorting',
        imageUrl: null,
        explanation: "Well done! 'Van' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["vin", "von", "van", "ven"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel sorting',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
        },
          audio: "van"
        },
      {
        id: 10,
        topicId: '1-I.2',
        topicName: 'Read_words_with_am_and_an',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'blend',
        imageUrl: null,
        explanation: "Great choice! 'Ram' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["rim", "ram", "rum", "rom"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'blend',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing read_words_with_am_and_an concepts'
                                },
        audio: "ram"
      }
    ],
    
  },
  '1-I.3': {
    topicInfo: {
      topicId: '1-I.3',
      topicName: 'Complete_the_short_a_word',
      questionElements: 'image + audio + text',
      answerElements: 'text',
      templateType: 'fill_blank'
    },
    questions: [
      {
        id: 1,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Great job! 'Bat' is the word you were looking for.",
        questionText: "Fill in the blank to complete the word: _at (Hint: A flying mammal)",
        correctAnswer: 'bat',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: _at (Hint: A flying mammal)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
          audio: "ram"
        },
      {
        id: 2,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Well done! 'Cat' was the correct answer.",
        questionText: "Fill in the blank to complete the word: _at (Hint: A common pet)",
        correctAnswer: 'cat',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: _at (Hint: A common pet)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
        audio: "cat"
      },
      {
        id: 3,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Nice work! 'Hat' is the word you needed.",
        questionText: "Fill in the blank to complete the word: _at (Hint: Worn on the head)",
        correctAnswer: 'hat',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: _at (Hint: Worn on the head)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
        audio: "hat"
      },
      {
        id: 4,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Correct! 'Sad' fits perfectly.",
        questionText: "Fill in the blank to complete the word: _ad (Hint: Feeling unhappy)",
        correctAnswer: 'sad',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: _ad (Hint: Feeling unhappy)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
        audio: "sad"
      },
      {
        id: 5,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Good job! 'Mad' was the right choice.",
        questionText: "Fill in the blank to complete the word: _ad (Hint: Feeling angry)",
        correctAnswer: 'mad',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: _ad (Hint: Feeling angry)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
        audio: "mad"
      },
      {
        id: 6,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Excellent! 'Bag' is the correct word.",
        questionText: "Fill in the blank to complete the word: b_g (Hint: Used to carry things)",
        correctAnswer: 'bag',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: b_g (Hint: Used to carry things)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
        audio: "bag"
      },
      {
        id: 7,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "You got it! 'Jam' is the word.",
        questionText: "Fill in the blank to complete the word: j_m (Hint: A fruit spread)",
        correctAnswer: 'jam',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: j_m (Hint: A fruit spread)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
        audio: "jam"
      },
      {
        id: 8,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "That's right! 'Map' is the answer.",
        questionText: "Fill in the blank to complete the word: m_p (Hint: Used for directions)",
        correctAnswer: 'map',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: m_p (Hint: Used for directions)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
        audio: "map"
      },
      {
        id: 9,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Correct! 'Man' fits perfectly.",
        questionText: "Fill in the blank to complete the word: m_n (Hint: An adult male)",
        correctAnswer: 'man',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: m_n (Hint: An adult male)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
        },
        audio: "man"
      },
      {
        id: 10,
        topicId: '1-I.3',
        topicName: 'Complete_the_short_a_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Great! 'Can' was the word you needed.",
        questionText: "Fill in the blank to complete the word: c_n (Hint: A container for drinks)",
        correctAnswer: 'can',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'fill_blank',
          questionLine: "Fill in the blank to complete the word: c_n (Hint: A container for drinks)",
          imagePrompt: 'Educational scene showing complete_the_short_a_word concepts'
            },
        audio: "can"
      }
    ],
    
  },
  '1-I.4': {
    topicInfo: {
      topicId: '1-I.4',
      topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Great job! This sentence correctly describes the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat naps on the mat.", "The cat naps on the log.", "The bat flaps in the sky.", "The rat hides in the hole."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The cat naps on the mat."
        },
      {
        id: 2,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Well done! The sentence describes what is happening in the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat jumps over the hat.", "The cat sits on the mat.", "The dog barks at the moon.", "The bat hangs in the cave."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The cat sits on the mat."
        },
      {
        id: 3,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Correct! This sentence accurately matches the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The man walks his dog.", "The woman bakes a cake.", "The man wears a black hat.", "The dog sleeps in the sun."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The man wears a black hat."
        },
      {
        id: 4,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Excellent! You chose the right sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat chases the mouse.", "The dog runs in the park.", "The fish swims in the tank.", "The cat sits on the mat."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The cat sits on the mat."
        },
      {
        id: 5,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Good choice! This sentence fits the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The man has a black cap.", "The bird flies in the sky.", "The frog jumps on the log.", "The cat hides in the box."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The man has a black cap."
        },
      {
        id: 6,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Nice work! This sentence describes the picture accurately.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat naps on the roof.", "The boy jumps over the fence.", "The cat naps on the mat.", "The fish swims in the pond."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The cat naps on the mat."
        },
      {
        id: 7,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "That's right! You selected the correct sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The dog barks at the moon.", "The cat naps on the chair.", "The bird sings in the tree.", "The fish jumps out of the water."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The cat naps on the chair."
        },
      {
        id: 8,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Good job! This sentence matches the picture perfectly.",
        questionText: "Which sentence matches the picture?",
        options: ["The man wears a black hat.", "The bird flies to the nest.", "The dog chases the ball.", "The cat climbs the tree."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The man wears a black hat."
        },
      {
        id: 9,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Well done! You matched the sentence to the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The dog runs in the yard.", "The bird sings in the morning.", "The fish swims in the bowl.", "The cat naps on the mat."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
          audio: "The cat naps on the mat."
        },
      {
        id: 10,
        topicId: '1-I.4',
        topicName: 'Choose_the_short_a_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "That's correct! This sentence describes the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The man walks his dog.", "The bird flies over the tree.", "The cat naps on the mat.", "The fish jumps in the pond."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_a_sentence_that_matches_the_picture concepts'
        },
        audio: "The cat naps on the mat."
      }
    ],
    
  },
  '1-J.2': {
    topicInfo: {
      topicId: '1-J.2',
      topicName: 'Complete_the_short_e_word',
      questionElements: 'audio + text+image',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Great job! The letter 'p' completes the word 'pet'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _et",
        options: ["p", "w", "v", "t"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _et",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "pet"
        },
      {
        id: 2,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Well done! The letter 'n' completes the word 'leg'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _eg",
        options: ["w", "l", "n", "t"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _eg",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "leg"
        },
      {
        id: 3,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Nice work! The letter 'w' completes the word 'web'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _eb",
        options: ["y", "v", "w", "t"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _eb",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "web"
        },
      {
        id: 4,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Good job! The letter 'r' completes the word 'red'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ed",
        options: ["s", "r", "t", "m"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ed",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "red"
        },
      {
        id: 5,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "You got it! The letter 'b' completes the word 'bed'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ed",
        options: ["b", "r", "s", "t"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ed",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "bed"
        },
      {
        id: 6,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Excellent! The letter 't' completes the word 'net'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _et",
        options: ["s", "r", "t", "p"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _et",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "net"
        },
      {
        id: 7,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Great! The letter 'f' completes the word 'fed'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ed",
        options: ["r", "f", "b", "p"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ed",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "fed"
        },
      {
        id: 8,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Nice! The letter 't' completes the word 'jet'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _et",
        options: ["l", "r", "s", "t"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _et",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "jet"
        },
      {
        id: 9,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Awesome! The letter 'p' completes the word 'pen'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _en",
        options: ["p", "s", "t", "r"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _en",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
        },
          audio: "pen"
        },
      {
        id: 10,
        topicId: '1-J.2',
        topicName: 'Complete_the_short_e_word',
        questionElements: 'audio + text+image',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Great choice! The letter 'l' completes the word 'let'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _et",
        options: ["s", "l", "r", "t"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _et",
          imagePrompt: 'Educational scene showing complete_the_short_e_word concepts'
                },
        audio: "let"
      }
    ],
    
  },
  '1-J.3': {
    topicInfo: {
      topicId: '1-J.3',
      topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Great job! This sentence matches the picture perfectly.",
        questionText: "Which sentence matches the picture?",
        options: ["Ben fed the hen.", "Ben fed the pen.", "Ben fed the vet.", "Ben fed the jet."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "l"
        },
      {
        id: 2,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Well done! You picked the correct sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The bed is red.", "The hen is red.", "The vet is red.", "The pen is red."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The hen is red."
        },
      {
        id: 3,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Nice choice! That is the right sentence for the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["A vet met a net.", "A net met a jet.", "A pet is in a net.", "A set is on a bed."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "A pet is in a net."
        },
      {
        id: 4,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Excellent! That sentence describes the picture accurately.",
        questionText: "Which sentence matches the picture?",
        options: ["The vet has a pen.", "The vet has a net.", "The vet has a set.", "The vet has a pet."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The vet has a pet."
        },
      {
        id: 5,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "You got it! This sentence is spot on.",
        questionText: "Which sentence matches the picture?",
        options: ["The jet is big.", "The bed is big.", "The vet is big.", "The net is big."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The jet is big."
        },
      {
        id: 6,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Well done! This is the right sentence for the image.",
        questionText: "Which sentence matches the picture?",
        options: ["A jet can rest.", "A vet can rest.", "A bed can rest.", "A net can rest."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "A vet can rest."
        },
      {
        id: 7,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Great choice! That sentence fits the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["A bed is wet.", "A vet is wet.", "A jet is wet.", "A net is wet."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "A jet is wet."
        },
      {
        id: 8,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Nice work! You've selected the correct sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["A pen is in the shed.", "A hen is in the shed.", "A vet is in the shed.", "A bed is in the shed."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "A hen is in the shed."
        },
      {
        id: 9,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Correct! That sentence describes the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The jet is fast.", "The net is fast.", "The vet is fast.", "The bed is fast."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The jet is fast."
        },
      {
        id: 10,
        topicId: '1-J.3',
        topicName: 'Choose_the_short_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Excellent choice! You've found the correct match.",
        questionText: "Which sentence matches the picture?",
        options: ["The vet is on a bed.", "The bed is on a shed.", "The pen is on a vet.", "The hen is on a jet."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_e_sentence_that_matches_the_picture concepts'
          },
        audio: "The hen is on a jet."
      }
    ],
    
  },
  '1-K.1': {
    topicInfo: {
      topicId: '1-K.1',
      topicName: 'Choose_the_short_i_word_that_matches_the_picture',
      questionElements: 'image + audio + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Great job! The picture shows a pin.",
        questionText: "Which word matches the picture?",
        options: ["pin", "pan", "pen", "pun"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "pin"
        },
      {
        id: 2,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Nice work! The picture shows a kid.",
        questionText: "Which word matches the picture?",
        options: ["kit", "kid", "cat", "cot"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "kid"
        },
      {
        id: 3,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Well done! The picture shows a lid.",
        questionText: "Which word matches the picture?",
        options: ["lad", "led", "lid", "load"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "lid"
        },
      {
        id: 4,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "You're right! The picture shows a pig.",
        questionText: "Which word matches the picture?",
        options: ["pig", "peg", "pog", "pug"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "pig"
        },
      {
        id: 5,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Good choice! The picture shows a bin.",
        questionText: "Which word matches the picture?",
        options: ["ban", "bun", "ben", "bin"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "bin"
        },
      {
        id: 6,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Correct! The picture shows a fin.",
        questionText: "Which word matches the picture?",
        options: ["fan", "fin", "fun", "fen"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "fin"
        },
      {
        id: 7,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Excellent! The picture shows a lip.",
        questionText: "Which word matches the picture?",
        options: ["lap", "lop", "lip", "lop"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "lip"
        },
      {
        id: 8,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Nice! The picture shows a crib.",
        questionText: "Which word matches the picture?",
        options: ["crib", "crab", "crub", "crab"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "crib"
        },
      {
        id: 9,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Great choice! The picture shows a wig.",
        questionText: "Which word matches the picture?",
        options: ["wag", "wag", "wig", "wug"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
        },
          audio: "wig"
        },
      {
        id: 10,
        topicId: '1-K.1',
        topicName: 'Choose_the_short_i_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Awesome! The picture shows a fig.",
        questionText: "Which word matches the picture?",
        options: ["fog", "fig", "fug", "fag"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_i_word_that_matches_the_picture concepts'
          },
        audio: "fig"
      }
    ],
    
  },
  '1-L.1': {
    topicInfo: {
      topicId: '1-L.1',
      topicName: 'Choose_the_short_o_word_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "Great job! 'Hop' matches the action in the picture.",
        questionText: "Which word matches the picture?",
        options: ["top", "hop", "cot", "pot"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "hop"
        },
      {
        id: 2,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "Well done! 'Top' matches the object in the picture.",
        questionText: "Which word matches the picture?",
        options: ["top", "mop", "hop", "dot"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "top"
        },
      {
        id: 3,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "You're right! 'Box' is the word that matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["top", "mop", "box", "dot"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "box"
        },
      {
        id: 4,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "Nice work! 'Fox' matches the animal in the picture.",
        questionText: "Which word matches the picture?",
        options: ["fox", "box", "mop", "hop"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "fox"
        },
      {
        id: 5,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "Correct! 'Mop' is the word that matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["top", "box", "mop", "dot"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "mop"
        },
      {
        id: 6,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "Good job! 'Dot' is the word that matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["mop", "dot", "box", "top"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "dot"
        },
      {
        id: 7,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "Fantastic! 'Cot' is the correct word for the picture.",
        questionText: "Which word matches the picture?",
        options: ["cot", "top", "mop", "dot"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "cot"
        },
      {
        id: 8,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "Awesome! 'Pot' is the word that matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["top", "mop", "cot", "pot"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "pot"
        },
      {
        id: 9,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "You got it! 'Log' matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["top", "log", "mop", "dot"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
          audio: "log"
        },
      {
        id: 10,
        topicId: '1-L.1',
        topicName: 'Choose_the_short_o_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sound',
        imageUrl: null,
        explanation: "Excellent! 'Rod' is the word that matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["top", "mop", "rod", "dot"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sound',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_word_that_matches_the_picture concepts'
        },
        audio: "rod"
      }
    ],
    
  },
  '1-L.3': {
    topicInfo: {
      topicId: '1-L.3',
      topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Great job! The sentence describes the action in the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["We chop the mop.", "We chop the log.", "We jog in the fog.", "We mop the floor."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "We chop the log."
        },
      {
        id: 2,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Good choice! The sentence accurately reflects the image.",
        questionText: "Which sentence matches the picture?",
        options: ["Don jogs with a mop.", "Don jogs with a fox.", "Don chops the log.", "Don runs up the hill."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "Don jogs with a mop."
        },
      {
        id: 3,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Well done! You matched the sentence to the picture correctly.",
        questionText: "Which sentence matches the picture?",
        options: ["Jon and Bob mop.", "Jon and Bob jog.", "Jon and Bob hop.", "Jon and Bob run."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "Jon and Bob mop."
        },
      {
        id: 4,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Nice work! The sentence is a perfect match for the image.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat hops.", "The cat jogs.", "The cat on a log.", "The cat mops the floor."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "The cat on a log."
        },
      {
        id: 5,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Correct! The sentence accurately describes what's happening in the image.",
        questionText: "Which sentence matches the picture?",
        options: ["The frog jogs.", "The frog on a log.", "The frog chops wood.", "The frog mops the floor."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "The frog on a log."
        },
      {
        id: 6,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Excellent choice! The sentence is a match for the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["A dog jogs.", "A dog hops.", "A dog chops.", "A dog on a log."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "A dog on a log."
        },
      {
        id: 7,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "You got it! The sentence fits the picture perfectly.",
        questionText: "Which sentence matches the picture?",
        options: ["Bob chops a log.", "Bob jogs in fog.", "Bob hops on top.", "Bob mops the floor."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "Bob chops a log."
        },
      {
        id: 8,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Well done! The sentence is correct for the image.",
        questionText: "Which sentence matches the picture?",
        options: ["A fox mops.", "A fox jogs.", "A fox on a log.", "A fox hops."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "A fox on a log."
        },
      {
        id: 9,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Great job! You matched the sentence with the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The frog jogs.", "The frog hops on a log.", "The frog mops the floor.", "The frog chops wood."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
          audio: "The frog hops on a log."
        },
      {
        id: 10,
        topicId: '1-L.3',
        topicName: 'Choose_the_short_o_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Correct! The sentence matches the action in the image.",
        questionText: "Which sentence matches the picture?",
        options: ["Tom mops the floor.", "Tom jogs in the park.", "Tom hops over.", "Tom chops the log."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_o_sentence_that_matches_the_picture concepts'
        },
        audio: "Tom mops the floor."
      }
    ],
    
  },
  '1-M.2': {
    topicInfo: {
      topicId: '1-M.2',
      topicName: 'Complete_the_short_u_word',
      questionElements: 'image + audio + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "Great job! The missing letter makes the word 'mug'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ug",
        options: ["m", "n", "p", "k"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ug",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "mug"
        },
      {
        id: 2,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "Well done! The missing letter makes the word 'jug'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ug",
        options: ["p", "w", "j", "l"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ug",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "jug"
        },
      {
        id: 3,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "Nice work! The missing letter makes the word 'hug'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ug",
        options: ["v", "h", "b", "t"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ug",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "hug"
        },
      {
        id: 4,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "Correct! The missing letter makes the word 'bug'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ug",
        options: ["b", "f", "c", "r"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ug",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "bug"
        },
      {
        id: 5,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "Good job! The missing letter makes the word 'rug'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ug",
        options: ["c", "n", "f", "r"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ug",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "rug"
        },
      {
        id: 6,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "Excellent! The missing letter makes the word 'tub'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ub",
        options: ["d", "t", "m", "n"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ub",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "tub"
        },
      {
        id: 7,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "That's right! The missing letter makes the word 'cub'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ub",
        options: ["p", "n", "c", "l"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ub",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "cub"
        },
      {
        id: 8,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "You got it! The missing letter makes the word 'sub'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _ub",
        options: ["c", "m", "t", "s"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _ub",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "sub"
        },
      {
        id: 9,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "Great choice! The missing letter makes the word 'sun'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _un",
        options: ["s", "b", "f", "j"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _un",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
          audio: "sun"
        },
      {
        id: 10,
        topicId: '1-M.2',
        topicName: 'Complete_the_short_u_word',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sound',
        imageUrl: null,
        explanation: "Well done! The missing letter makes the word 'fun'.",
        questionText: "Listen to the word. Then, fill in the missing letter: _un",
        options: ["g", "r", "f", "j"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sound',
          intent: 'mcq',
          questionLine: "Listen to the word. Then, fill in the missing letter: _un",
          imagePrompt: 'Educational scene showing complete_the_short_u_word concepts'
        },
        audio: "fun"
      }
    ],
    
  },
  '1-M.3': {
    topicInfo: {
      topicId: '1-M.3',
      topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Great job! This sentence matches the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The pup jumps in the tub.", "The cup is on the rug.", "The bug is in the sun.", "The duck swims in the pond."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The pup jumps in the tub."
        },
      {
        id: 2,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "That's right! The picture shows a bug in the mud.",
        questionText: "Which sentence matches the picture?",
        options: ["The sun is hot in the sky.", "The dog runs fast.", "The bug is in the mud.", "The cat naps in the sun."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The bug is in the mud."
        },
      {
        id: 3,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Well done! This sentence describes the image.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat sits on the rug.", "The pup naps in the sun.", "The fish swims in the tub.", "The hen lays an egg."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The pup naps in the sun."
        },
      {
        id: 4,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Nice work! You picked the right sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The frog jumps on the log.", "The sun sets in the west.", "The bird sings in the tree.", "The pup digs in the mud."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The pup digs in the mud."
        },
      {
        id: 5,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Excellent! This matches the picture perfectly.",
        questionText: "Which sentence matches the picture?",
        options: ["The duck swims in the pond.", "The boy plays with the toy.", "The pig rolls in the mud.", "The cat plays with yarn."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The duck swims in the pond."
        },
      {
        id: 6,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "You're doing great! This sentence is a match.",
        questionText: "Which sentence matches the picture?",
        options: ["The hen sits on the nest.", "The rabbit hops in the garden.", "The pup runs in the yard.", "The fish swims in the tank."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The pup runs in the yard."
        },
      {
        id: 7,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Correct! That matches the scene in the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat chases the mouse.", "The bug crawls on the rug.", "The bird flies in the sky.", "The fish jumps out of the water."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The bug crawls on the rug."
        },
      {
        id: 8,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Great choice! This sentence matches the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The sun shines on the hill.", "The dog digs a hole.", "The cat leaps over the fence.", "The bird nests in the tree."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The sun shines on the hill."
        },
      {
        id: 9,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Nice job! The sentence matches the image.",
        questionText: "Which sentence matches the picture?",
        options: ["The girl climbs the tree.", "The cow eats the grass.", "The horse trots in the field.", "The pup plays in the tub."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
          audio: "The pup plays in the tub."
        },
      {
        id: 10,
        topicId: '1-M.3',
        topicName: 'Choose_the_short_u_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "You're right! The sentence goes with the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat sleeps on the mat.", "The fish swims in the lake.", "The pup chases the bug.", "The cow rests in the barn."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_short_u_sentence_that_matches_the_picture concepts'
        },
        audio: "The pup chases the bug."
      }
    ],
    
  },
  '1-N.2': {
    topicInfo: {
      topicId: '1-N.2',
      topicName: 'Complete_the_word_with_the_right_short_vowel',
      questionElements: 'image + audio + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Great job! The word 'hat' uses a short 'a' sound.",
        questionText: "Listen to the word and fill in the missing letter: h_t",
        options: ["a", "e", "i", "o"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: h_t",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "hat"
        },
      {
        id: 2,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Well done! The word 'rug' uses a short 'u' sound.",
        questionText: "Listen to the word and fill in the missing letter: r_g",
        options: ["i", "o", "u", "a"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: r_g",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "rug"
        },
      {
        id: 3,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short a sounds',
        imageUrl: null,
        explanation: "Nice work! The word 'gas' uses a short 'a' sound.",
        questionText: "Listen to the word and fill in the missing letter: g_s",
        options: ["a", "i", "u", "o"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short a sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: g_s",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "gas"
        },
      {
        id: 4,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Correct! The word 'pen' uses a short 'e' sound.",
        questionText: "Listen to the word and fill in the missing letter: p_n",
        options: ["i", "e", "a", "u"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: p_n",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "pen"
        },
      {
        id: 5,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Good job! The word 'lip' uses a short 'i' sound.",
        questionText: "Listen to the word and fill in the missing letter: l_p",
        options: ["i", "e", "a", "u"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: l_p",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "lip"
        },
      {
        id: 6,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Excellent! The word 'pot' uses a short 'o' sound.",
        questionText: "Listen to the word and fill in the missing letter: p_t",
        options: ["u", "o", "e", "i"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: p_t",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "pot"
        },
      {
        id: 7,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short u sounds',
        imageUrl: null,
        explanation: "Great choice! The word 'cup' uses a short 'u' sound.",
        questionText: "Listen to the word and fill in the missing letter: c_p",
        options: ["a", "o", "u", "e"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short u sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: c_p",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "cup"
        },
      {
        id: 8,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short e sounds',
        imageUrl: null,
        explanation: "Nice work! The word 'bed' uses a short 'e' sound.",
        questionText: "Listen to the word and fill in the missing letter: b_d",
        options: ["a", "e", "i", "o"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short e sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: b_d",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "bed"
        },
      {
        id: 9,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short i sounds',
        imageUrl: null,
        explanation: "Good choice! The word 'pit' uses a short 'i' sound.",
        questionText: "Listen to the word and fill in the missing letter: p_t",
        options: ["o", "u", "i", "e"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short i sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: p_t",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
          audio: "pit"
        },
      {
        id: 10,
        topicId: '1-N.2',
        topicName: 'Complete_the_word_with_the_right_short_vowel',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'short o sounds',
        imageUrl: null,
        explanation: "Well done! The word 'log' uses a short 'o' sound.",
        questionText: "Listen to the word and fill in the missing letter: l_g",
        options: ["o", "a", "e", "i"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'short o sounds',
          intent: 'mcq',
          questionLine: "Listen to the word and fill in the missing letter: l_g",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_short_vowel concepts'
        },
        audio: "log"
      }
    ],
    
  },
  '1-P.1': {
    topicInfo: {
      topicId: '1-P.1',
      topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Great job! The word 'cake' matches the picture of a cake.",
        questionText: "Which word matches the picture?",
        options: ["cake", "cat", "cap", "cot"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "cake"
        },
      {
        id: 2,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Nice work! The word 'bake' matches the picture of baking cookies.",
        questionText: "Which word matches the picture?",
        options: ["bat", "bake", "bit", "bet"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "bake"
        },
      {
        id: 3,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Well done! The word 'kite' matches the picture of a kite.",
        questionText: "Which word matches the picture?",
        options: ["kit", "kitten", "kite", "kitten"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "kite"
        },
      {
        id: 4,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Awesome! The word 'plane' matches the picture of a plane.",
        questionText: "Which word matches the picture?",
        options: ["pan", "plan", "plum", "plane"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "plane"
        },
      {
        id: 5,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Good job! The word 'cone' matches the picture of an ice cream cone.",
        questionText: "Which word matches the picture?",
        options: ["cone", "coal", "cog", "cop"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "cone"
        },
      {
        id: 6,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "You got it! The word 'cube' matches the picture of a cube.",
        questionText: "Which word matches the picture?",
        options: ["cub", "cube", "cup", "cud"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "cube"
        },
      {
        id: 7,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Correct! The word 'tube' matches the picture of a tube.",
        questionText: "Which word matches the picture?",
        options: ["tab", "tabby", "tube", "tub"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "tube"
        },
      {
        id: 8,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Well done! The word 'dune' matches the picture of a sand dune.",
        questionText: "Which word matches the picture?",
        options: ["dud", "dad", "dub", "dune"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "dune"
        },
      {
        id: 9,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Nice! The word 'mile' matches the picture of a mile marker.",
        questionText: "Which word matches the picture?",
        options: ["mile", "mill", "mud", "mop"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
          audio: "mile"
        },
      {
        id: 10,
        topicId: '1-P.1',
        topicName: 'Choose_the_silent_e_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Great choice! The word 'wave' matches the picture of an ocean wave.",
        questionText: "Which word matches the picture?",
        options: ["wag", "wave", "waggle", "war"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_word_that_matches_the_picture concepts'
        },
        audio: "wave"
      }
    ],
    
  },
  '1-P.4': {
    topicInfo: {
      topicId: '1-P.4',
      topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Great choice! The picture shows a good grade.",
        questionText: "Which sentence matches the picture?",
        options: ["Kate plays a fun game.", "Kate gets a good grade.", "Kate writes a note.", "Kate eats a cake."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "Kate gets a good grade."
        },
      {
        id: 2,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Good job! The vase is broken in the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["Gabe broke the cane.", "Gabe broke the vase.", "Gabe ate the cake.", "Gabe made the bed."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "Gabe broke the vase."
        },
      {
        id: 3,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Correct! They won a prize at the science fair.",
        questionText: "Which sentence matches the picture?",
        options: ["Kate and Mike ate a lime.", "Kate and Mike win a prize.", "Kate and Mike ride a bike.", "Kate and Mike sing a song."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "Kate and Mike win a prize."
        },
      {
        id: 4,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Yes, the picture shows a game being played.",
        questionText: "Which sentence matches the picture?",
        options: ["Jake plays a game.", "Jake reads a book.", "Jake eats a grape.", "Jake rides a bike."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "Jake plays a game."
        },
      {
        id: 5,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Nice work! The cake is on the table.",
        questionText: "Which sentence matches the picture?",
        options: ["The dog runs fast.", "The cat naps by the fire.", "The cake is on the table.", "The girl writes a letter."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The cake is on the table."
        },
      {
        id: 6,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Well done! The boy rides a bike.",
        questionText: "Which sentence matches the picture?",
        options: ["The boy eats a snack.", "The boy reads a book.", "The boy draws a picture.", "The boy rides a bike."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The boy rides a bike."
        },
      {
        id: 7,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Correct! The girl bakes a cake.",
        questionText: "Which sentence matches the picture?",
        options: ["The girl bakes a cake.", "The girl draws a picture.", "The girl plays a game.", "The girl takes a nap."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The girl bakes a cake."
        },
      {
        id: 8,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Great choice! The picture shows a kite in the sky.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat naps.", "The dog barks.", "The kite flies high.", "The boy jumps."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The kite flies high."
        },
      {
        id: 9,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Nice work! The puppy takes a nap.",
        questionText: "Which sentence matches the picture?",
        options: ["The puppy takes a nap.", "The puppy eats a bone.", "The puppy plays with a ball.", "The puppy drinks water."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
          audio: "The puppy takes a nap."
        },
      {
        id: 10,
        topicId: '1-P.4',
        topicName: 'Choose_the_silent_e_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'silent e',
        imageUrl: null,
        explanation: "Correct! The cake is on the plate.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat naps in the sun.", "The boy plays with a toy.", "The dog runs fast.", "The cake is on the plate."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'silent e',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_silent_e_sentence_that_matches_the_picture concepts'
        },
        audio: "The cake is on the plate."
      }
    ],
    
  },
  '1-Q.4': {
    topicInfo: {
      topicId: '1-Q.4',
      topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Great choice! The sentence describes the picture accurately.",
        questionText: "Which sentence matches the picture?",
        options: ["The boat sails on the snow.", "The boat sails on the sea.", "The boat parks on the road.", "The boat flies in the sky."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The boat sails on the sea."
        },
      {
        id: 2,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Well done! You picked the correct sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The boy reads on the beach.", "The boy sleeps in the forest.", "The boy swims in the pool.", "The boy runs in the park."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The boy reads on the beach."
        },
      {
        id: 3,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Correct! That sentence fits the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The cat naps on the roof.", "The cat swims in the ocean.", "The cat naps on the couch.", "The cat eats at the table."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The cat naps on the couch."
        },
      {
        id: 4,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Nice work! You've chosen the correct sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The dog barks at the moon.", "The dog plays in the sand.", "The dog swims in the river.", "The dog barks at the mailman."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The dog barks at the mailman."
        },
      {
        id: 5,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Excellent! You matched the sentence perfectly.",
        questionText: "Which sentence matches the picture?",
        options: ["The plane flies through the clouds.", "The plane drives on the highway.", "The plane lands in the jungle.", "The plane dives into the lake."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The plane flies through the clouds."
        },
      {
        id: 6,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Great job! That sentence describes the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The frog jumps over the stars.", "The frog sings in the choir.", "The frog jumps over the log.", "The frog flies in the sky."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The frog jumps over the log."
        },
      {
        id: 7,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "That's right! You selected the correct sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The sheep sleeps on the hill.", "The sheep grazes in the field.", "The sheep dances in the barn.", "The sheep flies over the house."],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The sheep grazes in the field."
        },
      {
        id: 8,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Well done! You've identified the correct sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The bird sings in the tree.", "The bird swims in the pond.", "The bird dances on the stage.", "The bird sleeps in the cave."],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The bird sings in the tree."
        },
      {
        id: 9,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Correct choice! You matched the picture with the right sentence.",
        questionText: "Which sentence matches the picture?",
        options: ["The cow jumps over the moon.", "The cow swims in the pool.", "The cow flies a kite.", "The cow grazes in the meadow."],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
          audio: "The cow grazes in the meadow."
        },
      {
        id: 10,
        topicId: '1-Q.4',
        topicName: 'Choose_the_vowel_team_sentence_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'vowel team',
        imageUrl: null,
        explanation: "Excellent! The sentence you selected describes the picture.",
        questionText: "Which sentence matches the picture?",
        options: ["The fish flies in the air.", "The fish plays in the sandbox.", "The fish swims in the pond.", "The fish dances under the stars."],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'vowel team',
          intent: 'mcq',
          questionLine: "Which sentence matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_vowel_team_sentence_that_matches_the_picture concepts'
        },
        audio: "The fish swims in the pond."
      }
    ],
    
  },
  '1-T.1': {
    topicInfo: {
      topicId: '1-T.1',
      topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
      questionElements: 'image + audio + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'fur',
        imageUrl: null,
        explanation: "Great job! The dog's coat is made of fur.",
        questionText: "Which word matches the picture?",
        options: ["fur", "purse", "bark", "curl"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'fur',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "fur"
        },
      {
        id: 2,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'hard',
        imageUrl: null,
        explanation: "Well done! The rock is hard.",
        questionText: "Which word matches the picture?",
        options: ["shark", "hard", "part", "star"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'hard',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "hard"
        },
      {
        id: 3,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'cart',
        imageUrl: null,
        explanation: "Nice! That's a shopping cart.",
        questionText: "Which word matches the picture?",
        options: ["arm", "cart", "dart", "jar"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'cart',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "cart"
        },
      {
        id: 4,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'bird',
        imageUrl: null,
        explanation: "Correct! That's a bird.",
        questionText: "Which word matches the picture?",
        options: ["bird", "barn", "burn", "bar"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'bird',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "bird"
        },
      {
        id: 5,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'star',
        imageUrl: null,
        explanation: "You got it! That's a star in the sky.",
        questionText: "Which word matches the picture?",
        options: ["stir", "stir", "star", "scar"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'star',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "star"
        },
      {
        id: 6,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'corn',
        imageUrl: null,
        explanation: "Great choice! That's corn on the cob.",
        questionText: "Which word matches the picture?",
        options: ["card", "cord", "core", "corn"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'corn',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "corn"
        },
      {
        id: 7,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'fork',
        imageUrl: null,
        explanation: "Correct! That's a fork.",
        questionText: "Which word matches the picture?",
        options: ["fork", "fort", "fur", "form"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'fork',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "fork"
        },
      {
        id: 8,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'barn',
        imageUrl: null,
        explanation: "Yes! That's a barn.",
        questionText: "Which word matches the picture?",
        options: ["burn", "barn", "born", "bark"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'barn',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "barn"
        },
      {
        id: 9,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'horn',
        imageUrl: null,
        explanation: "Well done! That's a horn.",
        questionText: "Which word matches the picture?",
        options: ["harp", "hard", "horn", "herd"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'horn',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
          audio: "horn"
        },
      {
        id: 10,
        topicId: '1-T.1',
        topicName: 'Choose_the_r_controlled_word_that_matches_the_picture',
        questionElements: 'image + audio + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'curl',
        imageUrl: null,
        explanation: "Nice job! The hair is in a curl.",
        questionText: "Which word matches the picture?",
        options: ["car", "card", "core", "curl"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'curl',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_r_controlled_word_that_matches_the_picture concepts'
        },
        audio: "curl"
      }
    ],
    
  },
  '1-T.2': {
    topicInfo: {
      topicId: '1-T.2',
      topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'fill_blank'
    },
    questions: [
      {
        id: 1,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'farm',
        imageUrl: null,
        explanation: "Great job! The word is 'farm'.",
        questionText: "Complete the word: f__m",
        correctAnswer: 'farm',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'farm',
          intent: 'fill_blank',
          questionLine: "Complete the word: f__m",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
          audio: "farm"
        },
      {
        id: 2,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'bark',
        imageUrl: null,
        explanation: "Well done! The word is 'bark'.",
        questionText: "Complete the word: b__k",
        correctAnswer: 'bark',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'bark',
          intent: 'fill_blank',
          questionLine: "Complete the word: b__k",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
        audio: "bark"
      },
      {
        id: 3,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'clerk',
        imageUrl: null,
        explanation: "Nice work! The word is 'clerk'.",
        questionText: "Complete the word: cl__k",
        correctAnswer: 'clerk',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'clerk',
          intent: 'fill_blank',
          questionLine: "Complete the word: cl__k",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
        audio: "clerk"
      },
      {
        id: 4,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'bird',
        imageUrl: null,
        explanation: "Excellent! The word is 'bird'.",
        questionText: "Complete the word: b__d",
        correctAnswer: 'bird',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'bird',
          intent: 'fill_blank',
          questionLine: "Complete the word: b__d",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
        audio: "bird"
      },
      {
        id: 5,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'corn',
        imageUrl: null,
        explanation: "You're right! The word is 'corn'.",
        questionText: "Complete the word: c__n",
        correctAnswer: 'corn',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'corn',
          intent: 'fill_blank',
          questionLine: "Complete the word: c__n",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
        audio: "corn"
      },
      {
        id: 6,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'burn',
        imageUrl: null,
        explanation: "Good job! The word is 'burn'.",
        questionText: "Complete the word: b__n",
        correctAnswer: 'ur',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'burn',
          intent: 'fill_blank',
          questionLine: "Complete the word: b__n",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
        audio: "burn"
      },
      {
        id: 7,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'star',
        imageUrl: null,
        explanation: "That's right! The word is 'star'.",
        questionText: "Complete the word: st__",
        correctAnswer: 'star',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'star',
          intent: 'fill_blank',
          questionLine: "Complete the word: st__",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
        audio: "star"
      },
      {
        id: 8,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'shirt',
        imageUrl: null,
        explanation: "Correct! The word is 'shirt'.",
        questionText: "Complete the word: sh__t",
        correctAnswer: 'shirt',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'shirt',
          intent: 'fill_blank',
          questionLine: "Complete the word: sh__t",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
        audio: "shirt"
      },
      {
        id: 9,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'turn',
        imageUrl: null,
        explanation: "Nice work! The word is 'turn'.",
        questionText: "Complete the word: t__n",
        correctAnswer: 'turn',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'turn',
          intent: 'fill_blank',
          questionLine: "Complete the word: t__n",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
        },
        audio: "turn"
      },
      {
        id: 10,
        topicId: '1-T.2',
        topicName: 'Complete_the_word_with_the_right_r_controlled_vowel',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'fill_blank',
        word: 'horn',
        imageUrl: null,
        explanation: "Well done! The word is 'horn'.",
        questionText: "Complete the word: h__n",
        correctAnswer: 'horn',
        template: 'fill_blank',
        isSpacing: false,
        isSorting: false,
        isSpelling: true,
        aiHook: {
          targetWord: 'horn',
          intent: 'fill_blank',
          questionLine: "Complete the word: h__n",
          imagePrompt: 'Educational scene showing complete_the_word_with_the_right_r_controlled_vowel concepts'
          },
        audio: "horn"
      }
    ],
    
  },
  '1-U.1': {
    topicInfo: {
      topicId: '1-U.1',
      topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
      questionElements: 'image + text',
      answerElements: 'text',
      templateType: 'mcq'
    },
    questions: [
      {
        id: 1,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Great job! The clown is the correct match.",
        questionText: "Which word matches the picture?",
        options: ["coin", "clown", "cloud", "crown"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "clown"
        },
      {
        id: 2,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Well done! The noise matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["noise", "now", "nose", "news"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "noise"
        },
      {
        id: 3,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Correct! The house matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["voice", "house", "mouse", "vase"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "house"
        },
      {
        id: 4,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Nice work! The cloud matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["clown", "crown", "cloud", "clout"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "cloud"
        },
      {
        id: 5,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Excellent! The cow is the right match.",
        questionText: "Which word matches the picture?",
        options: ["coin", "cane", "cone", "cow"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "cow"
        },
      {
        id: 6,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "That's right! The sound matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["sound", "sand", "send", "stand"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "sound"
        },
      {
        id: 7,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Good job! The toy matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["tie", "toe", "toy", "tea"],
        correctAnswer: 2,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "toy"
        },
      {
        id: 8,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Correct! The owl matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["oil", "owl", "own", "all"],
        correctAnswer: 1,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "owl"
        },
      {
        id: 9,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Well done! The coin matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["coin", "cone", "can", "corn"],
        correctAnswer: 0,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
          audio: "coin"
        },
      {
        id: 10,
        topicId: '1-U.1',
        topicName: 'Choose_the_diphthong_word_that_matches_the_picture',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'mcq',
        word: 'diphthong recognition',
        imageUrl: null,
        explanation: "Great choice! The soil matches the picture.",
        questionText: "Which word matches the picture?",
        options: ["seal", "sail", "sell", "soil"],
        correctAnswer: 3,
        template: 'mcq',
        isSpacing: false,
        isSorting: false,
        isSpelling: false,
        aiHook: {
          targetWord: 'diphthong recognition',
          intent: 'mcq',
          questionLine: "Which word matches the picture?",
          imagePrompt: 'Educational scene showing choose_the_diphthong_word_that_matches_the_picture concepts'
        },
        audio: "soil"
      }
    ],
  },
  '1-X.1': {
      topicInfo: {
        topicId: '1-X.1',
        topicName: 'Read_short_a_stories',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Great job! Sam has a map.",
          questionText: "What does Sam have?",
          passage: "Sam stands on a path. He stands by the plants. Sam has a map of the vast land. The map helps Sam. 'Let's walk on that path,' says Sam.",
          options: ["A book", "A cap", "A map", "A plant"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Sam have?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "soil"
        },
        {
          id: 2,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Well done! Cam likes the bat stamps.",
          questionText: "What kind of stamps does Cam like?",
          passage: "Gramps has a stack of stamps. Some stamps have flags. Some stamps have plants. Some stamps are tan and have bats on them. Cam likes the bat stamps. Gramps lets Cam have the bat stamps. Cam says, 'Thanks Gramps!'",
          options: ["Flag stamps", "Plant stamps", "Bat stamps", "Tan stamps"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "What kind of stamps does Cam like?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "Bat stamps"
        },
        {
          id: 3,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "You're right! Sam stands on a path.",
          questionText: "Where is Sam standing?",
          passage: "Sam stands on a path. He stands by the plants. Sam has a map of the vast land. The map helps Sam. 'Let's walk on that path,' says Sam.",
          options: ["By the river", "On a path", "In a house", "At a shop"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "Where is Sam standing?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "On a path"
        },
        {
          id: 4,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Correct! Some stamps have bats on them.",
          questionText: "What is on some of the stamps?",
          passage: "Gramps has a stack of stamps. Some stamps have flags. Some stamps have plants. Some stamps are tan and have bats on them. Cam likes the bat stamps. Gramps lets Cam have the bat stamps. Cam says, 'Thanks Gramps!'",
          options: ["Flags", "Plants", "Bats", "Books"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "What is on some of the stamps?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "Bats"
        },
        {
          id: 5,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Good choice! Sam is on a path.",
          questionText: "What is Sam standing on?",
          passage: "Sam stands on a path. He stands by the plants. Sam has a map of the vast land. The map helps Sam. 'Let's walk on that path,' says Sam.",
          options: ["Road", "Bridge", "Path", "Tunnel"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "What is Sam standing on?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "Path"
        },
        {
          id: 6,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Yes! Cam likes the bat stamps.",
          questionText: "Who likes the bat stamps?",
          passage: "Gramps has a stack of stamps. Some stamps have flags. Some stamps have plants. Some stamps are tan and have bats on them. Cam likes the bat stamps. Gramps lets Cam have the bat stamps. Cam says, 'Thanks Gramps!'",
          options: ["Gramps", "Cam", "Sam", "Pat"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "Who likes the bat stamps?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "Cam"
        },
        {
          id: 7,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "You're correct! Sam is by the plants.",
          questionText: "Who stands by the plants?",
          passage: "Sam stands on a path. He stands by the plants. Sam has a map of the vast land. The map helps Sam. 'Let's walk on that path' says Sam.",
          options: ["Gramps", "Cam", "Sam", "Pat"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "Who stands by the plants?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "Sam"
        },
        {
          id: 8,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Nice work! Gramps has a stack of stamps.",
          questionText: "What does Gramps have a stack of?",
          passage: "Gramps has a stack of stamps. Some stamps have flags. Some stamps have plants. Some stamps are tan and have bats on them. Cam likes the bat stamps. Gramps lets Cam have the bat stamps. Cam says, 'Thanks Gramps!'",
          options: ["A map", "A pile", "A stack", "A bag"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Gramps have a stack of?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "A stack"
        },
        {
          id: 9,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Yes! Sam has a map of the vast land.",
          questionText: "What helps Sam?",
          passage: "Sam stands on a path. He stands by the plants. Sam has a map of the vast land. The map helps Sam. 'Let's walk on that path,' says Sam.",
          options: ["A book", "A map", "A cap", "A bag"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "What helps Sam?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "A map"
        },
        {
          id: 10,
          topicId: '1-X.1',
          topicName: 'Read_short_a_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Correct! Cam says thanks for the bat stamps.",
          questionText: "What does Cam say thanks for?",
          passage: "Gramps has a stack of stamps. Some stamps have flags. Some stamps have plants. Some stamps are tan and have bats on them. Cam likes the bat stamps. Gramps lets Cam have the bat stamps. Cam says, 'Thanks Gramps'",
          options: ["Tan stamps", "Flag stamps", "Plant stamps", "Bat stamps"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Cam say thanks for?",
            imagePrompt: 'Educational scene showing read_short_a_stories concepts'
          },
          audio: "soil"
        }
      ],
      
    },
    '1-X.2': {
      topicInfo: {
        topicId: '1-X.2',
        topicName: 'Read_short_e_stories',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Great job! Len saw cubs in the den.",
          questionText: "What does Len see in the den?",
          passage: "Ken and Len set up their tent. Then Len sees a den. The den is next to their tent! 'Look!' says Len. 'There are cubs in the den.' 'We must not go to bed yet!' says Ken. 'Let's set our tent in a new spot.'",
          options: ["The tent is red.", "There are cubs in the den.", "Ken and Len sleep in the tent.", "Len saw a rock in the den."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Len see in the den?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "Bat stamps"
        },
        {
          id: 2,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Well done! Ben put the pens on the desk.",
          questionText: "Where does Ben put the pens?",
          passage: "Ben's jet fell off the bed. He went to get the jet. Under the bed, Ben saw ten red pens. They were next to his jet. What a mess! Ben put his jet on the shelf. He put the pens on the desk.",
          options: ["On the desk", "On the bed", "On the shelf", "Under the bed"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "Where does Ben put the pens?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "On the desk"
        },
        {
          id: 3,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Nice work! Jen swept the steps.",
          questionText: "What does Jen sweep?",
          passage: "Miss Dell had a big mess. Jen said, 'I will help!' Jen went to the desk with a box. She put ten things in it. She swept the steps too. 'Thanks, Jen,' said Miss Dell. 'You are a gem!'",
          options: ["The desk", "The steps", "The chest", "The bed"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Jen sweep?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "The steps"
        },
        {
          id: 4,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Correct! The den is next to their tent.",
          questionText: "Where is the den located?",
          passage: "Ken and Len set up their tent. Then Len sees a den. The den is next to their tent! 'Look!' says Len. 'There are cubs in the den.' 'We must not go to bed yet!' says Ken. 'Let's set our tent in a new spot.'",
          options: ["Next to the tent", "In the forest", "On a hill", "By the river"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "Where is the den located?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "Next to the tent"
        },
        {
          id: 5,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Great! Ben put his jet on the shelf.",
          questionText: "Where does Ben put his jet?",
          passage: "Ben's jet fell off the bed. He went to get the jet. Under the bed, Ben saw ten red pens. They were next to his jet. What a mess! Ben put his jet on the shelf. He put the pens on the desk.",
          options: ["Under the bed", "On the desk", "On the shelf", "In the drawer"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "Where does Ben put his jet?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "On the shelf"
        },
        {
          id: 6,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Excellent! Jen is the one who helped.",
          questionText: "Who helps Miss Dell?",
          passage: "Miss Dell had a big mess. Jen said, 'I will help!' Jen went to the desk with a box. She put ten things in it. She swept the steps too. 'Thanks, Jen,' said Miss Dell. 'You are a gem!'",
          options: ["Miss Dell", "Jen", "Ken", "Len"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "Who helps Miss Dell?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "Jen"
        },
        {
          id: 7,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "That's right! Ken wants to set the tent in a new spot.",
          questionText: "What do Ken and Len decide to do?",
          passage: "Ken and Len set up their tent. Then Len sees a den. The den is next to their tent! 'Look!' says Len. 'There are cubs in the den.' 'We must not go to bed yet!' says Ken. 'Let's set our tent in a new spot.'",
          options: ["Stay in the tent", "Go to bed", "Move the tent", "Look at the den"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "What do Ken and Len decide to do?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "Move the tent"
        },
        {
          id: 8,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Correct! Ben went to get his jet.",
          questionText: "What does Ben go to get from under the bed?",
          passage: "Ben's jet fell off the bed. He went to get the jet. Under the bed, Ben saw ten red pens. They were next to his jet. What a mess! Ben put his jet on the shelf. He put the pens on the desk.",
          options: ["His toys", "His pens", "His jet", "His books"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Ben go to get from under the bed?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "His jet"
        },
        {
          id: 9,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Great job! Jen put ten things in the box.",
          questionText: "Where does Jen put the ten things?",
          passage: "Miss Dell had a big mess. Jen said, 'I will help!' Jen went to the desk with a box. She put ten things in it. She swept the steps too. 'Thanks, Jen,' said Miss Dell. 'You are a gem!'",
          options: ["At the desk", "On the bed", "In the box", "On the shelf"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "Where does Jen put the ten things?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "In the box"
        },
        {
          id: 10,
          topicId: '1-X.2',
          topicName: 'Read_short_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short e sounds',
          imageUrl: null,
          explanation: "Awesome! Len saw cubs in the den.",
          questionText: "What animals does Len see in the den?",
          passage: "Ken and Len set up their tent. Then Len sees a den. The den is next to their tent! 'Look!' says Len. 'There are cubs in the den.' 'We must not go to bed yet!' says Ken. 'Let's set our tent in a new spot.'",
          options: ["A bear", "A fox", "Cubs", "Birds"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short e sounds',
            intent: 'reading_comprehension',
            questionLine: "What animals does Len see in the den?",
            imagePrompt: 'Educational scene showing read_short_e_stories concepts'
          },
          audio: "Cubs"
        }
      ],
      
    },
    '1-X.3': {
      topicInfo: {
        topicId: '1-X.3',
        topicName: 'Read_short_i_stories',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "Great job! Sid gives Jill a big grin because he is happy.",
          questionText: "What does Sid give Jill?",
          passage: "The big hat will not fit Sid. It is an inch too big. Jill says, 'I think I will fix it for Sid.' Jill gets pins from the tin. She pins an inch. Jill gives Sid the hat. Sid gives Jill a big grin.",
          options: ["a big gift", "a big kiss", "a big grin", "a big bin"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Sid give Jill?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "Cubs"
        },
        {
          id: 2,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "Well done! Lin adds milk to the dip.",
          questionText: "What does Lin add to the dip?",
          passage: "Lin will make a dip with lots of things. She will put some dill in it. She will add milk and mint. Then she will mix and mix. Lin has some chips for the dip. 'Yum!' The dip is good with the chips.",
          options: ["fish", "milk", "eggs", "beef"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Lin add to the dip?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "milk"
        },
        {
          id: 3,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "Nice work! Kim and Tim decide to get a pink ring for mom.",
          questionText: "What does mom get for her gift?",
          passage: "Kim and Tim want to get a gift for mom. 'We can get a grill,' says Tim. 'That will be too big,' says Kim. 'What about this pink ring?' says Tim. 'Oh, Mom will love this pretty thing!' says Kim. 'Then a ring it is!' says Tim.",
          options: ["a list of things", "a pink ring", "a black grill", "a red hat"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "What does mom get for her gift?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "a pink ring"
        },
        {
          id: 4,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "Correct! The hat is an inch too big for Sid.",
          questionText: "How big is the hat for Sid?",
          passage: "The big hat will not fit Sid. It is an inch too big. Jill says, 'I think I will fix it for Sid.' Jill gets pins from the tin. She pins an inch. Jill gives Sid the hat. Sid gives Jill a big grin.",
          options: ["too small", "too big", "just right", "very tight"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "How big is the hat for Sid?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "too big"
        },
        {
          id: 5,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "Good job! Lin adds dill to the dip.",
          questionText: "What ingredient does Lin use in the dip?",
          passage: "Lin will make a dip with lots of things. She will put some dill in it. She will add milk and mint. Then she will mix and mix. Lin has some chips for the dip. 'Yum!' The dip is good with the chips.",
          options: ["dill", "chili", "rice", "beans"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "What ingredient does Lin use in the dip?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "dill"
        },
        {
          id: 6,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "Awesome! They choose a pink ring for mom.",
          questionText: "What do Kim and Tim decide to buy?",
          passage: "Kim and Tim want to get a gift for mom. 'We can get a grill,' says Tim. 'That will be too big,' says Kim. 'What about this pink ring?' says Tim. 'Oh, Mom will love this pretty thing!' says Kim. 'Then a ring it is!' says Tim.",
          options: ["a book", "a grill", "a pink ring", "a blue hat"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "What do Kim and Tim decide to buy?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "a pink ring"
        },
        {
          id: 7,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "That's right! Sid gives Jill a big grin.",
          questionText: "What does Sid give Jill after getting the hat?",
          passage: "The big hat will not fit Sid. It is an inch too big. Jill says, 'I think I will fix it for Sid.' Jill gets pins from the tin. She pins an inch. Jill gives Sid the hat. Sid gives Jill a big grin.",
          options: ["a pin", "a grin", "a tin", "a ring"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Sid give Jill after getting the hat?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "a grin"
        },
        {
          id: 8,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "Correct! Lin thinks the dip is good with the chips.",
          questionText: "How does Lin feel about the dip with the chips?",
          passage: "Lin will make a dip with lots of things. She will put some dill in it. She will add milk and mint. Then she will mix and mix. Lin has some chips for the dip. 'Yum!' The dip is good with the chips.",
          options: ["sweet", "spicy", "good", "sour"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "How does Lin feel about the dip with the chips?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "good"
        },
        {
          id: 9,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "Good choice! They decide on a ring.",
          questionText: "What final gift do they choose for mom?",
          passage: "Kim and Tim want to get a gift for mom. 'We can get a grill,' says Tim. 'That will be too big,' says Kim. 'What about this pink ring?' says Tim. 'Oh, Mom will love this pretty thing!' says Kim. 'Then a ring it is!' says Tim.",
          options: ["a grill", "a hat", "a ring", "a scarf"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "What final gift do they choose for mom?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "a ring"
        },
        {
          id: 10,
          topicId: '1-X.3',
          topicName: 'Read_short_i_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short i sounds',
          imageUrl: null,
          explanation: "That's correct! Jill decides to fix the hat for Sid.",
          questionText: "What does Jill decide to do for Sid?",
          passage: "The big hat will not fit Sid. It is an inch too big. Jill says, 'I think I will fix it for Sid.' Jill gets pins from the tin. She pins an inch. Jill gives Sid the hat. Sid gives Jill a big grin.",
          options: ["fix the hat", "find a pin", "buy a new hat", "wear the hat"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short i sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Jill decide to do for Sid?",
            imagePrompt: 'Educational scene showing read_short_i_stories concepts'
          },
          audio: "fix the hat"
        }
      ],
      
    },
    '1-X.4': {
      topicInfo: {
        topicId: '1-X.4',
        topicName: 'Read_short_o_stories',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Great job! Ron and Tod jog down the block.",
          questionText: "What do Ron and Tod do together?",
          passage: "Ron jogs with his dog Tod. They jog down the block. They jog to a spot Tod likes. A dog pal is at that spot. The dogs play with a long stick. What a good day for Tod the dog!",
          options: ["They run in the park.", "They jog down the block.", "They play with a ball.", "They sit on a bench."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What do Ron and Tod do together?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "fix the hat"
        },
        {
          id: 2,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Well done! Lon gets blocks with dots.",
          questionText: "What is on Lon's new blocks?",
          passage: "Lon and Mom stop at a shop. In the shop, there is a box. In the box are a lot of blocks. Lon gets some blocks with dots. Lon and Mom find a good spot. They play with the new blocks!",
          options: ["stripes", "dots", "stars", "squares"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What is on Lon's new blocks?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "dots"
        },
        {
          id: 3,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Correct! Jon spots a log.",
          questionText: "What does Jon spot?",
          passage: "Jon plays at the pond. He hops from rock to rock. Plop! He slips on a wet rock. 'Oh no!' says Jon. 'I am all wet!' Then he spots a log. 'I will cross the pond and sit on that log!' says Jon. What a fun day at the pond!",
          options: ["a frog", "a log", "a fish", "a rock"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Jon spot?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "a log"
        },
        {
          id: 4,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Nice work! Tom stocks the shelves.",
          questionText: "What does Tom do at his job?",
          passage: "Tom has a job at a shop. He mops the floor and stocks the shelves. Tom likes his job a lot. He gets to meet many people and help them find what they need. Tom finishes his tasks and feels proud.",
          options: ["Tom dislikes his job.", "Tom plays outside.", "Tom stocks the shelves.", "Tom is tired."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Tom do at his job?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "Tom stocks the shelves."
        },
        {
          id: 5,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Well done! Bob spins his top.",
          questionText: "What does Bob do with his top?",
          passage: "Bob hops on his red top. He spins and spins until he drops. Bob laughs and picks it up again. He loves how fast it goes. He shows his top to his friend and they play together.",
          options: ["Bob frowns.", "Bob hops on his bike.", "Bob spins his top.", "Bob drops his book."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Bob do with his top?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "Bob spins his top."
        },
        {
          id: 6,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Great! Molly plants a seed.",
          questionText: "What does Molly do with the pot?",
          passage: "Molly has a pot. She fills it with soil and plants a seed. Each day, Molly waters the pot and watches the seed grow. Soon, a little sprout pops up. Molly is happy to see her plant grow.",
          options: ["Molly paints a picture.", "Molly plants a seed.", "Molly reads a book.", "Molly cooks in the pot."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Molly do with the pot?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "Molly plants a seed."
        },
        {
          id: 7,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "You're right! Don builds towers.",
          questionText: "What does Don do with the blocks?",
          passage: "Don has a big box. Inside the box are toys and blocks. Don loves to build tall towers with the blocks. He knocks them down and builds again. It is his favorite game to play.",
          options: ["Don plays with a ball.", "Don builds towers.", "Don paints a picture.", "Don reads a book."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Don do with the blocks?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "Don builds towers."
        },
        {
          id: 8,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Perfect! Rob's frog hops from log to log.",
          questionText: "What does Rob's frog do?",
          passage: "Rob has a pet frog. The frog hops from log to log. Rob laughs as he watches. He feeds the frog and gives it a new log to rest on. Rob loves his pet frog a lot.",
          options: ["Rob has a pet dog.", "Rob's frog hops from log to log.", "Rob's frog swims in a pond.", "Rob's frog is quiet."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Rob's frog do?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "Rob's frog hops from log to log."
        },
        {
          id: 9,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Well done! Spot chases the ducks.",
          questionText: "What does Spot do at the park?",
          passage: "Tom and his dog Spot go to the park. They jog around the pond. Spot loves to chase the ducks. Tom laughs and throws a stick for Spot to fetch. They have a fun day at the park.",
          options: ["Tom sleeps in the park.", "Spot chases the ducks.", "Tom swims in the pond.", "Spot digs in the sand."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Spot do at the park?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "Spot chases the ducks."
        },
        {
          id: 10,
          topicId: '1-X.4',
          topicName: 'Read_short_o_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short o sounds',
          imageUrl: null,
          explanation: "Good job! Dot jumps over the pots.",
          questionText: "What does Dot do in the garden?",
          passage: "Bob and his cat Dot play in the garden. Dot jumps over the pots and chases the bugs. Bob laughs and pets Dot. They sit under a tree and enjoy the shade.",
          options: ["Dot jumps over the pots.", "Bob and Dot run inside.", "Dot digs in the garden.", "Bob chases Dot."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short o sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Dot do in the garden?",
            imagePrompt: 'Educational scene showing read_short_o_stories concepts'
          },
          audio: "Dot jumps over the pots."
        }
      ],
      
    },
    '1-X.5': {
      topicInfo: {
        topicId: '1-X.5',
        topicName: 'Read_short_u_stories',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Great job! Russ grunts and jumps before bed.",
          questionText: "What does Russ do before settling in bed?",
          passage: "I must tuck Russ into bed. I fluff and plump his bed. But Russ grunts and jumps. 'Rest now, little bud. I will hum and give you a hug.' Hush now! Russ is snug in bed.",
          options: ["Russ plays with toys.", "Russ grunts and jumps.", "Russ reads a book.", "Russ eats a snack."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Russ do before settling in bed?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "Dot jumps over the pots."
        },
        {
          id: 2,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Awesome! Russ helps Gus learn to hum.",
          questionText: "How can Russ help Gus?",
          passage: "Russ the Duck hums all day. Russ hums when the sun is up. He hums at lunch and at dusk. Gus the Skunk is glum. He can not hum! 'I can help you hum,' says Russ. This makes Gus blush.",
          options: ["He can help Gus run.", "He can help Gus hum.", "He can make Gus lunch.", "He can help Gus swim."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "How can Russ help Gus?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "He can help Gus hum."
        },
        {
          id: 3,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Nice work! The skunk drags her stuff under a stump.",
          questionText: "Where does the skunk drag her stuff?",
          passage: "A skunk wants to eat. She is on the hunt. The skunk finds a plum. She finds the crust of a bun. The skunk drags her stuff under a stump. Then she eats her lunch. Munch!",
          options: ["under a stump", "under the bun", "under the mud", "under the sun"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "Where does the skunk drag her stuff?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "under a stump"
        },
        {
          id: 4,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Well done! Russ is snug in bed in the end.",
          questionText: "How is Russ at the end of the story?",
          passage: "I must tuck Russ into bed. I fluff and plump his bed. But Russ grunts and jumps. 'Rest now, little bud. I will hum and give you a hug.' Hush now! Russ is snug in bed.",
          options: ["Russ is snug in bed.", "Russ is up and running.", "Russ is playing outside.", "Russ is eating lunch."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "How is Russ at the end of the story?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "Russ is snug in bed."
        },
        {
          id: 5,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Correct! Russ hums when the sun is up.",
          questionText: "When does Russ hum?",
          passage: "Russ the Duck hums all day. Russ hums when the sun is up. He hums at lunch and at dusk. Gus the Skunk is glum. He can not hum! 'I can help you hum,' says Russ. This makes Gus blush.",
          options: ["Russ hums at night.", "Russ hums in the morning.", "Russ hums when the sun is up.", "Russ hums only at dusk."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "When does Russ hum?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "Russ hums when the sun is up."
        },
        {
          id: 6,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Good job! The skunk finds a plum.",
          questionText: "What does the skunk find?",
          passage: "A skunk wants to eat. She is on the hunt. The skunk finds a plum. She finds the crust of a bun. The skunk drags her stuff under a stump. Then she eats her lunch. Munch!",
          options: ["The skunk finds a plum.", "The skunk finds a nut.", "The skunk finds a bug.", "The skunk finds a rock."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "What does the skunk find?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "The skunk finds a plum."
        },
        {
          id: 7,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Great! Russ gets a hug before sleeping.",
          questionText: "What does Russ receive before settling down?",
          passage: "I must tuck Russ into bed. I fluff and plump his bed. But Russ grunts and jumps. 'Rest now, little bud. I will hum and give you a hug.' Hush now! Russ is snug in bed.",
          options: ["Russ gets a hug.", "Russ kicks the bed.", "Russ sings a song.", "Russ reads a story."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "What does Russ receive before settling down?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "Russ gets a hug."
        },
        {
          id: 8,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Correct! Gus is glum and cannot hum.",
          questionText: "How does Gus feel about humming?",
          passage: "Russ the Duck hums all day. Russ hums when the sun is up. He hums at lunch and at dusk. Gus the Skunk is glum. He can not hum! 'I can help you hum,' says Russ. This makes Gus blush.",
          options: ["Gus can hum well.", "Gus is happy and hums.", "Gus is glum and cannot hum.", "Gus sings a song."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "How does Gus feel about humming?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "Gus is glum and cannot hum."
        },
        {
          id: 9,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Yes! The skunk is on a hunt.",
          questionText: "What is the skunk doing?",
          passage: "A skunk wants to eat. She is on the hunt. The skunk finds a plum. She finds the crust of a bun. The skunk drags her stuff under a stump. Then she eats her lunch. Munch!",
          options: ["The skunk is on a walk.", "The skunk is on a hunt.", "The skunk is on a run.", "The skunk is on a sleep."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "What is the skunk doing?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "The skunk is on a hunt."
        },
        {
          id: 10,
          topicId: '1-X.5',
          topicName: 'Read_short_u_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'short u sounds',
          imageUrl: null,
          explanation: "Well done! She hums and gives Russ a hug.",
          questionText: "What does she do to help Russ sleep?",
          passage: "I must tuck Russ into bed. I fluff and plump his bed. But Russ grunts and jumps. 'Rest now, little bud. I will hum and give you a hug.' Hush now! Russ is snug in bed.",
          options: ["She sings to Russ.", "She reads a book to Russ.", "She hums and gives Russ a hug.", "She dances for Russ."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short u sounds',
            intent: 'reading_comprehension',
            questionLine: "What does she do to help Russ sleep?",
            imagePrompt: 'Educational scene showing read_short_u_stories concepts'
          },
          audio: "She hums and gives Russ a hug."
        }
      ],
      
    },
    '1-X.6': {
      topicInfo: {
        topicId: '1-X.6',
        topicName: 'Read_silent_e_stories',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Great job! The grapes were not ripe at first.",
          questionText: "Why can't Pete and Kate pick the grapes at first?",
          passage: "Pete and Kate ride bikes all day. They ride past the vines and look for grapes. 'Look! Grapes!' says Pete. 'Can we pick them?' asks Kate. 'Not yet!' says Pete. 'They are not ripe yet! When they are green, it will be time.' Some time goes by, and the grapes are green. Pete and Kate pick nine grapes each. They take a bite. 'They are sweet!' says Kate. 'I want to eat them all,' jokes Kate.",
          options: ["They need to ask their parents.", "The grapes are not ripe yet.", "The grapes are not for them.", "They are too young to pick them."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "Why can't Pete and Kate pick the grapes at first?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "She hums and gives Russ a hug."
        },
        {
          id: 2,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Correct! Gabe's skates are at home.",
          questionText: "Where are Gabe's skates?",
          passage: "Pig and Gabe have a play date. Pig wants to try out her new skates. 'Oh no! Mine are at home,' says Gabe. 'We can go get them,' says Pig. They go to Gabe's home. Gabe grabs his skates. 'Those skates are so cute,' says Pig. 'I like the white stripe on them.' Gabe smiles and puts them on. 'Thanks, Pig! Let's race!' he says. 'No, let's skate side by side. We can go to the lake!' says Pig.",
          options: ["They are at home.", "They are at Pig's house.", "They are lost.", "They are in the garage."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "Where are Gabe's skates?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "They are at home."
        },
        {
          id: 3,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Well done! They go down the slide first.",
          questionText: "What do Jane and Luke do first in the race?",
          passage: "'It is Race Day!' says Mr. Duke. Luke and Jane will race. 'I hope I win,' says Jane. The kids line up, and the bell chimes. Off they go! Luke slides down the huge slide. Then, Jane slides down. They run to the tires. Jane and Luke jump in and out. They slide down ropes. Then, they run to Mr. Duke. They cross the line at the same time! 'These two win the prize!' says Mr. Duke.",
          options: ["They slide down ropes.", "They go down the slide.", "They jump over the tires.", "They run to Mr. Duke."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What do Jane and Luke do first in the race?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "They go down the slide."
        },
        {
          id: 4,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Nice work! They ride past the vines first.",
          questionText: "What do Pete and Kate do before they pick grapes?",
          passage: "Pete and Kate ride bikes all day. They ride past the vines and look for grapes. 'Look! Grapes!' says Pete. 'Can we pick them?' asks Kate. 'Not yet!' says Pete. 'They are not ripe yet! When they are green, it will be time.' Some time goes by, and the grapes are green. Pete and Kate pick nine grapes each. They take a bite. 'They are sweet!' says Kate. 'I want to eat them all,' jokes Kate.",
          options: ["Ride past the vines", "Pick grapes", "Eat grapes", "Find a picnic spot"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What do Pete and Kate do before they pick grapes?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "Ride past the vines"
        },
        {
          id: 5,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Good choice! They decide to skate to the lake.",
          questionText: "What do Pig and Gabe decide to do after getting the skates?",
          passage: "Pig and Gabe have a play date. Pig wants to try out her new skates. 'Oh no! Mine are at home,' says Gabe. 'We can go get them,' says Pig. They go to Gabe's home. Gabe grabs his skates. 'Those skates are so cute,' says Pig. 'I like the white stripe on them.' Gabe smiles and puts them on. 'Thanks, Pig! Let's race!' he says. 'No, let's skate side by side. We can go to the lake!' says Pig.",
          options: ["Race to Gabe's house", "Go to the lake", "Play in the park", "Go to Pig's house"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What do Pig and Gabe decide to do after getting the skates?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "Go to the lake"
        },
        {
          id: 6,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Exactly! They cross the finish line at the same time.",
          questionText: "What do Jane and Luke do at the end of the race?",
          passage: "'It is Race Day!' says Mr. Duke. Luke and Jane will race. 'I hope I win,' says Jane. The kids line up, and the bell chimes. Off they go! Luke slides down the huge slide. Then, Jane slides down. They run to the tires. Jane and Luke jump in and out. They slide down ropes. Then, they run to Mr. Duke. They cross the line at the same time! 'These two win the prize!' says Mr. Duke.",
          options: ["Run to the tires", "Slide down the ropes", "Cross the finish line", "Slide down the huge slide"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What do Jane and Luke do at the end of the race?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "Cross the finish line"
        },
        {
          id: 7,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "That's right! The grapes turn green when they are ripe.",
          questionText: "What color do the grapes turn when they are ripe?",
          passage: "Pete and Kate ride bikes all day. They ride past the vines and look for grapes. 'Look! Grapes!' says Pete. 'Can we pick them?' asks Kate. 'Not yet!' says Pete. 'They are not ripe yet! When they are green, it will be time.' Some time goes by, and the grapes are green. Pete and Kate pick nine grapes each. They take a bite. 'They are sweet!' says Kate. 'I want to eat them all,' jokes Kate.",
          options: ["Red", "Green", "Purple", "Yellow"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What color do the grapes turn when they are ripe?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "Green"
        },
        {
          id: 8,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Correct! Pig prefers skating side by side.",
          questionText: "What does Pig prefer to do instead of racing?",
          passage: "Pig and Gabe have a play date. Pig wants to try out her new skates. 'Oh no! Mine are at home,' says Gabe. 'We can go get them,' says Pig. They go to Gabe's home. Gabe grabs his skates. 'Those skates are so cute,' says Pig. 'I like the white stripe on them.' Gabe smiles and puts them on. 'Thanks, Pig! Let's race!' he says. 'No, let's skate side by side. We can go to the lake!' says Pig.",
          options: ["He wants to race.", "He likes the white stripe.", "He wants to go home.", "He likes skating side by side."],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What does Pig prefer to do instead of racing?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "He likes skating side by side."
        },
        {
          id: 9,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "You got it! Both Jane and Luke win the race together.",
          questionText: "Who wins the race?",
          passage: "'It is Race Day!' says Mr. Duke. Luke and Jane will race. 'I hope I win,' says Jane. The kids line up, and the bell chimes. Off they go! Luke slides down the huge slide. Then, Jane slides down. They run to the tires. Jane and Luke jump in and out. They slide down ropes. Then, they run to Mr. Duke. They cross the line at the same time! 'These two win the prize!' says Mr. Duke.",
          options: ["Mr. Duke", "Jane", "Luke", "Both Jane and Luke"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "Who wins the race?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "Both Jane and Luke"
        },
        {
          id: 10,
          topicId: '1-X.6',
          topicName: 'Read_silent_e_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Well done! Pete and Kate eat the grapes when they are ripe.",
          questionText: "What do Pete and Kate do after picking the grapes?",
          passage: "Pete and Kate ride bikes all day. They ride past the vines and look for grapes. 'Look! Grapes!' says Pete. 'Can we pick them? asks Kate. 'Not yet!' says Pete. 'They are not ripe yet! When they are green, it will be time.' Some time goes by, and the grapes are green. Pete and Kate pick nine grapes each. They take a bite. 'They are sweet!' says Kate. 'I want to eat them all,' jokes Kate.",
          options: ["They ride bikes all day.", "They eat the grapes.", "They find a picnic spot.", "They make grape juice."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What do Pete and Kate do after picking the grapes?",
            imagePrompt: 'Educational scene showing read_silent_e_stories concepts'
          },
          audio: "They eat the grapes."
        }
      ],
      
    },
    '1-X.7': {
      topicInfo: {
        topicId: '1-X.7',
        topicName: 'Read_vowel_team_stories',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! Snail finds the tea very sweet.",
          questionText: "What does Snail think of the tea?",
          passage: "Snail and Flea have a little meal. They fill their cups with a drop of tea. 'Mm, this tea is very sweet!' says Snail.",
          options: ["It tastes like a peach.", "It is very sweet.", "It is too hot to drink.", "It is too cold."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "What does Snail think of the tea?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "They eat the grapes."
        },
        {
          id: 2,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! Flea gives Snail a bite of pie.",
          questionText: "What does Flea give Snail to eat?",
          passage: "Flea gives his friend a bite of pie. 'This feels like a feast!' says Snail.",
          options: ["A green pea", "A bit of cheese", "A bite of pie", "A cup of tea"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "What does Flea give Snail to eat?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "A bite of pie"
        },
        {
          id: 3,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! Snail asks for more treats.",
          questionText: "What does Snail ask for after the meal?",
          passage: "They each have one green pea and a bit of cheese. 'Can I have more treats, please?' asks Snail.",
          options: ["More treats", "More tea", "A big meal", "A nap"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "What does Snail ask for after the meal?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "More treats"
        },
        {
          id: 4,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! Flea smiles and agrees with Snail.",
          questionText: "How does Flea feel about the meal?",
          passage: "'This feels like a feast!' says Snail. 'I think so, too!' smiles Flea.",
          options: ["He is sad.", "He agrees it's a feast.", "He is not hungry.", "He wants more food."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "How does Flea feel about the meal?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "He agrees it's a feast."
        },
        {
          id: 5,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! They have tea, a pea, and cheese.",
          questionText: "What do Snail and Flea have for their meal?",
          passage: "They fill their cups with a drop of tea. They each have one green pea and a bit of cheese.",
          options: ["Cake and milk", "Peaches and pie", "Bread and butter", "Tea, a pea, and cheese"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "What do Snail and Flea have for their meal?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "Tea, a pea, and cheese"
        },
        {
          id: 6,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! Lee is excited to try the pie.",
          questionText: "What is Lee excited to eat at the picnic?",
          passage: "Finn and Lee set up a picnic by a creek. 'I can not wait to try that pie!' says Lee.",
          options: ["A sandwich", "A piece of fruit", "The pie", "The cheese"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "What is Lee excited to eat at the picnic?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "The pie"
        },
        {
          id: 7,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! The geese and toad came to the picnic.",
          questionText: "Which animals come to the picnic?",
          passage: "Uh oh! Here come three geese and one green toad.",
          options: ["Geese and a toad", "Cats and dogs", "Birds and a frog", "Fish and a turtle"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "Which animals come to the picnic?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "Geese and a toad"
        },
        {
          id: 8,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! The feast is not for the animals.",
          questionText: "What does Lee shout at the animals?",
          passage: "'This feast is not for you!' shouts Lee.",
          options: ["Come and join us!", "Please have some pie!", "Let's eat together!", "This feast is not for you!"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "What does Lee shout at the animals?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "This feast is not for you!"
        },
        {
          id: 9,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! The animals speed away.",
          questionText: "What happens after Lee shouts at the animals?",
          passage: "'Honk! Honk!' say the geese. 'Croak! Croak!' says the toad. The animals speed away.",
          options: ["They sit and eat.", "The animals speed away.", "They start singing.", "The animals stay and play."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "What happens after Lee shouts at the animals?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "The animals speed away."
        },
        {
          id: 10,
          topicId: '1-X.7',
          topicName: 'Read_vowel_team_stories',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'vowel team',
          imageUrl: null,
          explanation: "Correct! Finn and Lee cheer because it's time to eat.",
          questionText: "Why do Finn and Lee cheer at the end?",
          passage: "'Hooray! It is time to eat,' cheer Finn and Lee.",
          options: ["They see a rainbow.", "They love the animals.", "It is time to eat.", "They finished their game."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel team',
            intent: 'reading_comprehension',
            questionLine: "Why do Finn and Lee cheer at the end?",
            imagePrompt: 'Educational scene showing read_vowel_team_stories concepts'
          },
          audio: "It is time to eat."
        }
      ],
      
    },
    '1-R.1': {
      topicInfo: {
        topicId: '1-R.1',
        topicName: 'Use_spelling_patterns_to_sort_long_a_words',
        questionElements: 'text+image',
        answerElements: 'text',
        templateType: 'drag_and_drop_sorting'
      },
      questions: [
        {
          id: 1,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job sorting the words by their spelling patterns!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["play", "tray", "bake", "cake"],
          sortingBins: ["ay", "a_e"],
          correctAnswer: {"ay": ["play", "tray"], "a_e": ["bake", "cake"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "play, tray, bake, cake"
        },
        {
          id: 2,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done sorting the words according to their patterns!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["train", "sail", "fade", "gate"],
          sortingBins: ["ai", "a_e"],
          correctAnswer: {"ai": ["train", "sail"], "a_e": ["fade", "gate"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "train, sail, fade, gate"
        },
        {
          id: 3,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Awesome! You've successfully sorted the words.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["stay", "ray", "late", "date"],
          sortingBins: ["ay", "a_e"],
          correctAnswer: {"ay": ["stay", "ray"], "a_e": ["late", "date"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "stay, ray, late, date"
        },
        {
          id: 4,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent sorting! Keep up the good work!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["pain", "grain", "cane", "pane"],
          sortingBins: ["ai", "a_e"],
          correctAnswer: {"ai": ["pain", "grain"], "a_e": ["cane", "pane"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "pain, grain, cane, pane"
        },
        {
          id: 5,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "You sorted the words perfectly!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["clay", "pray", "flame", "blame"],
          sortingBins: ["ay", "a_e"],
          correctAnswer: {"ay": ["clay", "pray"], "a_e": ["flame", "blame"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "clay, pray, flame, blame"
        },
        {
          id: 6,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! You've sorted the words by their patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["chain", "mail", "tame", "frame"],
          sortingBins: ["ai", "a_e"],
          correctAnswer: {"ai": ["chain", "mail"], "a_e": ["tame", "frame"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "chain, mail, tame, frame"
        },
        {
          id: 7,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice work sorting the words into their correct categories!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["way", "bay", "brave", "crave"],
          sortingBins: ["ay", "a_e"],
          correctAnswer: {"ay": ["way", "bay"], "a_e": ["brave", "crave"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "way, bay, brave, crave"
        },
        {
          id: 8,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Fantastic! You've sorted the words correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["snail", "pail", "fame", "shame"],
          sortingBins: ["ai", "a_e"],
          correctAnswer: {"ai": ["snail", "pail"], "a_e": ["fame", "shame"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "snail, pail, fame, shame"
        },
        {
          id: 9,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "You did a great job sorting the words by their patterns!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["day", "gray", "stale", "scale"],
          sortingBins: ["ay", "a_e"],
          correctAnswer: {"ay": ["day", "gray"], "a_e": ["stale", "scale"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
            audio: "day, gray, stale, scale"
        },
        {
          id: 10,
          topicId: '1-R.1',
          topicName: 'Use_spelling_patterns_to_sort_long_a_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent sorting! You've matched the patterns correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["trail", "fail", "cape", "shape"],
          sortingBins: ["ai", "a_e"],
          correctAnswer: {"ai": ["trail", "fail"], "a_e": ["cape", "shape"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_a_words concepts'
          },
          audio: "trail, fail, cape, shape"
        }
      ],
      
    },
    '1-R.2': {
      topicInfo: {
        topicId: '1-R.2',
        topicName: 'Use_spelling_patterns_to_sort_long_e_words',
        questionElements: 'text+image',
        answerElements: 'text',
        templateType: 'drag_and_drop_sorting'
      },
      questions: [
        {
          id: 1,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! You've sorted the words based on their vowel patterns correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["seal", "feed", "beast", "green"],
          sortingBins: ["ea", "ee"],
          correctAnswer: {"ea": ["beast", "seal"], "ee": ["feed", "green"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "seal, feed, beast, green"
        },
        {
          id: 2,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! You've sorted the 'ee' and 'ea' words correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["real", "tree", "bean", "seat"],
          sortingBins: ["ee", "ea"],
          correctAnswer: {"ee": ["tree", "real"], "ea": ["bean", "seat"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "real, tree, bean, seat"
        },
        {
          id: 3,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice work! You've identified the correct vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["each", "seen", "bead", "peel"],
          sortingBins: ["ea", "ee"],
          correctAnswer: {"ea": ["each", "bead"], "ee": ["seen", "peel"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "each, seen, bead, peel"
        },
        {
          id: 4,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent sorting! You've got the vowel patterns right.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["leaf", "feel", "steak", "cheese"],
          sortingBins: ["ea", "ee"],
          correctAnswer: {"ea": ["leaf", "steak"], "ee": ["feel", "cheese"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "leaf, feel, steak, cheese"
        },
        {
          id: 5,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "You're doing great! Keep up the excellent work!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["greed", "free", "speak", "peace"],
          sortingBins: ["ee", "ea"],
          correctAnswer: {"ee": ["greed", "free"], "ea": ["speak", "peace"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "greed, free, speak, peace"
        },
        {
          id: 6,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great sorting! You're mastering these vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["leap", "team", "cheer", "sheep"],
          sortingBins: ["ea", "ee"],
          correctAnswer: {"ea": ["leap", "team"], "ee": ["cheer", "sheep"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "leap, team, cheer, sheep"
        },
        {
          id: 7,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "You're on the right track! Keep it up!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["steep", "sleep", "speak", "plead"],
          sortingBins: ["ee", "ea"],
          correctAnswer: {"ee": ["steep", "sleep"], "ea": ["speak", "plead"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "steep, sleep, speak, plead"
        },
        {
          id: 8,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Fantastic! You've sorted them perfectly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["heal", "dream", "creep", "sweep"],
          sortingBins: ["ea", "ee"],
          correctAnswer: {"ea": ["heal", "dream"], "ee": ["creep", "sweep"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "heal, dream, creep, sweep"
        },
        {
          id: 9,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Awesome job! You sorted the words correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["deem", "sheep", "peach", "treat"],
          sortingBins: ["ee", "ea"],
          correctAnswer: {"ee": ["deem", "sheep"], "ea": ["peach", "treat"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
            audio: "deem, sheep, peach, treat"
        },
        {
          id: 10,
          topicId: '1-R.2',
          topicName: 'Use_spelling_patterns_to_sort_long_e_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nicely done! You've mastered sorting these words.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["bleak", "meat", "sweep", "creek"],
          sortingBins: ["ea", "ee"],
          correctAnswer: {"ea": ["bleak", "meat"], "ee": ["sweep", "creek"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_e_words concepts'
          },
          audio: "bleak, meat, sweep, creek"
        }
      ],
      
    },
    '1-R.3': {
      topicInfo: {
        topicId: '1-R.3',
        topicName: 'Use_spelling_patterns_to_sort_long_i_words',
        questionElements: 'text+image',
        answerElements: 'text',
        templateType: 'drag_and_drop_sorting'
      },
      questions: [
        {
          id: 1,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job sorting the long 'i' words by their spelling patterns!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["smile", "tie", "shine", "fly"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["smile", "shine"], "ie": ["tie", "fly"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "smile, tie, shine, fly"
        },
        {
          id: 2,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! You sorted the words correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["kite", "pie", "drive", "cry"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["kite", "drive"], "ie": ["pie", "cry"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "kite, pie, drive, cry"
        },
        {
          id: 3,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent work sorting by spelling patterns!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["line", "die", "ride", "sigh"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["line", "ride"], "ie": ["die", "sigh"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "line, die, ride, sigh"
        },
        {
          id: 4,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice job! You've sorted the words accurately.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["like", "lie", "bike", "try"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["like", "bike"], "ie": ["lie", "try"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "like, lie, bike, try"
        },
        {
          id: 5,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great sorting! You know your vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["white", "tie", "drive", "high"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["white", "drive"], "ie": ["tie", "high"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "white, tie, drive, high"
        },
        {
          id: 6,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! You've sorted the words correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["site", "pie", "hike", "lie"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["site", "hike"], "ie": ["pie", "lie"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "site, pie, hike, lie"
        },
        {
          id: 7,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent work sorting by spelling patterns!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["dime", "fry", "ride", "bye"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["dime", "ride"], "ie": ["fry", "bye"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "dime, fry, ride, bye"
        },
        {
          id: 8,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job sorting the long 'i' words by their spelling patterns!",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["spine", "tie", "slide", "my"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["spine", "slide"], "ie": ["tie", "my"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "spine, tie, slide, my"
        },
        {
          id: 9,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice job! You've sorted the words accurately.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["shine", "lie", "white", "high"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["shine", "white"], "ie": ["lie", "high"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "shine, lie, white, high"
        },
        {
          id: 10,
          topicId: '1-R.3',
          topicName: 'Use_spelling_patterns_to_sort_long_i_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! You sorted the words correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["like", "tie", "bike", "bye"],
          sortingBins: ["i_e", "ie"],
          correctAnswer: {"i_e": ["like", "bike"], "ie": ["tie", "bye"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_i_words concepts'
          },
          audio: "like, tie, bike, bye"
        }
      ],
      
    },
    '1-R.4': {
      topicInfo: {
        topicId: '1-R.4',
        topicName: 'Use_spelling_patterns_to_sort_long_o_words',
        questionElements: 'text+image',
        answerElements: 'text',
        templateType: 'drag_and_drop_sorting'
      },
      questions: [
        {
          id: 1,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! You've sorted the words by their vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["bow", "coat", "flow", "goal"],
          sortingBins: ["ow", "oa"],
          correctAnswer: {"ow": ["bow", "flow"], "oa": ["coat", "goal"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "bow, coat, flow, goal"
        },
        {
          id: 2,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice work! You've correctly identified the vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["glow", "row", "smoke"],
          sortingBins: ["ow", "o_e"],
          correctAnswer: {"ow": ["row", "glow"], "o_e": ["smoke"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "glow, row, smoke"
        },
        {
          id: 3,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! You've sorted the words correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["own", "soap", "float"],
          sortingBins: ["ow", "oa"],
          correctAnswer: {"ow": ["own"], "oa": ["soap", "float"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "own, soap, float"
        },
        {
          id: 4,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent! You've sorted them by their vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["crow", "road", "snow"],
          sortingBins: ["ow", "oa"],
          correctAnswer: {"ow": ["snow", "crow"], "oa": ["road"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "crow, road, snow"
        },
        {
          id: 5,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great! You've sorted them perfectly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["blow", "loaf", "grow"],
          sortingBins: ["ow", "oa"],
          correctAnswer: {"ow": ["blow", "grow"], "oa": ["loaf"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "blow, loaf, grow"
        },
        {
          id: 6,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Awesome! You correctly sorted the words.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["show", "joke", "bow"],
          sortingBins: ["ow", "o_e"],
          correctAnswer: {"ow": ["show", "bow"], "o_e": ["joke"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "show, joke, bow"
        },
        {
          id: 7,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Good job! You've sorted the words accurately.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["grow", "low", "soap"],
          sortingBins: ["ow", "oa"],
          correctAnswer: {"ow": ["grow", "low"], "oa": ["soap"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "grow, low, soap"
        },
        {
          id: 8,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Fantastic! You've sorted them by their patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["crow", "slow", "load"],
          sortingBins: ["ow", "oa"],
          correctAnswer: {"ow": ["crow", "slow"], "oa": ["load"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "crow, slow, load"
        },
        {
          id: 9,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Excellent sorting! You've done it correctly.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["row", "stone", "flow"],
          sortingBins: ["ow", "o_e"],
          correctAnswer: {"ow": ["row", "flow"], "o_e": ["stone"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "row, stone, flow"
        },
        {
          id: 10,
          topicId: '1-R.4',
          topicName: 'Use_spelling_patterns_to_sort_long_o_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great work! You sorted the words by their patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["show", "slow", "boat"],
          sortingBins: ["ow", "oa"],
          correctAnswer: {"ow": ["show", "slow"], "oa": ["boat"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_o_words concepts'
          },
          audio: "show, slow, boat"
        }
      ],
      
    },
    '1-R.5': {
      topicInfo: {
        topicId: '1-R.5',
        topicName: 'Use_spelling_patterns_to_sort_long_u_words',
        questionElements: 'text+image',
        answerElements: 'text',
        templateType: 'drag_and_drop_sorting'
      },
      questions: [
        {
          id: 1,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! You've sorted the words by their long 'u' spelling patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["mule", "cue", "prune", "glue"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["cue", "glue"], "u_e": ["mule", "prune"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "mule, cue, prune, glue"
        },
        {
          id: 2,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Awesome! You've correctly grouped the words by their vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["tune", "blue", "flute", "rescue"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["blue", "rescue"], "u_e": ["tune", "flute"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "tune, blue, flute, rescue"
        },
        {
          id: 3,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! You've sorted the words by their long 'u' spelling patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["use", "glue", "brute", "issue"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["glue", "issue"], "u_e": ["use", "brute"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "use, glue, brute, issue"
        },
        {
          id: 4,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice work! You've organized the words by their vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["rude", "glue", "clue", "tune"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["glue", "clue"], "u_e": ["rude", "tune"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "rude, glue, clue, tune"
        },
        {
          id: 5,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! You've sorted the words by their long 'u' spelling patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["blue", "cute", "brute", "rescue"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["blue", "rescue"], "u_e": ["cute", "brute"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "blue, cute, brute, rescue"
        },
        {
          id: 6,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Awesome! You've correctly grouped the words by their vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["cube", "cue", "flute", "issue"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["cue", "issue"], "u_e": ["cube", "flute"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "cube, cue, flute, issue"
        },
        {
          id: 7,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! You've sorted the words by their long 'u' spelling patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["rescue", "tune", "glue", "mute"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["rescue", "glue"], "u_e": ["tune", "mute"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "rescue, tune, glue, mute"
        },
        {
          id: 8,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Nice work! You've organized the words by their vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["use", "clue", "mute", "blue"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["clue", "blue"], "u_e": ["use", "mute"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "use, clue, mute, blue"
        },
        {
          id: 9,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Great job! You've sorted the words by their long 'u' spelling patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["flute", "glue", "huge", "clue"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["glue", "clue"], "u_e": ["flute", "huge"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "flute, glue, huge, clue"
        },
        {
          id: 10,
          topicId: '1-R.5',
          topicName: 'Use_spelling_patterns_to_sort_long_u_words',
          questionElements: 'text+image',
          answerElements: 'text',
          templateType: 'drag_and_drop_sorting',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Awesome! You've correctly grouped the words by their vowel patterns.",
          questionText: "Sort the words by their vowel patterns.",
          sortingWords: ["glue", "huge", "rude", "cue"],
          sortingBins: ["ue", "u_e"],
          correctAnswer: {"ue": ["glue", "cue"], "u_e": ["huge", "rude"]},
          template: 'drag_and_drop_sorting',
          isSpacing: false,
          isSorting: true,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'drag_and_drop_sorting',
            questionLine: "Sort the words by their vowel patterns.",
            imagePrompt: 'Educational scene showing use_spelling_patterns_to_sort_long_u_words concepts'
          },
          audio: "glue, huge, rude, cue"
        }
      ],
      
    },
    '1-WW.1': {
      topicInfo: {
        topicId: '1-WW.1',
        topicName: 'Select_the_sentence_that_tells_about_the_present',
        questionElements: 'text + audio+image',
        answerElements: 'text +audio',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "Great job! 'Emma eats lunch' is happening right now.",
          questionText: "Which sentence tells about the present?",
          options: ["Emma ate lunch.", "Emma eats lunch.", "Emma will eat lunch.", "Emma has eaten lunch."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "Emma eats lunch."
        },
        {
          id: 2,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "Well done! 'They play soccer' describes a current action.",
          questionText: "Which sentence tells about the present?",
          options: ["They play soccer.", "They played soccer.", "They will play soccer.", "They have played soccer."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "They play soccer."
        },
        {
          id: 3,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "Correct! 'She reads a book' is happening in the present.",
          questionText: "Which sentence tells about the present?",
          options: ["She read a book.", "She will read a book.", "She has read a book.", "She reads a book."],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "She reads a book."
        },
        {
          id: 4,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "Nice work! 'We are happy' describes a current state.",
          questionText: "Which sentence tells about the present?",
          options: ["We were happy.", "We will be happy.", "We are happy.", "We have been happy."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "We are happy."
        },
        {
          id: 5,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "That's right! 'The dog barks loudly' is happening now.",
          questionText: "Which sentence tells about the present?",
          options: ["The dog barks loudly.", "The dog barked loudly.", "The dog will bark loudly.", "The dog has barked loudly."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "The dog barks loudly."
        },
        {
          id: 6,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "Good job! 'I like ice cream' is a present statement.",
          questionText: "Which sentence tells about the present?",
          options: ["I liked ice cream.", "I like ice cream.", "I will like ice cream.", "I have liked ice cream."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "I like ice cream."
        },
        {
          id: 7,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "Well done! 'You drive the car' is a current action.",
          questionText: "Which sentence tells about the present?",
          options: ["You drove the car.", "You will drive the car.", "You drive the car.", "You have driven the car."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "You drive the car."
        },
        {
          id: 8,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "Great choice! 'The flowers bloom' is happening now.",
          questionText: "Which sentence tells about the present?",
          options: ["The flowers bloomed.", "The flowers bloom.", "The flowers will bloom.", "The flowers have bloomed."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "The flowers bloom."
        },
        {
          id: 9,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "Correct! 'The sun shines brightly' is a current fact.",
          questionText: "Which sentence tells about the present?",
          options: ["The sun shone brightly.", "The sun will shine brightly.", "The sun has shone brightly.", "The sun shines brightly."],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
          },
          audio: "The sun shines brightly."
        },
        {
          id: 10,
          topicId: '1-WW.1',
          topicName: 'Select_the_sentence_that_tells_about_the_present',
          questionElements: 'text + audio+image',
          answerElements: 'text +audio',
          templateType: 'mcq',
          word: 'present tense',
          imageUrl: null,
          explanation: "That's right! 'She sings beautifully' is happening now.",
          questionText: "Which sentence tells about the present?",
          options: ["She sings beautifully.", "She sang beautifully.", "She will sing beautifully.", "She has sung beautifully."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'present tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the present?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_present concepts'
            },
          audio: "She sings beautifully."
        }
      ],
      
    },
    '1-WW.2': {
      topicInfo: {
        topicId: '1-WW.2',
        topicName: 'Select_the_sentence_that_tells_about_the_past',
        questionElements: 'text + audio+image',
        answerElements: 'text + audio',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Great job! 'We wished him a good trip.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["We wished him a good trip.", "The man tells a long story.", "She will bake a cake.", "They are eating lunch."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "We wished him a good trip."
        },
        {
          id: 2,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Well done! 'They fixed their boat.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["They will nap under the tree.", "They fixed their boat.", "He is writing a letter.", "She will swim tomorrow."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "They fixed their boat."
        },
        {
          id: 3,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Nice work! 'Grandpa loved all kinds of trains.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["Grandpa loved all kinds of trains.", "He will put ice in the water.", "They are playing outside.", "She will study later."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "Grandpa loved all kinds of trains."
        },
        {
          id: 4,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Correct! 'She painted a picture yesterday.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["He will read a book.", "They are singing a song.", "We will go to the park.", "She painted a picture yesterday."],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "She painted a picture yesterday."
        },
        {
          id: 5,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Good job! 'He cooked dinner last night.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["They will travel tomorrow.", "He cooked dinner last night.", "She is reading a book.", "We will play games."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "He cooked dinner last night."
        },
        {
          id: 6,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Excellent! 'We danced at the party.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["She will write a letter.", "He is watching TV.", "We danced at the party.", "They will visit us."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "We danced at the party."
        },
        {
          id: 7,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "You're right! 'They ran to the store.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["They ran to the store.", "He will play the piano.", "She is drawing a picture.", "We will cook dinner."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "They ran to the store."
        },
        {
          id: 8,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Well done! 'She wrote a letter.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["He will drive the car.", "They are eating dinner.", "She wrote a letter.", "We will go hiking."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "She wrote a letter."
        },
        {
          id: 9,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Great choice! 'They visited their grandparents.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["He is playing soccer.", "She will clean the room.", "We are reading a book.", "They visited their grandparents."],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "They visited their grandparents."
        },
        {
          id: 10,
          topicId: '1-WW.2',
          topicName: 'Select_the_sentence_that_tells_about_the_past',
          questionElements: 'text + audio+image',
          answerElements: 'text + audio',
          templateType: 'mcq',
          word: 'past tense',
          imageUrl: null,
          explanation: "Correct! 'He played the guitar.' is in the past tense.",
          questionText: "Which sentence tells about the past?",
          options: ["She will read a story.", "He played the guitar.", "They are running fast.", "We will paint the fence."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'past tense',
            intent: 'mcq',
            questionLine: "Which sentence tells about the past?",
            imagePrompt: 'Educational scene showing select_the_sentence_that_tells_about_the_past concepts'
          },
          audio: "He played the guitar."
        }
      ],
      
    },
    '1-W.1': {
      topicInfo: {
        topicId: '1-W.1',
        topicName: 'Read_sight_words_set_1',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'again',
          imageUrl: null,
          explanation: "Great job! 'Again' is the correct word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["again", "apple", "after", "along"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'again',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "again"
        },
        {
          id: 2,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'each',
          imageUrl: null,
          explanation: "Nicely done! 'Each' was the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["edge", "each", "eagle", "ear"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'each',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "each"
        },
        {
          id: 3,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'from',
          imageUrl: null,
          explanation: "Well done! 'From' is the correct choice.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["front", "frame", "from", "frog"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'from',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "from"
        },
        {
          id: 4,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'may',
          imageUrl: null,
          explanation: "Fantastic! 'May' was the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["man", "map", "mat", "may"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'may',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "may"
        },
        {
          id: 5,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'stop',
          imageUrl: null,
          explanation: "Good work! 'Stop' is the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["step", "stop", "stir", "star"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'stop',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "stop"
        },
        {
          id: 6,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'than',
          imageUrl: null,
          explanation: "Excellent! 'Than' was the correct choice.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["than", "thin", "that", "them"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'than',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "than"
        },
        {
          id: 7,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'when',
          imageUrl: null,
          explanation: "Great! 'When' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["win", "wet", "when", "wish"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'when',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "when"
        },
        {
          id: 8,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'again',
          imageUrl: null,
          explanation: "Excellent choice! 'Again' was the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["age", "agent", "against", "again"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'again',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "again"
        },
        {
          id: 9,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'each',
          imageUrl: null,
          explanation: "Nice! 'Each' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["eager", "each", "east", "echo"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'each',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "each"
        },
        {
          id: 10,
          topicId: '1-W.1',
          topicName: 'Read_sight_words_set_1',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'from',
          imageUrl: null,
          explanation: "Great choice! 'From' is correct.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["form", "frost", "from", "frame"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'from',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_1 concepts'
          },
          audio: "from"
        }
      ],
      
    },
    '1-W.2': {
      topicInfo: {
        topicId: '1-W.2',
        topicName: 'Read_sight_words_set_2',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'has',
          imageUrl: null,
          explanation: "Great job! 'Has' is the correct word.",
          questionText: "Listen to the word. Which one do you hear?",
          options: ["has", "help", "hat", "hit"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'has',
            intent: 'mcq',
            questionLine: "Listen to the word. Which one do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "has"
        },
        {
          id: 2,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'gave',
          imageUrl: null,
          explanation: "Well done! 'Gave' is the word you heard.",
          questionText: "Click on the sound. Which word do you hear?",
          options: ["game", "gave", "gone", "give"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'gave',
            intent: 'mcq',
            questionLine: "Click on the sound. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "gave"
        },
        {
          id: 3,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'them',
          imageUrl: null,
          explanation: "Correct! You chose 'them'.",
          questionText: "Play the audio. Which word is it?",
          options: ["then", "theme", "them", "thick"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'them',
            intent: 'mcq',
            questionLine: "Play the audio. Which word is it?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "them"
        },
        {
          id: 4,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'after',
          imageUrl: null,
          explanation: "Nice! 'After' is the correct choice.",
          questionText: "Listen to the button sound. Which word do you hear?",
          options: ["actor", "after", "other", "often"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'after',
            intent: 'mcq',
            questionLine: "Listen to the button sound. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "after"
        },
        {
          id: 5,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'best',
          imageUrl: null,
          explanation: "You're right! 'Best' is the word you heard.",
          questionText: "Play the audio. What word do you hear?",
          options: ["best", "beast", "bent", "bust"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'best',
            intent: 'mcq',
            questionLine: "Play the audio. What word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "best"
        },
        {
          id: 6,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'once',
          imageUrl: null,
          explanation: "Good job! 'Once' is correct.",
          questionText: "Click to hear the word. Which one is it?",
          options: ["ounce", "won", "one", "once"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'once',
            intent: 'mcq',
            questionLine: "Click to hear the word. Which one is it?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "once"
        },
        {
          id: 7,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'were',
          imageUrl: null,
          explanation: "Great! 'Were' is the word you heard.",
          questionText: "Listen to the audio clip. Which word do you hear?",
          options: ["wire", "were", "wear", "war"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'were',
            intent: 'mcq',
            questionLine: "Listen to the audio clip. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "were"
        },
        {
          id: 8,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'has',
          imageUrl: null,
          explanation: "Correct! You heard 'has'.",
          questionText: "Click to play the sound. Which word do you hear?",
          options: ["his", "hat", "has", "hit"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'has',
            intent: 'mcq',
            questionLine: "Click to play the sound. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "has"
        },
        {
          id: 9,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'gave',
          imageUrl: null,
          explanation: "Nice work! 'Gave' is correct.",
          questionText: "Listen to the button sound. Which one do you hear?",
          options: ["gave", "game", "gate", "gain"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'gave',
            intent: 'mcq',
            questionLine: "Listen to the button sound. Which one do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "gave"
        },
        {
          id: 10,
          topicId: '1-W.2',
          topicName: 'Read_sight_words_set_2',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'them',
          imageUrl: null,
          explanation: "Well done! 'Them' is the word you heard.",
          questionText: "Play the sound. Which word is it?",
          options: ["thin", "than", "theme", "them"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'them',
            intent: 'mcq',
            questionLine: "Play the sound. Which word is it?",
            imagePrompt: 'Educational scene showing read_sight_words_set_2 concepts'
          },
          audio: "them"
        }
      ],
      
    },
    '1-W.3': {
      topicInfo: {
        topicId: '1-W.3',
        topicName: 'Read_sight_words_set_3',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'as',
          imageUrl: null,
          explanation: "Great job! 'As' is the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["is", "has", "as", "was"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'as',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "as"
        },
        {
          id: 2,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'by',
          imageUrl: null,
          explanation: "Well done! 'By' is the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["by", "my", "fly", "cry"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'by',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "by"
        },
        {
          id: 3,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'four',
          imageUrl: null,
          explanation: "Correct! 'Four' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["for", "four", "floor", "form"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'four',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "four"
        },
        {
          id: 4,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'her',
          imageUrl: null,
          explanation: "That's right! 'Her' is the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["her", "here", "hear", "hair"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'her',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "her"
        },
        {
          id: 5,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'more',
          imageUrl: null,
          explanation: "Good job! 'More' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["moor", "mow", "moan", "more"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'more',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "more"
        },
        {
          id: 6,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'some',
          imageUrl: null,
          explanation: "Correct! 'Some' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["same", "sum", "some", "seem"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'some',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "some"
        },
        {
          id: 7,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'think',
          imageUrl: null,
          explanation: "Great! 'Think' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["sink", "think", "thank", "thick"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'think',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "think"
        },
        {
          id: 8,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'way',
          imageUrl: null,
          explanation: "That's correct! 'Way' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["way", "weigh", "whey", "win"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'way',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "way"
        },
        {
          id: 9,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'her',
          imageUrl: null,
          explanation: "Well done! 'Her' is the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["here", "her", "hear", "hair"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'her',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "her"
        },
        {
          id: 10,
          topicId: '1-W.3',
          topicName: 'Read_sight_words_set_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'more',
          imageUrl: null,
          explanation: "Great choice! 'More' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["mow", "moor", "more", "moan"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'more',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_3 concepts'
          },
          audio: "as"
        }
      ],
      
    },
    '1-W.4': {
      topicInfo: {
        topicId: '1-W.4',
        topicName: 'Read_sight_words_review_sets_1_2_3',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'from',
          imageUrl: null,
          explanation: "Great job! 'From' is the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["form", "farm", "from", "firm"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'from',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "from"
        },
        {
          id: 2,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'after',
          imageUrl: null,
          explanation: "Well done! 'After' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["after", "actor", "alter", "other"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'after',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "after"
        },
        {
          id: 3,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'them',
          imageUrl: null,
          explanation: "Correct! 'Them' is the word you listened to.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["theme", "them", "then", "thumb"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'them',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "them"
        },
        {
          id: 4,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'once',
          imageUrl: null,
          explanation: "Nice work! 'Once' is the correct answer.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["ounce", "ounce", "ounce", "once"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'once',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "once"
        },
        {
          id: 5,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'way',
          imageUrl: null,
          explanation: "Excellent! 'Way' is the sight word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["way", "weigh", "why", "whey"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'way',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "way"
        },
        {
          id: 6,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'best',
          imageUrl: null,
          explanation: "You're right! 'Best' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["beast", "best", "bust", "based"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'best',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "best"
        },
        {
          id: 7,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'gave',
          imageUrl: null,
          explanation: "Correct! 'Gave' is the word you listened to.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["gave", "cave", "give", "gate"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'gave',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "gave"
        },
        {
          id: 8,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'more',
          imageUrl: null,
          explanation: "Great choice! 'More' is correct.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["mourn", "mole", "more", "moor"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'more',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "more"
        },
        {
          id: 9,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'think',
          imageUrl: null,
          explanation: "Nice work! 'Think' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["tank", "thank", "thin", "think"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'think',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "think"
        },
        {
          id: 10,
          topicId: '1-W.4',
          topicName: 'Read_sight_words_review_sets_1_2_3',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'as',
          imageUrl: null,
          explanation: "Well done! 'As' is the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["as", "has", "ass", "ask"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'as',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_2_3 concepts'
          },
          audio: "as"
        }
      ],
      
    },
    '1-W.5': {
      topicInfo: {
        topicId: '1-W.5',
        topicName: 'Read_sight_words_set_4',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Great job! You identified the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["every", "easy", "even", "ever"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "every"
        },
        {
          id: 2,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Well done! You chose the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["cow", "could", "cold", "cloud"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "could"
        },
        {
          id: 3,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Nice work! You listened carefully and picked the right word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["hover", "hour", "how", "hero"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "how"
        },
        {
          id: 4,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Correct! You've matched the sound to the word accurately.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["over", "open", "oven", "other"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "over"
        },
        {
          id: 5,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "You got it! That was the correct choice.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["pat", "put", "pet", "pit"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "put"
        },
        {
          id: 6,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Fantastic! You recognized the sight word correctly.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["there", "tear", "their", "where"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "where"
        },
        {
          id: 7,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Excellent! You picked the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["wheat", "whale", "who", "wheel"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "who"
        },
        {
          id: 8,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Great listening! You've chosen the right word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["every", "ever", "easy", "over"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "every"
        },
        {
          id: 9,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "You've got it! That was the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["cow", "could", "cold", "cloud"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "cloud"
        },
        {
          id: 10,
          topicId: '1-W.5',
          topicName: 'Read_sight_words_set_4',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Well done! You identified the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["once", "over", "other", "open"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_4 concepts'
          },
          audio: "over"
        }
      ],
      
    },
    '1-W.6': {
      topicInfo: {
        topicId: '1-W.6',
        topicName: 'Read_sight_words_set_5',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'ask',
          imageUrl: null,
          explanation: "Great job! You chose the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["ask", "mask", "task", "bask"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'ask',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "ask"
        },
        {
          id: 2,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'five',
          imageUrl: null,
          explanation: "Well done! You picked the right sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["hive", "five", "live", "dive"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'five',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "five"
        },
        {
          id: 3,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'just',
          imageUrl: null,
          explanation: "Correct! You recognized the sight word perfectly.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["rust", "gust", "must", "just"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'just',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "just"
        },
        {
          id: 4,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'long',
          imageUrl: null,
          explanation: "Excellent! That's the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["song", "strong", "long", "gong"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'long',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "long"
        },
        {
          id: 5,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'read',
          imageUrl: null,
          explanation: "Nice work! You selected the right sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["read", "reed", "red", "raid"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'read',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "read"
        },
        {
          id: 6,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'then',
          imageUrl: null,
          explanation: "Good job! You heard the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["when", "then", "ten", "thin"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'then',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "then"
        },
        {
          id: 7,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'want',
          imageUrl: null,
          explanation: "Fantastic! You chose the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["wand", "went", "want", "won't"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'want',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "want"
        },
        {
          id: 8,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'ask',
          imageUrl: null,
          explanation: "Great choice! You identified the right sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["ask", "mask", "cask", "bask"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'ask',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "ask"
        },
        {
          id: 9,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'five',
          imageUrl: null,
          explanation: "Well done! You picked the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["hive", "five", "live", "dive"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'five',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "five"
        },
        {
          id: 10,
          topicId: '1-W.6',
          topicName: 'Read_sight_words_set_5',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'long',
          imageUrl: null,
          explanation: "Excellent! That's the correct sight word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["song", "strong", "long", "gong"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'long',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_5 concepts'
          },
          audio: "long"
        }
      ],
      
    },
    '1-W.7': {
      topicInfo: {
        topicId: '1-W.7',
        topicName: 'Read_sight_words_set_6',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'any',
          imageUrl: null,
          explanation: "Great job! 'Any' is the correct word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["any", "many", "funny", "sunny"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'any',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "any"
        },
        {
          id: 2,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'give',
          imageUrl: null,
          explanation: "Well done! 'Give' is the correct word.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["live", "give", "dive", "hive"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'give',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "give"
        },
        {
          id: 3,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'his',
          imageUrl: null,
          explanation: "Correct! You chose the word 'his'.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["this", "miss", "his", "kiss"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'his',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "his"
        },
        {
          id: 4,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'new',
          imageUrl: null,
          explanation: "That's right! 'New' is what you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["knew", "few", "view", "new"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'new',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "new"
        },
        {
          id: 5,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'open',
          imageUrl: null,
          explanation: "Nice work! 'Open' is the correct choice.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["open", "hoping", "roping", "moping"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'open',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "open"
        },
        {
          id: 6,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sleep',
          imageUrl: null,
          explanation: "You got it! The word is 'sleep'.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["sweep", "sleep", "creep", "keep"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sleep',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "sleep"
        },
        {
          id: 7,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'wish',
          imageUrl: null,
          explanation: "Excellent! 'Wish' is the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["fish", "dish", "wish", "swish"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'wish',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "wish"
        },
        {
          id: 8,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'give',
          imageUrl: null,
          explanation: "Great choice! 'Give' is correct.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["give", "live", "dive", "rive"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'give',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "give"
        },
        {
          id: 9,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'his',
          imageUrl: null,
          explanation: "You picked correctly! 'His' is right.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["miss", "hiss", "this", "his"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'his',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "his"
        },
        {
          id: 10,
          topicId: '1-W.7',
          topicName: 'Read_sight_words_set_6',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'new',
          imageUrl: null,
          explanation: "Correct! 'New' was the word you heard.",
          questionText: "Click on the button. Which word do you hear?",
          options: ["knew", "new", "blue", "glue"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'new',
            intent: 'mcq',
            questionLine: "Click on the button. Which word do you hear?",
            imagePrompt: 'Educational scene showing read_sight_words_set_6 concepts'
          },
          audio: "new"
        }
      ],
      
    },
    '1-W.8': {
      topicInfo: {
        topicId: '1-W.8',
        topicName: 'Read_sight_words_set_7',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'also',
          imageUrl: null,
          explanation: "Great job! 'Also' means in addition to.",
          questionText: "Which word means 'in addition'?",
          options: ["also", "know", "fly", "live"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'also',
            intent: 'mcq',
            questionLine: "Which word means 'in addition'?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "also"
        },
        {
          id: 2,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'fly',
          imageUrl: null,
          explanation: "Well done! 'Fly' is what birds do in the sky.",
          questionText: "Which word describes what birds do in the sky?",
          options: ["know", "fly", "old", "soon"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'fly',
            intent: 'mcq',
            questionLine: "Which word describes what birds do in the sky?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "fly"
        },
        {
          id: 3,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'know',
          imageUrl: null,
          explanation: "Correct! 'Know' means to understand or be aware of something.",
          questionText: "Which word means to be aware of something?",
          options: ["old", "live", "soon", "know"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'know',
            intent: 'mcq',
            questionLine: "Which word means to be aware of something?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "know"
        },
        {
          id: 4,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'live',
          imageUrl: null,
          explanation: "Nice work! 'Live' means to reside or exist.",
          questionText: "Which word means to reside or exist?",
          options: ["soon", "fly", "live", "why"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'live',
            intent: 'mcq',
            questionLine: "Which word means to reside or exist?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "live"
        },
        {
          id: 5,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'old',
          imageUrl: null,
          explanation: "Good job! 'Old' refers to something that has existed for a long time.",
          questionText: "Which word refers to something that has existed for a long time?",
          options: ["old", "also", "live", "fly"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'old',
            intent: 'mcq',
            questionLine: "Which word refers to something that has existed for a long time?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "old"
        },
        {
          id: 6,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'soon',
          imageUrl: null,
          explanation: "That's right! 'Soon' means in a short time.",
          questionText: "Which word means in a short time?",
          options: ["why", "soon", "know", "old"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'soon',
            intent: 'mcq',
            questionLine: "Which word means in a short time?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "soon"
        },
        {
          id: 7,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'why',
          imageUrl: null,
          explanation: "Well done! 'Why' is used to ask for a reason.",
          questionText: "Which word is used to ask for a reason?",
          options: ["live", "fly", "also", "why"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'why',
            intent: 'mcq',
            questionLine: "Which word is used to ask for a reason?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "why"
        },
        {
          id: 8,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'also',
          imageUrl: null,
          explanation: "Great choice! 'Also' means in addition to.",
          questionText: "Which word means in addition to?",
          options: ["fly", "old", "also", "live"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'also',
            intent: 'mcq',
            questionLine: "Which word means in addition to?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "also"
        },
        {
          id: 9,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'fly',
          imageUrl: null,
          explanation: "Correct! 'Fly' is what insects and birds do.",
          questionText: "Which word describes what insects and birds do?",
          options: ["fly", "know", "soon", "old"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'fly',
            intent: 'mcq',
            questionLine: "Which word describes what insects and birds do?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "fly"
        },
        {
          id: 10,
          topicId: '1-W.8',
          topicName: 'Read_sight_words_set_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'live',
          imageUrl: null,
          explanation: "Excellent! 'Live' means to exist or reside.",
          questionText: "Which word means to exist or reside?",
          options: ["also", "live", "why", "fly"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'live',
            intent: 'mcq',
            questionLine: "Which word means to exist or reside?",
            imagePrompt: 'Educational scene showing read_sight_words_set_7 concepts'
          },
          audio: "live"
        }
      ],
      
    },
    '1-W.9': {
      topicInfo: {
        topicId: '1-W.9',
        topicName: 'Read_sight_words_review_sets_4_5_6_7',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Great job! The correct spacing makes the sentence easy to read.",
          questionText: "Which sentence is correctly spaced?",
          options: ["Thecat runs fast.", "The catrun fast.", "The cat runs fast.", "Thecatruns fast."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Which sentence is correctly spaced?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "The cat runs fast."
        },
        {
          id: 2,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Excellent! The word 'blend' completes the sentence correctly.",
          questionText: "Choose the correct word to complete: 'I like to ___ my smoothie with fruits.'",
          options: ["blend", "blind", "bland", "blond"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Choose the correct word to complete: 'I like to ___ my smoothie with fruits.'",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "I like to blend my smoothie with fruits."
        },
        {
          id: 3,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Well done! 'Cake' has a long 'a' sound.",
          questionText: "Which word has a long 'a' sound?",
          options: ["cat", "cake", "cap", "can"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word has a long 'a' sound?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "cake"
        },
        {
          id: 4,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Correct! 'Map' has a short 'a' sound.",
          questionText: "Which word has a short 'a' sound?",
          options: ["map", "make", "mate", "male"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'mcq',
            questionLine: "Which word has a short 'a' sound?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "map"
        },
        {
          id: 5,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word recognition',
          imageUrl: null,
          explanation: "Nice work! 'There' is a sight word that fits here.",
          questionText: "Which word completes the sentence: 'We went over ___ to play.'?",
          options: ["their", "they're", "the", "there"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word recognition',
            intent: 'mcq',
            questionLine: "Which word completes the sentence: 'We went over ___ to play.'?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "We went over there to play?"
        },
        {
          id: 6,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word identification',
          imageUrl: null,
          explanation: "Good choice! 'Who' is the correct sight word.",
          questionText: "Which word is a question word?",
          options: ["the", "who", "they", "them"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word identification',
            intent: 'mcq',
            questionLine: "Which word is a question word?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "who"
        },
        {
          id: 7,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'word recognition',
          imageUrl: null,
          explanation: "That's right! 'Read' is a sight word from the list.",
          questionText: "Select the sight word from the options below.",
          options: ["red", "road", "read", "ride"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'word recognition',
            intent: 'mcq',
            questionLine: "Select the sight word from the options below.",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "read"
        },
        {
          id: 8,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sight word usage',
          imageUrl: null,
          explanation: "Excellent choice! 'Open' fits perfectly in the sentence.",
          questionText: "Which word completes the sentence: 'Can you ___ the door?'",
          options: ["open", "over", "on", "out"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sight word usage',
            intent: 'mcq',
            questionLine: "Which word completes the sentence: 'Can you ___ the door?'",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "Can you open the door?"
        },
        {
          id: 9,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'contextual usage',
          imageUrl: null,
          explanation: "Well done! 'Live' is the right word here.",
          questionText: "Which word fits: 'I ___ in a big city.'?",
          options: ["leave", "live", "love", "line"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'contextual usage',
            intent: 'mcq',
            questionLine: "Which word fits: 'I ___ in a big city.'?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "I live in a big city."
        },
        {
          id: 10,
          topicId: '1-W.9',
          topicName: 'Read_sight_words_review_sets_4_5_6_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'recognition',
          imageUrl: null,
          explanation: "Correct! 'Also' matches the given sentence.",
          questionText: "Which word completes the sentence: 'I like apples and ___ oranges.'?",
          options: ["always", "almost", "also", "alone"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'recognition',
            intent: 'mcq',
            questionLine: "Which word completes the sentence: 'I like apples and ___ oranges.'?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_4_5_6_7 concepts'
          },
          audio: "I like apples and oranges."
        }
      ],
      
    },
    '1-W.10': {
      topicInfo: {
        topicId: '1-W.10',
        topicName: 'Read_sight_words_review_sets_1_7',
        questionElements: 'text + audio+image',
        answerElements: 'text',
        templateType: 'mcq'
      },
      questions: [
        {
          id: 1,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Great job! Remember to keep words spaced properly.",
          questionText: "Which sentence is correctly spaced?",
          options: ["The catruns fast.", "Thecat runs fast.", "The cat runs fast.", "Thecatruns fast."],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Which sentence is correctly spaced?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "The cat runs fast."
        },
        {
          id: 2,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Well done! 'Blend' is the correct choice here.",
          questionText: "Which word completes the sentence: 'I can ___ the colors together'?",
          options: ["blend", "bland", "blind", "block"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Which word completes the sentence: 'I can ___ the colors together'?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "I can blend the colors together?"
        },
        {
          id: 3,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Correct! 'Apple' starts with a short 'a' sound.",
          questionText: "Which word has a short 'a' sound?",
          options: ["cake", "apple", "mate", "late"],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word has a short 'a' sound?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "apple"
        },
        {
          id: 4,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Nice work! 'Cat' has a short 'a' sound.",
          questionText: "Select the word with a short 'a' sound.",
          options: ["fate", "mate", "state", "cat"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'mcq',
            questionLine: "Select the word with a short 'a' sound.",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "cat"
        },
        {
          id: 5,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Excellent! 'Blend' fits perfectly in the sentence.",
          questionText: "Choose the word that completes the sentence: 'Mix and ___ the ingredients well.'",
          options: ["blend", "bend", "bound", "broad"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Choose the word that completes the sentence: 'Mix and ___ the ingredients well.'",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "Mix and blend the ingredients well."
        },
        {
          id: 6,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Correct! Proper spacing makes sentences clear.",
          questionText: "Which sentence has correct spacing?",
          options: ["Ilike to read.", "I like to read.", "Ilike toread.", "I like toread."],
          correctAnswer: 1,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Which sentence has correct spacing?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "I like to read."
        },
        {
          id: 7,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'vowel sorting',
          imageUrl: null,
          explanation: "Good choice! 'Bat' uses a short 'a' sound.",
          questionText: "Which word includes a short 'a' sound?",
          options: ["rate", "gate", "bat", "late"],
          correctAnswer: 2,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'vowel sorting',
            intent: 'mcq',
            questionLine: "Which word includes a short 'a' sound?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "bat"
        },
        {
          id: 8,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'blend',
          imageUrl: null,
          explanation: "Great! 'Blend' completes the sentence well.",
          questionText: "Find the word that fits: 'We need to ___ the paints.'",
          options: ["blind", "bland", "bend", "blend"],
          correctAnswer: 3,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'blend',
            intent: 'mcq',
            questionLine: "Find the word that fits: 'We need to ___ the paints.'",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "We need to blend the paints."
        },
        {
          id: 9,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'short a sounds',
          imageUrl: null,
          explanation: "Correct, 'hat' has a short 'a' sound.",
          questionText: "Which word contains a short 'a' sound?",
          options: ["hat", "hate", "rate", "mate"],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'short a sounds',
            intent: 'mcq',
            questionLine: "Which word contains a short 'a' sound?",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "hat"
        },
        {
          id: 10,
          topicId: '1-W.10',
          topicName: 'Read_sight_words_review_sets_1_7',
          questionElements: 'text + audio+image',
          answerElements: 'text',
          templateType: 'mcq',
          word: 'sentence spacing',
          imageUrl: null,
          explanation: "Well done! Correct sentence spacing improves readability.",
          questionText: "Choose the correctly spaced sentence.",
          options: ["She likes cats.", "Shelikes cats.", "She likescats.", "Shelikescats."],
          correctAnswer: 0,
          template: 'mcq',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sentence spacing',
            intent: 'mcq',
            questionLine: "Choose the correctly spaced sentence.",
            imagePrompt: 'Educational scene showing read_sight_words_review_sets_1_7 concepts'
          },
          audio: "She likes cats."
        }
      ],
      
    },
    '1-GG.1': {
      topicInfo: {
        topicId: '1-GG.1',
        topicName: 'Read_animal_fantasy',
        questionElements: 'image + text',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'context clue',
          imageUrl: null,
          explanation: "Great job! Mouse finds Lion because Lion is too big to hide well.",
          questionText: "Why does Mouse always find Lion?",
          passage: "Mouse and Lion are playing a game. Lion tries to hide. 'Ready or not, here I come,' Mouse says. She looks behind a tree. 'I found you!' says Mouse. 'You did,' says Lion. 'I think I am too big. You always find me.'",
          options: ["Lion is big.", "Lion is orange.", "Lion is loud."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'context clue',
            intent: 'reading_comprehension',
            questionLine: "Why does Mouse always find Lion?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "She likes cats."
        },
        {
          id: 2,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'context clue',
          imageUrl: null,
          explanation: "Well done! Nate knows he can skate because the ice is hard and safe.",
          questionText: "How does Nate know he can skate on the lake?",
          passage: "Behind the barn, there was a lake. Nate the duck ran to look at it. 'Yay! The water is all ice,' he said. 'Can I go ice skating?' he asked his mother. Mother tested the ice. It was hard and safe. Nate could skate!",
          options: ["The ice is hard and safe.", "The sun is very bright.", "He just got new skates."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'context clue',
            intent: 'reading_comprehension',
            questionLine: "How does Nate know he can skate on the lake?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "The ice is hard and safe."
        },
        {
          id: 3,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'context clue',
          imageUrl: null,
          explanation: "Good job! Andy is looking for his red ball.",
          questionText: "What is Andy looking for?",
          passage: "Barb the bee lands in front of the ant hill. Andy the ant runs up to her. 'Thanks for coming,' says Andy. 'I can't find my red ball. I have looked all over for it.'",
          options: ["his red ball", "Barb's ball", "his sister's ball"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'context clue',
            intent: 'reading_comprehension',
            questionLine: "What is Andy looking for?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "his red ball"
        },
        {
          id: 4,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'main idea',
          imageUrl: null,
          explanation: "Nice work! The story is about a game of hide and seek.",
          questionText: "What is the main idea of 'Play Time'?",
          passage: "Mouse and Lion are playing a game. Lion tries to hide. 'Ready or not, here I come,' Mouse says. She looks behind a tree. 'I found you!' says Mouse.",
          options: ["Mouse is looking for cheese.", "They are playing hide and seek.", "Lion is sleeping."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'main idea',
            intent: 'reading_comprehension',
            questionLine: "What is the main idea of 'Play Time'?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "They are playing hide and seek."
        },
        {
          id: 5,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'sequence',
          imageUrl: null,
          explanation: "Correct! Nate skates after his mother checks the ice.",
          questionText: "What happens after Nate's mother checks the ice?",
          passage: "Behind the barn, there was a lake. Nate the duck ran to look at it. Mother tested the ice. It was hard and safe. Nate could skate!",
          options: ["The ice melts.", "Nate goes home.", "Nate skates on the ice."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'sequence',
            intent: 'reading_comprehension',
            questionLine: "What happens after Nate's mother checks the ice?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "Nate skates on the ice."
        },
        {
          id: 6,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'characters',
          imageUrl: null,
          explanation: "Exactly! The main characters are Mouse and Lion.",
          questionText: "Who are the main characters in 'Play Time'?",
          passage: "Mouse and Lion are playing a game. Lion tries to hide.",
          options: ["Mouse and Lion", "Mouse and Cat", "Lion and Tiger"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'characters',
            intent: 'reading_comprehension',
            questionLine: "Who are the main characters in 'Play Time'?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "Mouse and Lion"
        },
        {
          id: 7,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'setting',
          imageUrl: null,
          explanation: "Nice choice! The story takes place by a lake.",
          questionText: "Where does 'Ice Skating Day' take place?",
          passage: "Behind the barn, there was a lake. Nate the duck ran to look at it.",
          options: ["On a mountain", "By a lake", "In a forest"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'setting',
            intent: 'reading_comprehension',
            questionLine: "Where does 'Ice Skating Day' take place?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "By a lake"
        },
        {
          id: 8,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'problem',
          imageUrl: null,
          explanation: "That's right! Andy can't find his red ball.",
          questionText: "What problem is Andy facing in 'The Lost Ball'?",
          passage: "Barb the bee lands in front of the ant hill. Andy the ant runs up to her. 'I can't find my red ball. I have looked all over for it.'",
          options: ["He lost his red ball.", "He lost his friend.", "He can't fly."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'problem',
            intent: 'reading_comprehension',
            questionLine: "What problem is Andy facing in 'The Lost Ball'?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "He lost his red ball."
        },
        {
          id: 9,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'solution',
          imageUrl: null,
          explanation: "Good thinking! Barb offers to help Andy find the ball by flying.",
          questionText: "How does Barb help solve the problem in 'The Lost Ball'?",
          passage: "'Let's look for it from up in the air,' says Barb. 'I can fly you around town. Come on!'",
          options: ["By digging", "By asking others", "By flying with Andy"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'solution',
            intent: 'reading_comprehension',
            questionLine: "How does Barb help solve the problem in 'The Lost Ball'?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "By flying with Andy"
        },
        {
          id: 10,
          topicId: '1-GG.1',
          topicName: 'Read_animal_fantasy',
          questionElements: 'image + text',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'prediction',
          imageUrl: null,
          explanation: "Yes! Since Mouse finds Lion easily, they might play another game.",
          questionText: "What might happen next after Mouse finds Lion?",
          passage: "'I found you!' says Mouse. 'You did,' says Lion. 'I think I am too big. You always find me.'",
          options: ["They take a nap.", "They play another game.", "Lion runs away."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'prediction',
            intent: 'reading_comprehension',
            questionLine: "What might happen next after Mouse finds Lion?",
            imagePrompt: 'Educational scene showing read_animal_fantasy concepts'
          },
          audio: "They play another game."
        }
      ],
      
    },
    '1-GG.2': {
      topicInfo: {
        topicId: '1-GG.2',
        topicName: 'Read_realistic_fiction',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'character actions',
          imageUrl: null,
          explanation: "Leo read a book with funny jokes and wanted to share them.",
          questionText: "What kind of book did Leo read today?",
          passage: "One night, Leo sat at the table with Dad and Cara. They ate and talked. 'Today I read a book of funny jokes,' Leo said. 'Do you want to hear a joke?' 'Yes,' Dad said.",
          options: ["a book about rabbits", "a book with funny jokes", "a book about cooking", "a book about sports"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'character actions',
            intent: 'reading_comprehension',
            questionLine: "What kind of book did Leo read today?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "They play another game."
        },
        {
          id: 2,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'character motivation',
          imageUrl: null,
          explanation: "Nora and Ben want to do different things, leading to Nora's reluctance.",
          questionText: "Why doesn't Nora want to go to Ben's house?",
          passage: "Nora comes. But she does not smile. She does not want to go. Ben always wants to play Cupcake Store. Nora does not like to play Cupcake Store. She likes to draw and paint.",
          options: ["Nora and Ben want to do different things.", "Nora wants to play with Mom.", "Nora wants Ben to play at her house.", "Nora is feeling too tired."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'character motivation',
            intent: 'reading_comprehension',
            questionLine: "Why doesn't Nora want to go to Ben's house?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "Nora and Ben want to do different things."
        },
        {
          id: 3,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'character feelings',
          imageUrl: null,
          explanation: "Chen is unsure about the sleepover as it is his first time.",
          questionText: "What does Chen think about the sleepover?",
          passage: "Chen was going to sleep over at Seth's house. But this was Chen's first sleepover. Would he have fun? Would he miss home? Chen did not know.",
          options: ["He does not know if he will like it.", "He wants to go to a different friend's house.", "He knows that it will be fun.", "He is excited about it."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'character feelings',
            intent: 'reading_comprehension',
            questionLine: "What does Chen think about the sleepover?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "He does not know if he will like it."
        },
        {
          id: 4,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'plot understanding',
          imageUrl: null,
          explanation: "Cara is curious and wants to know the answer to the joke.",
          questionText: "What does Cara ask Leo?",
          passage: "'What do you call a rabbit who tells jokes?' Leo asked. 'I don't know. What?' Cara said.",
          options: ["She asks him to tell another joke.", "She asks him to read a book.", "She asks what the answer to the joke is.", "She asks if he likes rabbits."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'plot understanding',
            intent: 'reading_comprehension',
            questionLine: "What does Cara ask Leo?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "She asks what the answer to the joke is."
        },
        {
          id: 5,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'character interaction',
          imageUrl: null,
          explanation: "Mom suggests that Nora and Ben can work out their differences.",
          questionText: "What does Mom suggest to Nora?",
          passage: "Nora tells this to Mom. 'You and Ben can work it out,' Mom says.",
          options: ["To play with her instead.", "To work it out with Ben.", "To bring her drawing kit.", "To stay home and rest."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'character interaction',
            intent: 'reading_comprehension',
            questionLine: "What does Mom suggest to Nora?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "To work it out with Ben."
        },
        {
          id: 6,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'character decision',
          imageUrl: null,
          explanation: "Leo decides to share a joke from the book he read.",
          questionText: "What does Leo decide to do at the table?",
          passage: "'Today I read a book of funny jokes,' Leo said. 'Do you want to hear a joke?'",
          options: ["Tell a story about school.", "Talk about his favorite animal.", "Share a joke from his book.", "Sing a song he learned."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'character decision',
            intent: 'reading_comprehension',
            questionLine: "What does Leo decide to do at the table?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "Share a joke from his book."
        },
        {
          id: 7,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'conflict resolution',
          imageUrl: null,
          explanation: "Mom encourages Nora to find a way to work things out with Ben.",
          questionText: "How does Mom help Nora with her problem?",
          passage: "'You and Ben can work it out,' Mom says.",
          options: ["By suggesting they work it out.", "By telling her to stay home.", "By offering to talk to Ben.", "By giving her a new toy."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'conflict resolution',
            intent: 'reading_comprehension',
            questionLine: "How does Mom help Nora with her problem?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "By suggesting they work it out."
        },
        {
          id: 8,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'character reassurance',
          imageUrl: null,
          explanation: "Mom reassures Chen by promising to read the book when he gets home.",
          questionText: "How does Mom reassure Chen about his sleepover?",
          passage: "'We will read Good Night, Goat when you get home,' Mom said.",
          options: ["By promising to read his favorite book later.", "By letting him stay home.", "By calling Seth's parents.", "By packing him a special snack."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'character reassurance',
            intent: 'reading_comprehension',
            questionLine: "How does Mom reassure Chen about his sleepover?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "By promising to read his favorite book later."
        },
        {
          id: 9,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'story setting',
          imageUrl: null,
          explanation: "The setting is at the dinner table where the family is talking.",
          questionText: "Where does the story with Leo take place?",
          passage: "One night, Leo sat at the table with Dad and Cara. They ate and talked.",
          options: ["At the playground.", "At the dinner table.", "In the library.", "In the backyard."],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'story setting',
            intent: 'reading_comprehension',
            questionLine: "Where does the story with Leo take place?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "At the dinner table."
        },
        {
          id: 10,
          topicId: '1-GG.2',
          topicName: 'Read_realistic_fiction',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'character preference',
          imageUrl: null,
          explanation: "Nora prefers to draw and paint instead of playing Cupcake Store.",
          questionText: "What does Nora prefer to do instead of playing Cupcake Store?",
          passage: "Nora does not like to play Cupcake Store. She likes to draw and paint.",
          options: ["Draw and paint.", "Watch TV.", "Play soccer.", "Read books."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'character preference',
            intent: 'reading_comprehension',
            questionLine: "What does Nora prefer to do instead of playing Cupcake Store?",
            imagePrompt: 'Educational scene showing read_realistic_fiction concepts'
          },
          audio: "Draw and paint."
        }
      ],
      
    },
    '1-GG.3': {
      topicInfo: {
        topicId: '1-GG.3',
        topicName: 'Read_myths_legends_and_fables',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'magical flute',
          imageUrl: null,
          explanation: "The woman offers to make the rats go away with her magical flute.",
          questionText: "What does the woman use to make the rats go away?",
          passage: "The Woman with the Flute: Once, there was a town with too many rats. The rats ate people's food. They hid in people's shoes. They even played in people's beds. The people were mad. They went to the king and said, 'Get rid of these rats!' 'But how?' asked the king. A woman came to the king. 'I can make the rats go away,' she said. 'But you must pay me.'",
          options: ["A broom", "A trap", "A net", "A magical flute"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'magical flute',
            intent: 'reading_comprehension',
            questionLine: "What does the woman use to make the rats go away?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "Draw and paint."
        },
        {
          id: 2,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'tricks',
          imageUrl: null,
          explanation: "Fox had played tricks on Lion before.",
          questionText: "What has Fox done before?",
          passage: "Fox and Lion: One day, Fox was on a walk. She saw Lion. He was walking to her. 'Oh no!' Fox thought. She had played many tricks on Lion before. Now Lion might try to get her back! Fox had to think fast. How could she get away from Lion?",
          options: ["Fox has tried to ride on Lion's back.", "Fox has run away from Lion.", "Fox has played tricks on Lion.", "Fox has given Lion food."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'tricks',
            intent: 'reading_comprehension',
            questionLine: "What has Fox done before?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "Fox has played tricks on Lion."
        },
        {
          id: 3,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'money',
          imageUrl: null,
          explanation: "Hans needs more money to buy things like food.",
          questionText: "What does Hans need?",
          passage: "The Old Man Who Made Shoes: Once there lived an old man named Hans. He worked hard making shoes in his store. But he did not work fast. It took him a long time to make each shoe. Hans did not make much money. He needed more money to buy things like food.",
          options: ["a shoe store", "more money", "a new home", "more shoes"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'money',
            intent: 'reading_comprehension',
            questionLine: "What does Hans need?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "more money"
        },
        {
          id: 4,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'rats',
          imageUrl: null,
          explanation: "The people in the town were mad because of the rats.",
          questionText: "Why were the people mad?",
          passage: "The Woman with the Flute: Once, there was a town with too many rats. The rats ate people's food. They hid in people's shoes. They even played in people's beds.",
          options: ["The rats ate people's food.", "The king was unkind.", "The weather was too cold.", "The stores were closed."],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'rats',
            intent: 'reading_comprehension',
            questionLine: "Why were the people mad?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "The rats ate people's food."
        },
        {
          id: 5,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'flute',
          imageUrl: null,
          explanation: "The woman uses a magical flute to help the town.",
          questionText: "What does the woman use to help the town?",
          passage: "The Woman with the Flute: A woman came to the king. 'I can make the rats go away,' she said. 'But you must pay me.'",
          options: ["A broom", "A song", "A magical flute", "A potion"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'flute',
            intent: 'reading_comprehension',
            questionLine: "What does the woman use to help the town?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "A magical flute"
        },
        {
          id: 6,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'shoes',
          imageUrl: null,
          explanation: "Hans makes shoes in his store.",
          questionText: "What did Hans make in his store?",
          passage: "The Old Man Who Made Shoes: Once there lived an old man named Hans. He worked hard making shoes in his store.",
          options: ["Hats", "Bags", "Coats", "Shoes"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'shoes',
            intent: 'reading_comprehension',
            questionLine: "What did Hans make in his store?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "Shoes"
        },
        {
          id: 7,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'trick',
          imageUrl: null,
          explanation: "Fox had played tricks on Lion before.",
          questionText: "What had Fox done to Lion before?",
          passage: "Fox and Lion: One day, Fox was on a walk. She saw Lion. He was walking to her. 'Oh no!' Fox thought. She had played many tricks on Lion before.",
          options: ["Helped Lion", "Tricked Lion", "Fed Lion", "Ignored Lion"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'trick',
            intent: 'reading_comprehension',
            questionLine: "What had Fox done to Lion before?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "Tricked Lion"
        },
        {
          id: 8,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'fast',
          imageUrl: null,
          explanation: "Hans had to think fast to solve his problem.",
          questionText: "How did Hans need to think to solve his problem?",
          passage: "The Old Man Who Made Shoes: Hans did not make much money. He needed more money to buy things like food. Hans had to think fast.",
          options: ["Fast", "Slowly", "Carefully", "Quietly"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'fast',
            intent: 'reading_comprehension',
            questionLine: "How did Hans need to think to solve his problem?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "Fast"
        },
        {
          id: 9,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'king',
          imageUrl: null,
          explanation: "The king needed help to get rid of the rats.",
          questionText: "Who needed help to get rid of the rats?",
          passage: "The Woman with the Flute: The people were mad. They went to the king and said, 'Get rid of these rats!' 'But how?' asked the king.",
          options: ["The woman", "The townspeople", "The king", "The queen"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'king',
            intent: 'reading_comprehension',
            questionLine: "Who needed help to get rid of the rats?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "The king"
        },
        {
          id: 10,
          topicId: '1-GG.3',
          topicName: 'Read_myths_legends_and_fables',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'walk',
          imageUrl: null,
          explanation: "Fox was on a walk when she saw Lion.",
          questionText: "What was Fox doing when she saw Lion?",
          passage: "Fox and Lion: One day, Fox was on a walk. She saw Lion. He was walking to her.",
          options: ["On a walk", "Sleeping", "Eating", "Running"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'walk',
            intent: 'reading_comprehension',
            questionLine: "What was Fox doing when she saw Lion?",
            imagePrompt: 'Educational scene showing read_myths_legends_and_fables concepts'
          },
          audio: "On a walk"
        }
      ],
      
    },
    '1-II.1': {
      topicInfo: {
        topicId: '1-II.1',
        topicName: 'Read_about_animals',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Great job! Rays are indeed fish that are shaped like kites.",
          questionText: "What are rays?",
          passage: "Rays are a kind of fish. But they do not look like other fish. Most rays are shaped like big, flat kites. Rays have great big fins that look like wings. The fins help rays swim. Rays look like birds flying in the water.",
          options: ["Rays are fish that do not have fins.", "Rays are birds that swim in the water.", "Rays are fish that are shaped like kites.", "Rays are fish that live in trees."],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What are rays?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "On a walk"
        },
        {
          id: 2,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Correct! Arctic foxes use their tails to keep warm.",
          questionText: "Arctic foxes use their tails to ________.",
          passage: "Arctic foxes live in very cold places. Their fur coats keep them warm. Their tails help keep them warm, too. These foxes have big, bushy tails. They put their tails around their bodies when they go to sleep.",
          options: ["move around", "hide food", "keep warm", "hunt prey"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "Arctic foxes use their tails to ________.",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "keep warm"
        },
        {
          id: 3,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Nice work! Most rays are shaped like big, flat kites.",
          questionText: "How are most rays shaped?",
          passage: "Rays are a kind of fish. But they do not look like other fish. Most rays are shaped like big, flat kites. Rays have great big fins that look like wings. The fins help rays swim. Rays look like birds flying in the water.",
          options: ["Like small, round balls", "Like big, flat kites", "Like thin, straight lines", "Like square boxes"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "How are most rays shaped?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "Like big, flat kites"
        },
        {
          id: 4,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "That's right! Arctic foxes live in very cold places.",
          questionText: "Where do Arctic foxes live?",
          passage: "Arctic foxes live in very cold places. Their fur coats keep them warm. Their tails help keep them warm, too. These foxes have big, bushy tails. They put their tails around their bodies when they go to sleep.",
          options: ["Very cold places", "Hot deserts", "Rainforests", "Sandy beaches"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "Where do Arctic foxes live?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "Very cold places"
        },
        {
          id: 5,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Good job! Rays have fins that look like wings.",
          questionText: "What do the fins of rays look like?",
          passage: "Rays are a kind of fish. But they do not look like other fish. Most rays are shaped like big, flat kites. Rays have great big fins that look like wings. The fins help rays swim. Rays look like birds flying in the water.",
          options: ["Claws", "Leaves", "Scales", "Wings"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What do the fins of rays look like?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "Wings"
        },
        {
          id: 6,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Well done! Arctic foxes have big, bushy tails.",
          questionText: "What kind of tails do Arctic foxes have?",
          passage: "Arctic foxes live in very cold places. Their fur coats keep them warm. Their tails help keep them warm, too. These foxes have big, bushy tails. They put their tails around their bodies when they go to sleep.",
          options: ["Thin, short tails", "Long, skinny tails", "Big, bushy tails", "Curly, small tails"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What kind of tails do Arctic foxes have?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "Big, bushy tails"
        },
        {
          id: 7,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Correct! Rays look like birds flying in the water.",
          questionText: "How do rays appear in the water?",
          passage: "Rays are a kind of fish. But they do not look like other fish. Most rays are shaped like big, flat kites. Rays have great big fins that look like wings. The fins help rays swim. Rays look like birds flying in the water.",
          options: ["Like birds flying", "Like snakes slithering", "Like dolphins jumping", "Like turtles crawling"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "How do rays appear in the water?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "Like birds flying"
        },
        {
          id: 8,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Yes! Arctic foxes put their tails around their bodies when they sleep.",
          questionText: "What do Arctic foxes do with their tails when they sleep?",
          passage: "Arctic foxes live in very cold places. Their fur coats keep them warm. Their tails help keep them warm, too. These foxes have big, bushy tails. They put their tails around their bodies when they go to sleep.",
          options: ["Put them around their bodies", "Wave them in the air", "Hide them under leaves", "Bury them in the snow"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What do Arctic foxes do with their tails when they sleep?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "Put them around their bodies"
        },
        {
          id: 9,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "That's correct! Rays have fins that help them swim.",
          questionText: "What helps rays swim?",
          passage: "Rays are a kind of fish. But they do not look like other fish. Most rays are shaped like big, flat kites. Rays have great big fins that look like wings. The fins help rays swim. Rays look like birds flying in the water.",
          options: ["Their tails", "Their fins", "Their eyes", "Their scales"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What helps rays swim?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "Their fins"
        },
        {
          id: 10,
          topicId: '1-II.1',
          topicName: 'Read_about_animals',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Good job! The fur coats of Arctic foxes keep them warm.",
          questionText: "What keeps Arctic foxes warm?",
          passage: "Arctic foxes live in very cold places. Their fur coats keep them warm. Their tails help keep them warm, too. These foxes have big, bushy tails. They put their tails around their bodies when they go to sleep.",
          options: ["Their paws", "Their ears", "Their eyes", "Their fur coats"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What keeps Arctic foxes warm?",
            imagePrompt: 'Educational scene showing read_about_animals concepts'
          },
          audio: "Their fur coats"
        }
      ],
      
    },
    '1-II.2': {
      topicInfo: {
        topicId: '1-II.2',
        topicName: 'Read_about_sports_and_hobbies',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Great job! Each volleyball team can have six players.",
          questionText: "How many players can a volleyball team have on their side?",
          passage: "Volleyball is fun. Two teams play this game. One team plays on each side of a net. Each team can only have six players on their side. The teams try to hit the ball over the net.",
          options: ["five", "six", "seven", "eight"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "How many players can a volleyball team have on their side?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "Their fur coats"
        },
        {
          id: 2,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Correct! Tennis is played with a racket and a ball.",
          questionText: "What equipment is needed to play tennis?",
          passage: "Tennis is a sport played with a racket and a ball. Players hit the ball over a net. The goal is to score points by hitting the ball where the opponent can't reach it.",
          options: ["a bat and a ball", "a stick and a puck", "a racket and a ball", "a hoop and a ball"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What equipment is needed to play tennis?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "a racket and a ball"
        },
        {
          id: 3,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Well done! Soccer is played with a ball and feet.",
          questionText: "What is used to play soccer?",
          passage: "Soccer is a game played with a ball and feet. Players try to kick the ball into the opponent's goal to score points. The game is played on a large field.",
          options: ["hands and net", "bat and ball", "stick and puck", "ball and feet"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What is used to play soccer?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "ball and feet"
        },
        {
          id: 4,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Excellent! Basketball is played on a court.",
          questionText: "Where is basketball played?",
          passage: "Basketball is played on a court. Two teams try to score points by shooting a ball through a hoop. It is a fast-paced game that requires skill and teamwork.",
          options: ["on a court", "on a field", "on ice", "in a pool"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "Where is basketball played?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "on a court"
        },
        {
          id: 5,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Great! Swimming is done in a pool.",
          questionText: "Where do people usually swim?",
          passage: "Swimming is a popular sport and hobby. People swim in pools, lakes, or oceans. Swimming is a great way to exercise and have fun in the water.",
          options: ["on a field", "in a pool", "on a court", "on a track"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "Where do people usually swim?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "in a pool"
        },
        {
          id: 6,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Correct! Running races are held on a track.",
          questionText: "Where are running races held?",
          passage: "Running races are held on a track. Runners compete to see who can finish the race the fastest. Running is a sport that tests speed and endurance.",
          options: ["on a field", "in a pool", "on a track", "on a court"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "Where are running races held?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "on a track"
        },
        {
          id: 7,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Nice work! Ice hockey is played with a puck.",
          questionText: "What is used to play ice hockey?",
          passage: "Ice hockey is played on an ice rink. Players use sticks to hit a puck into the opponent's goal. It is a fast-paced and exciting sport.",
          options: ["a ball", "a hoop", "a racket", "a puck"],
          correctAnswer: 3,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What is used to play ice hockey?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "a puck"
        },
        {
          id: 8,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Good job! Baseball is played with a bat and a ball.",
          questionText: "What equipment is needed to play baseball?",
          passage: "Baseball is a sport played with a bat and a ball. Players hit the ball and run around bases to score points. The game is played on a diamond-shaped field.",
          options: ["a bat and a ball", "a racket and a net", "a stick and a puck", "a hoop and a ball"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What equipment is needed to play baseball?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "a bat and a ball"
        },
        {
          id: 9,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "That's right! Gymnastics requires balance and strength.",
          questionText: "What skills are important in gymnastics?",
          passage: "Gymnastics is a sport that involves exercises requiring balance, strength, and flexibility. Athletes perform routines on different apparatuses like the balance beam and rings.",
          options: ["speed and agility", "balance and strength", "endurance and speed", "teamwork and strategy"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What skills are important in gymnastics?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "balance and strength"
        },
        {
          id: 10,
          topicId: '1-II.2',
          topicName: 'Read_about_sports_and_hobbies',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'reading comprehension',
          imageUrl: null,
          explanation: "Well done! Golf is played with clubs and a ball.",
          questionText: "What is used to play golf?",
          passage: "Golf is a game where players use clubs to hit a ball into a series of holes on a course. The goal is to use the fewest strokes possible to complete the course.",
          options: ["a racket and a net", "a bat and a ball", "clubs and a ball", "a stick and a puck"],
          correctAnswer: 2,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'reading comprehension',
            intent: 'reading_comprehension',
            questionLine: "What is used to play golf?",
            imagePrompt: 'Educational scene showing read_about_sports_and_hobbies concepts'
          },
          audio: "clubs and a ball"
        }
      ],
      
    },
    '1-II.3': {
      topicInfo: {
        topicId: '1-II.3',
        topicName: 'Read_about_famous_places',
        questionElements: 'image + text + audio',
        answerElements: 'text',
        templateType: 'reading_comprehension'
      },
      questions: [
        {
          id: 1,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Big Ben',
          imageUrl: null,
          explanation: "Correct! Big Ben is a clock tower.",
          questionText: "What is Big Ben known for?",
          passage: "Big Ben is a famous clock tower in London. It is known for its large bell and accurate timekeeping. Many tourists visit Big Ben every year.",
          options: ["A famous park", "A clock tower", "A museum", "A bridge"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Big Ben',
            intent: 'reading_comprehension',
            questionLine: "What is Big Ben known for?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "clubs and a ball"
        },
        {
          id: 2,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Lisbon',
          imageUrl: null,
          explanation: "Correct! Lisbon is known for its streetcars.",
          questionText: "What is a popular mode of transportation in Lisbon?",
          passage: "Lisbon is the capital city of Portugal. It is famous for its streetcars that travel through the city on tracks. These streetcars are a popular way for people to get around.",
          options: ["Buses", "Streetcars", "Boats", "Bicycles"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Lisbon',
            intent: 'reading_comprehension',
            questionLine: "What is a popular mode of transportation in Lisbon?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "Streetcars"
        },
        {
          id: 3,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Eiffel Tower',
          imageUrl: null,
          explanation: "Correct! The Eiffel Tower is a famous tower in Paris.",
          questionText: "What type of structure is the Eiffel Tower?",
          passage: "The Eiffel Tower is an iconic structure in Paris, France. It is made of iron and stands tall in the city. Visitors can go to the top to see amazing views.",
          options: ["A bridge", "A tower", "A museum", "A park"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Eiffel Tower',
            intent: 'reading_comprehension',
            questionLine: "What type of structure is the Eiffel Tower?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "A tower"
        },
        {
          id: 4,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Statue of Liberty',
          imageUrl: null,
          explanation: "Correct! The Statue of Liberty is a famous statue in the U.S.",
          questionText: "What is the Statue of Liberty?",
          passage: "The Statue of Liberty is a symbol of freedom in the United States. It is located in New York Harbor and was a gift from France.",
          options: ["A park", "A statue", "A bridge", "A building"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Statue of Liberty',
            intent: 'reading_comprehension',
            questionLine: "What is the Statue of Liberty?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "A statue"
        },
        {
          id: 5,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Great Wall of China',
          imageUrl: null,
          explanation: "Correct! The Great Wall of China is a massive wall.",
          questionText: "What is the Great Wall of China?",
          passage: "The Great Wall of China is an ancient wall that stretches across northern China. It was built to protect against invasions and is a popular tourist attraction.",
          options: ["A city", "A wall", "A river", "A palace"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Great Wall of China',
            intent: 'reading_comprehension',
            questionLine: "What is the Great Wall of China?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "A wall"
        },
        {
          id: 6,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Sydney Opera House',
          imageUrl: null,
          explanation: "Correct! The Sydney Opera House is a theater.",
          questionText: "What is the Sydney Opera House known for?",
          passage: "The Sydney Opera House is a renowned performing arts center in Australia. Its unique design resembles sails on the water.",
          options: ["A museum", "A theater", "A hotel", "A monument"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Sydney Opera House',
            intent: 'reading_comprehension',
            questionLine: "What is the Sydney Opera House known for?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "A theater"
        },
        {
          id: 7,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Pyramids of Giza',
          imageUrl: null,
          explanation: "Correct! The Pyramids of Giza are pyramids.",
          questionText: "What are the Pyramids of Giza?",
          passage: "The Pyramids of Giza are ancient pyramids located in Egypt. They were built as tombs for pharaohs and are one of the Seven Wonders of the Ancient World.",
          options: ["A temple", "A pyramid", "A castle", "A lighthouse"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Pyramids of Giza',
            intent: 'reading_comprehension',
            questionLine: "What are the Pyramids of Giza?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "A pyramid"
        },
        {
          id: 8,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Colosseum',
          imageUrl: null,
          explanation: "Correct! The Colosseum is an amphitheater.",
          questionText: "What was the Colosseum used for?",
          passage: "The Colosseum is an ancient amphitheater in Rome, Italy. It was used for gladiator contests and public spectacles in ancient times.",
          options: ["A palace", "An amphitheater", "A library", "A fortress"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Colosseum',
            intent: 'reading_comprehension',
            questionLine: "What was the Colosseum used for?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "An amphitheater"
        },
        {
          id: 9,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Taj Mahal',
          imageUrl: null,
          explanation: "Correct! The Taj Mahal is a mausoleum.",
          questionText: "What is the Taj Mahal?",
          passage: "The Taj Mahal is a white marble mausoleum in India. It was built by Emperor Shah Jahan in memory of his wife Mumtaz Mahal.",
          options: ["A palace", "A mausoleum", "A temple", "A garden"],
          correctAnswer: 1,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Taj Mahal',
            intent: 'reading_comprehension',
            questionLine: "What is the Taj Mahal?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "A mausoleum"
        },
        {
          id: 10,
          topicId: '1-II.3',
          topicName: 'Read_about_famous_places',
          questionElements: 'image + text + audio',
          answerElements: 'text',
          templateType: 'reading_comprehension',
          word: 'Machu Picchu',
          imageUrl: null,
          explanation: "Correct! Machu Picchu is an ancient city.",
          questionText: "What is Machu Picchu?",
          passage: "Machu Picchu is an ancient Incan city in Peru. It is located high in the Andes mountains and is known for its stunning archaeological sites.",
          options: ["A city", "A mountain", "A river", "A desert"],
          correctAnswer: 0,
          template: 'reading_comprehension',
          isSpacing: false,
          isSorting: false,
          isSpelling: false,
          aiHook: {
            targetWord: 'Machu Picchu',
            intent: 'reading_comprehension',
            questionLine: "What is Machu Picchu?",
            imagePrompt: 'Educational scene showing read_about_famous_places concepts'
          },
          audio: "A city"
        }
      ],
      
    }
  }
};

const MCQScreenTypeA: React.FC<MCQScreenTypeAProps> = ({
  getAspectRatio,
  sidebarCollapsed,
  setSidebarCollapsed,
  chatMessages,
  setChatMessages,
  onGenerate,
  onGenerateImage,
  chatPanelWidthPercent,
  setChatPanelWidthPercent,
  isResizing,
  setIsResizing,
  messagesScrollRef,
  lastMessageCount,
  handleResizeStart,
  selectedTopicId = '1-H.1',
  onBackToTopics,
  onRetryTopic,
  onNextTopic
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const resizeRef = React.useRef<HTMLDivElement>(null);
  
  // MCQ state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  
  // Score tracking state
  const [score, setScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showCompletionPage, setShowCompletionPage] = useState<'none' | 'success' | 'practice'>('none');
  
  // Track first attempts for each question
  const [firstAttempts, setFirstAttempts] = useState<Record<number, boolean>>({});
  
  // Fill blank state
  const [fillBlankAnswer, setFillBlankAnswer] = useState<string>('');
  
  // Wrong answer reflection state
  const [isInReflectionMode, setIsInReflectionMode] = useState(false);
  const [hasReflected, setHasReflected] = useState(false);
  
  // AI-generated contextual questions state
  const [contextualQuestions, setContextualQuestions] = useState<Record<number, string>>({});
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  
  // AI-generated images state
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  
  // Text-to-speech state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasAutoSpokenQuestion, setHasAutoSpokenQuestion] = useState(false);

  // Speech-to-text state for reading comprehension
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [recordedText, setRecordedText] = useState('');

  // Drag and drop state
  const [draggedWord, setDraggedWord] = useState<string | null>(null);
  const [sortedWords, setSortedWords] = useState<Record<string, string[]>>({});
  const [availableWords, setAvailableWords] = useState<string[]>([]);
  const [isDragOverBin, setIsDragOverBin] = useState<string | null>(null);

  // Get current topic and questions
  const currentTopic = sampleMCQData.topics[selectedTopicId];
  const currentQuestion = currentTopic.questions[currentQuestionIndex];
  
  // Helper function to extract grade level from topicId
  const getGradeLevel = (topicId: string): string => {
    const gradeMatch = topicId.match(/^([KG0-9]+)/);
    if (!gradeMatch) return "Elementary";
    
    const grade = gradeMatch[1];
    if (grade === 'K' || grade === 'G') return "Kindergarten";
    if (grade === '1') return "Grade 1";
    if (grade === '2') return "Grade 2";
    if (grade === '3') return "Grade 3";
    if (grade === '4') return "Grade 4";
    if (grade === '5') return "Grade 5";
    return `Grade ${grade}`;
  };
  
  // Set current topic in progress tracking when component mounts or topic changes
  useEffect(() => {
    setCurrentTopic(selectedTopicId);
  }, [selectedTopicId]);
  
  // Get all topic IDs in order
  const topicIds = Object.keys(sampleMCQData.topics);
  
  // Get next topic ID
  const getNextTopicId = useCallback(() => {
    const currentIndex = topicIds.indexOf(selectedTopicId);
    if (currentIndex >= 0 && currentIndex < topicIds.length - 1) {
      return topicIds[currentIndex + 1];
    }
    return null; // No next topic (reached the end)
  }, [selectedTopicId, topicIds]);

  // Confetti celebration function
  const celebrateWithConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Add more confetti bursts
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x: 0.25, y: 0.7 }
      });
    }, 250);
    
    setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x: 0.75, y: 0.7 }
      });
    }, 400);
  }, []);

  // Check if it's a reading comprehension question
  const isReadingComprehension = currentQuestion.templateType === 'reading_comprehension';
  
  // Get the contextual question text or fall back to original
  const displayQuestionText = contextualQuestions[currentQuestionIndex] || currentQuestion.questionText;
  
  // Check if current question is drag-and-drop
  const isDragDropQuestion = currentQuestion.template === 'drag_and_drop_sorting';
  
  // Type guard to check if question is drag-drop type
  const isDragDropType = (question: any): question is DragDropQuestion => {
    return question.template === 'drag_and_drop_sorting';
  };
  


  const handleAnswerClick = useCallback(async (answerIndex: number) => {
    if ((hasAnswered && isCorrect) || isGeneratingQuestion || isInReflectionMode) return;
    
    playClickSound();
    setSelectedAnswer(answerIndex);
    
    const correct = answerIndex === currentQuestion.correctAnswer;
    const isFirstAttempt = !firstAttempts[currentQuestionIndex];
    
    // Mark this question as attempted
    if (isFirstAttempt) {
      setFirstAttempts(prev => ({
        ...prev,
        [currentQuestionIndex]: true
      }));
    }
    
    setIsCorrect(correct);
    
    if (correct) {
      // Correct answer - show celebration and disable further selections
      setHasAnswered(true);
      setShowFeedback(true);
      
      // Only increment score if it's the first attempt
      if (isFirstAttempt) {
        setScore(prev => prev + 1);
      }
      
      // Celebrate with confetti!
      celebrateWithConfetti();
      const feedbackMessage = {
        type: 'ai' as const,
        content: `🎉 ${currentQuestion.explanation}`,
        timestamp: Date.now()
      };
      
      setChatMessages((prev: any) => [...prev, feedbackMessage]);
      playMessageSound();
      
      // Auto-speak the AI feedback message
      ttsService.speakAIMessage(feedbackMessage.content);
    } else {
      // Wrong answer - generate AI reflection prompt
      setHasAnswered(false); // Allow trying other options
      
      try {
        // Generate AI reflection response using the question context
        const reflectionResponse = await aiService.generateReflectionPrompt(
          displayQuestionText, // Use the contextual question text
          (currentQuestion as MCQQuestion).options,
          answerIndex,
          Number(currentQuestion.correctAnswer),
          currentQuestion.topicName,
          getGradeLevel(currentQuestion.topicId),
          'mcq'
        );
        
        const hintMessage = {
          type: 'ai' as const,
          content: reflectionResponse,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, hintMessage]);
        playMessageSound();
        
        // Auto-speak the hint message
        ttsService.speakAIMessage(hintMessage.content);
      } catch (error) {
        console.error('Error generating reflection prompt:', error);
        
        // Fallback to a simple message if AI fails
        const fallbackMessage = {
          type: 'ai' as const,
          content: `🤔 Great effort on this ${currentQuestion.topicName.replace(/_/g, ' ').toLowerCase()} question! Can you tell me what made you choose "${(currentQuestion as MCQQuestion).options[answerIndex]}"? Let's look at the question again together.`,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, fallbackMessage]);
        playMessageSound();
        ttsService.speakAIMessage(fallbackMessage.content);
      }
      
      // Clear the wrong answer visual feedback after a brief moment
      setTimeout(() => {
        setSelectedAnswer(null);
      }, 1500);
    }
    
    // Auto-expand chat to show feedback
    setSidebarCollapsed(false);
  }, [hasAnswered, isCorrect, isGeneratingQuestion, isInReflectionMode, currentQuestion, displayQuestionText, firstAttempts, currentQuestionIndex, setChatMessages, setSidebarCollapsed]);

  // Handle fill blank answer submission
  const handleFillBlankSubmit = useCallback(async () => {
    if (hasAnswered || isGeneratingQuestion || isInReflectionMode || !fillBlankAnswer.trim()) return;
    
    playClickSound();
    setHasAnswered(true);
    
    const currentFillBlankQuestion = currentQuestion as FillBlankQuestion;
    const userAnswer = fillBlankAnswer.trim().toLowerCase();
    const correctAnswer = currentFillBlankQuestion.correctAnswer.toLowerCase();
    const isAnswerCorrect = userAnswer === correctAnswer;
    const isFirstAttempt = !firstAttempts[currentQuestionIndex];
    
    // Mark this question as attempted
    if (isFirstAttempt) {
      setFirstAttempts(prev => ({
        ...prev,
        [currentQuestionIndex]: true
      }));
    }
    
    setIsCorrect(isAnswerCorrect);
    
    if (isAnswerCorrect) {
      // Correct answer
      setShowFeedback(true);
      
      // Only increment score if it's the first attempt
      if (isFirstAttempt) {
        setScore(prev => prev + 1);
      }
      
      // Celebrate with confetti!
      celebrateWithConfetti();
      const feedbackMessage = {
        type: 'ai' as const,
        content: `🎉 ${currentFillBlankQuestion.explanation}`,
        timestamp: Date.now()
      };
      
      setChatMessages((prev: any) => [...prev, feedbackMessage]);
      playMessageSound();
      
      // Auto-speak the AI feedback message
      ttsService.speakAIMessage(feedbackMessage.content);
    } else {
      // Wrong answer - generate AI reflection prompt
      setHasAnswered(false); // Allow trying again
      
      try {
        // Generate AI reflection response for fill-in-the-blank
        const reflectionResponse = await aiService.generateReflectionPrompt(
          displayQuestionText, // Use the contextual question text
          null, // No options for fill-in-the-blank
          fillBlankAnswer.trim(), // Student's answer
          currentFillBlankQuestion.correctAnswer, // Correct answer
          currentQuestion.topicName,
          getGradeLevel(currentQuestion.topicId),
          'fill_blank'
        );
        
        const hintMessage = {
          type: 'ai' as const,
          content: reflectionResponse,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, hintMessage]);
        playMessageSound();
        
        // Auto-speak the hint message
        ttsService.speakAIMessage(hintMessage.content);
      } catch (error) {
        console.error('Error generating reflection prompt for fill-blank:', error);
        
        // Fallback to a simple message if AI fails
        const fallbackMessage = {
          type: 'ai' as const,
          content: `🌟 Nice try with your ${currentQuestion.topicName.replace(/_/g, ' ').toLowerCase()} work! Can you think about what sounds you hear when you say "${fillBlankAnswer.trim()}"? What other word might fit better here?`,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, fallbackMessage]);
        playMessageSound();
        ttsService.speakAIMessage(fallbackMessage.content);
      }
      
      // Clear the wrong answer after a brief moment
      setTimeout(() => {
        setFillBlankAnswer('');
      }, 1500);
    }
    
    // Auto-expand chat to show feedback
    setSidebarCollapsed(false);
  }, [hasAnswered, isCorrect, isGeneratingQuestion, isInReflectionMode, currentQuestion, fillBlankAnswer, setChatMessages, setSidebarCollapsed]);

  // Handle student reflection response
  const handleReflectionResponse = useCallback((studentReflection: string) => {
    if (!isInReflectionMode) return;
    
    // Student has provided their reflection, now let them try again
    setHasReflected(true);
    setIsInReflectionMode(false);
    
    // Reset the question state to allow another attempt
    setSelectedAnswer(null);
    setHasAnswered(false);
    setShowFeedback(false);
    setIsCorrect(false);
    setFillBlankAnswer('');
    
    // Generate response encouraging them to try again
    const encouragementMessage = {
      type: 'ai' as const,
      content: `Great thinking! 💭 Now that you've reflected on it, give the question another try. You can do this! 🌟`,
      timestamp: Date.now()
    };
    
    setChatMessages((prev: any) => [...prev, encouragementMessage]);
    playMessageSound();
    
    // Auto-speak the encouragement message
    ttsService.speakAIMessage(encouragementMessage.content);
  }, [isInReflectionMode, currentQuestion, setChatMessages]);

  // Wrapper for onGenerate to handle reflection mode
  const handleGenerate = useCallback((text: string) => {
    if (isInReflectionMode) {
      // Student is responding to reflection prompt
      handleReflectionResponse(text);
      return;
    }
    
    // Normal chat generation
    onGenerate(text);
  }, [isInReflectionMode, handleReflectionResponse, onGenerate]);

  const handleNextQuestion = useCallback(() => {
    playClickSound();
    if (currentQuestionIndex < currentTopic.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setIsCorrect(false);
      setHasAnswered(false);
      setIsInReflectionMode(false);
      setHasReflected(false);
      setFillBlankAnswer('');
      setHasAutoSpokenQuestion(false); // Reset auto-speech state for new question
      // Don't reset drag-and-drop state here - let useEffect handle initialization
    } else {
      // All questions completed - check score and show appropriate completion page
      setQuizCompleted(true);
      
      // Save progress - topic is completed regardless of score
      markTopicCompleted(selectedTopicId, score);
      
      if (score >= 7) {
        setShowCompletionPage('success');
      } else {
        setShowCompletionPage('practice');
      }
    }
  }, [currentQuestionIndex, currentTopic, setChatMessages]);



  // Generate contextual question when component mounts or question changes
  useEffect(() => {
    const generateContextualQuestion = async () => {
      // Skip if we already have a contextual question for this index
      if (contextualQuestions[currentQuestionIndex]) {
        return;
      }

      setIsGeneratingQuestion(true);
      
      try {
        // Load user adventure context
        const userAdventure = loadUserAdventure();
        console.log('Loading user adventure context for question generation:', {
          messageCount: userAdventure.length,
          recentMessages: userAdventure.slice(-5).map(msg => ({ type: msg.type, content: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '') }))
        });
        
        let contextualText = '';
        
        if (isReadingComprehension) {
          // For reading comprehension, generate contextual reading passage
                      contextualText = await aiService.generateContextualReadingPassage(
              currentQuestion.passage || '',
              `${currentTopic.topicInfo.topicName} - ${currentQuestion.word}`,
              userAdventure
            );
        } else if (isDragDropType(currentQuestion)) {
          // For drag-and-drop questions, pass different parameters
          contextualText = await aiService.generateContextualQuestion(
            `Topic: ${currentTopic.topicInfo.topicName} - ${currentQuestion.questionText}`,
            currentQuestion.sortingWords, // Use sorting words instead of options
            0, // Dummy value since drag-drop doesn't have a single correct answer index
            userAdventure
          );
        } else {
          // For MCQ questions
          contextualText = await aiService.generateContextualQuestion(
            `Topic: ${currentTopic.topicInfo.topicName} - ${currentQuestion.questionText}`,
            (currentQuestion as MCQQuestion).options,
            (currentQuestion as MCQQuestion).correctAnswer,
            userAdventure
          );
        }

        // Only update if we got different content (AI successfully generated one)
        const originalContent = isReadingComprehension ? currentQuestion.passage : currentQuestion.questionText;
        if (contextualText !== originalContent) {
          console.log('✅ Successfully generated contextualized content:', {
            type: isReadingComprehension ? 'reading passage' : 'question',
            original: originalContent,
            contextualized: contextualText
          });
          setContextualQuestions(prev => ({
            ...prev,
            [currentQuestionIndex]: contextualText
          }));
        } else {
          console.log('ℹ️ Using original content - AI did not generate a different contextualized version');
        }
      } catch (error) {
        console.error('Error generating contextual content:', error);
        // If generation fails, we'll use the original content (which is the fallback)
      } finally {
        setIsGeneratingQuestion(false);
      }
    };

    generateContextualQuestion();
  }, [currentQuestionIndex, currentQuestion.questionText, currentQuestion, currentTopic.topicInfo.topicName]);

  // Silent bulk generation function to create multiple images in background
  const bulkGenerateImages = useCallback(async (startIndex: number = 0, maxImages: number = 10) => {
    const questionsToGenerate = Math.min(maxImages, currentTopic.questions.length - startIndex);
    
    if (questionsToGenerate <= 0) return;
    
    console.log(`🎨 Starting silent bulk generation of ${questionsToGenerate} images from index ${startIndex}`);
    
    const userAdventure = loadUserAdventure();
    
    // Generate first image immediately (priority for current question)
    if (!generatedImages[startIndex]) {
      try {
        const firstQuestion = currentTopic.questions[startIndex];
        console.log(`🖼️ Generating priority image for question ${startIndex + 1}`);
        
        const firstImageUrl = await aiService.generateContextualImage(
          firstQuestion.audio,
          userAdventure,
          `${currentTopic.topicInfo.topicName}: ${firstQuestion.aiHook.imagePrompt}`
        );
        
        if (firstImageUrl) {
          setGeneratedImages(prev => ({
            ...prev,
            [startIndex]: firstImageUrl
          }));
          console.log(`✅ Priority image generated for question ${startIndex + 1}`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate priority image for question ${startIndex + 1}:`, error);
      }
    }
    
    // Continue generating remaining images in background (silently)
    setTimeout(async () => {
      console.log(`🔄 Starting background generation of ${questionsToGenerate - 1} remaining images`);
      
      for (let i = 1; i < questionsToGenerate; i++) {
        const questionIndex = startIndex + i;
        
        // Skip if image already exists
        if (generatedImages[questionIndex]) {
          continue;
        }
        
        try {
          const question = currentTopic.questions[questionIndex];
          console.log(`🖼️ Background generating image ${i + 1}/${questionsToGenerate} for question ${questionIndex + 1}`);
          
          const imageUrl = await aiService.generateContextualImage(
            question.audio,
            userAdventure,
            `${currentTopic.topicInfo.topicName}: ${question.aiHook.imagePrompt}`
          );
          
          if (imageUrl) {
            setGeneratedImages(prev => ({
              ...prev,
              [questionIndex]: imageUrl
            }));
            console.log(`✅ Background generated image ${i + 1}/${questionsToGenerate} for question ${questionIndex + 1}`);
          }
        } catch (error) {
          console.error(`❌ Failed to background generate image ${i + 1}/${questionsToGenerate} for question ${questionIndex + 1}:`, error);
        }
        
        // Small delay between requests to avoid overwhelming the API
        if (i < questionsToGenerate - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`🎉 Completed silent bulk generation of ${questionsToGenerate} images`);
    }, 500); // Start background generation after 500ms
    
  }, [currentTopic.questions, currentTopic.topicInfo.topicName, generatedImages]);

  // Trigger bulk image generation when component mounts
  useEffect(() => {
    // Only run bulk generation once when component mounts
    if (currentQuestionIndex === 0 && Object.keys(generatedImages).length === 0) {
      bulkGenerateImages(0, 10);
    }
  }, [bulkGenerateImages, generatedImages]);

  // Generate current image if not already generated (fallback for images not in bulk)
  useEffect(() => {
    const generateCurrentImage = async () => {
      // Skip if we already have an image for this index
      if (generatedImages[currentQuestionIndex]) {
        return;
      }

      setIsGeneratingImage(true);
      
      try {
        // Load user adventure context
        const userAdventure = loadUserAdventure();
        console.log('Loading user adventure context for current image generation:', {
          messageCount: userAdventure.length,
          lastMessage: userAdventure.length > 0 ? userAdventure[userAdventure.length - 1].content : 'No messages'
        });
        
        const currentImageUrl = await aiService.generateContextualImage(
          currentQuestion.audio, // Use the audio field text
          userAdventure,
          `${currentTopic.topicInfo.topicName}: ${currentQuestion.aiHook.imagePrompt}`
        );

        // Only update if we got a valid image URL
        if (currentImageUrl) {
          setGeneratedImages(prev => ({
            ...prev,
            [currentQuestionIndex]: currentImageUrl
          }));
        }
      } catch (error) {
        console.error('Error generating contextual image:', error);
        // If generation fails, we'll show the placeholder
      } finally {
        setIsGeneratingImage(false);
      }
    };

    generateCurrentImage();
  }, [currentQuestionIndex, currentQuestion.audio, currentQuestion.aiHook.imagePrompt, currentTopic.topicInfo.topicName, generatedImages]);

  // Initialize drag-and-drop state when question changes
  useEffect(() => {
    console.log('🔍 Drag-drop initialization check:', {
      isDragDropQuestion,
      template: currentQuestion.template,
      hasTypeGuard: isDragDropType(currentQuestion),
      questionIndex: currentQuestionIndex
    });
    
    // Small delay to ensure state resets have completed
    const timeoutId = setTimeout(() => {
      if (isDragDropQuestion && isDragDropType(currentQuestion)) {
        const dragDropQuestion = currentQuestion as DragDropQuestion;
        console.log('✅ Initializing drag-drop with:', {
          sortingWords: dragDropQuestion.sortingWords,
          sortingBins: dragDropQuestion.sortingBins
        });
        
        // Initialize available words and empty bins
        setAvailableWords([...dragDropQuestion.sortingWords]);
        const emptyBins: Record<string, string[]> = {};
        dragDropQuestion.sortingBins.forEach(bin => {
          emptyBins[bin] = [];
        });
        setSortedWords(emptyBins);
        setDraggedWord(null);
        setIsDragOverBin(null);
        
        console.log('🎯 Set availableWords to:', dragDropQuestion.sortingWords);
      } else {
        console.log('❌ Drag-drop conditions not met, clearing state');
        // Clear drag-drop state for non-drag-drop questions
        setSortedWords({});
        setAvailableWords([]);
        setDraggedWord(null);
        setIsDragOverBin(null);
      }
    }, 10); // Small delay
    
    return () => clearTimeout(timeoutId);
  }, [currentQuestionIndex, isDragDropQuestion, currentQuestion]);

  // Auto-speak question when it loads (after contextual generation is complete)
  useEffect(() => {
    // Only auto-speak if we haven't already spoken this question
    if (!hasAutoSpokenQuestion && !isGeneratingQuestion && displayQuestionText) {
      // Wait a moment for the question to render, then speak it
      const timeoutId = setTimeout(() => {
        setHasAutoSpokenQuestion(true);
        setIsSpeaking(true);
        ttsService.speakQuestion(displayQuestionText).finally(() => {
          setIsSpeaking(false);
        });
      }, 1000); // 1 second delay to let the question render

      return () => clearTimeout(timeoutId);
    }
  }, [hasAutoSpokenQuestion, isGeneratingQuestion, displayQuestionText]);

  // Handle speaking the audio text
  const handleSpeakAnswer = useCallback(() => {
    playClickSound();
    
    // Stop any current speech and speak the audio text
    ttsService.stop();
    
    // Use the audio field from the current question
    const audioText = currentQuestion.audio;
    
    setIsSpeaking(true);
    ttsService.speakAnswer(audioText).finally(() => {
      setIsSpeaking(false);
    });
  }, [currentQuestion]);

  // Handle speaking the reading passage for reading comprehension
  const handleSpeakPassage = useCallback(() => {
    playClickSound();
    
    // Stop any current speech and speak the passage
    ttsService.stop();
    
    // Use the contextual passage if available, otherwise use the original
    const passageText = contextualQuestions[currentQuestionIndex] || currentQuestion.passage || '';
    
    setIsSpeaking(true);
    ttsService.speakAnswer(passageText).finally(() => {
      setIsSpeaking(false);
    });
  }, [currentQuestion, currentQuestionIndex, contextualQuestions]);

  // Initialize speech recognition for reading comprehension
  useEffect(() => {
    if (!isReadingComprehension) return;
    
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setRecordedText(transcript);
        
        // Add the recorded text to chat
        const userMessage = {
          type: 'user' as const,
          content: `📖 I read: "${transcript}"`,
          timestamp: Date.now()
        };
        setChatMessages((prev: any) => [...prev, userMessage]);
        
        // Evaluate the reading performance
        evaluateReadingComprehension(transcript);
      };
      
      recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
        
        const errorMessage = {
          type: 'ai' as const,
          content: `🎤 Sorry, I couldn't hear you clearly. Please try again!`,
          timestamp: Date.now()
        };
        setChatMessages((prev: any) => [...prev, errorMessage]);
        playMessageSound();
      };
      
      recognitionInstance.onstart = () => {
        setIsRecording(true);
      };
      
      recognitionInstance.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognitionInstance);
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
    
    return () => {
      if (recognition) {
        recognition.abort();
      }
    };
  }, [isReadingComprehension]);

  // Speech recognition handlers for reading comprehension
  const startRecording = useCallback(() => {
    if (!recognition || isRecording) return;
    
    playClickSound();
    setRecordedText('');
    recognition.start();
    
    const startMessage = {
      type: 'ai' as const,
      content: `🎤 Go ahead, read the passage aloud! I'm listening...`,
      timestamp: Date.now()
    };
    setChatMessages((prev: any) => [...prev, startMessage]);
    playMessageSound();
  }, [recognition, isRecording]);

  const stopRecording = useCallback(() => {
    if (!recognition || !isRecording) return;
    
    playClickSound();
    recognition.stop();
  }, [recognition, isRecording]);

  const evaluateReadingComprehension = useCallback(async (transcript: string) => {
    // Use the contextual passage if available, otherwise use the original
    const passageText = contextualQuestions[currentQuestionIndex] || currentQuestion.passage || '';
    const similarity = calculateReadingSimilarity(transcript, passageText);
    
    let feedbackMessage = '';
    let isCorrect = false;
    
    if (similarity >= 0.7) {
      isCorrect = true;
      feedbackMessage = `🎉 Excellent reading! You read ${Math.round(similarity * 100)}% of the passage correctly. ${currentQuestion.explanation}`;
    } else if (similarity >= 0.5) {
      feedbackMessage = `👍 Good job! You read ${Math.round(similarity * 100)}% correctly. Try reading the passage again to improve!`;
    } else {
      // Generate AI reflection for poor reading performance
      try {
        const reflectionResponse = await aiService.generateReflectionPrompt(
          passageText, // Use the passage text
          null, // No options for reading comprehension
          Math.round(similarity * 100).toString(), // Student's accuracy percentage
          '70+', // Target accuracy
          currentQuestion.topicName,
          getGradeLevel(currentQuestion.topicId),
          'reading_comprehension'
        );
        
        feedbackMessage = reflectionResponse;
      } catch (error) {
        console.error('Error generating reflection prompt for reading comprehension:', error);
        
        // Fallback to enhanced message if AI fails
        feedbackMessage = `🌟 Great effort reading! Can you tell me which words felt the trickiest? What strategies might help you read even better?`;
      }
      
      // Read the passage aloud for the user
      setTimeout(() => {
        ttsService.speakAnswer(passageText);
      }, 2000);
    }
    
    setIsCorrect(isCorrect);
    setHasAnswered(true);
    setShowFeedback(true);
    
    const aiMessage = {
      type: 'ai' as const,
      content: feedbackMessage,
      timestamp: Date.now()
    };
    setChatMessages((prev: any) => [...prev, aiMessage]);
    playMessageSound();
    ttsService.speakAIMessage(feedbackMessage);
  }, [currentQuestion]);

  // Calculate reading similarity (simple word matching)
  const calculateReadingSimilarity = useCallback((spoken: string, original: string) => {
    const spokenWords = spoken.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const originalWords = original.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    if (originalWords.length === 0) return 0;
    
    let matchCount = 0;
    spokenWords.forEach(spokenWord => {
      if (originalWords.includes(spokenWord)) {
        matchCount++;
      }
    });
    
    return matchCount / originalWords.length;
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((word: string) => {
    setDraggedWord(word);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, binName: string) => {
    e.preventDefault();
    setIsDragOverBin(binName);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOverBin(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, binName: string) => {
    e.preventDefault();
    
    if (!draggedWord || !isDragDropQuestion) return;

    // Remove word from available words
    setAvailableWords(prev => prev.filter(w => w !== draggedWord));
    
    // Add word to the bin
    setSortedWords(prev => ({
      ...prev,
      [binName]: [...prev[binName], draggedWord]
    }));

    setDraggedWord(null);
    setIsDragOverBin(null);
  }, [draggedWord, isDragDropQuestion]);

  const handleRemoveFromBin = useCallback((word: string, binName: string) => {
    // Remove word from bin
    setSortedWords(prev => ({
      ...prev,
      [binName]: prev[binName].filter(w => w !== word)
    }));
    
    // Add word back to available words
    setAvailableWords(prev => [...prev, word]);
  }, []);

  const handleCheckDragDropAnswer = useCallback(async () => {
    if (!isDragDropType(currentQuestion)) return;

    // Check if all words are sorted
    if (availableWords.length > 0) {
      const hintMessage = {
        type: 'ai' as const,
        content: `📝 Please sort all the words into the correct bins first!`,
        timestamp: Date.now()
      };
      setChatMessages((prev: any) => [...prev, hintMessage]);
      playMessageSound();
      ttsService.speakAIMessage(hintMessage.content);
      return;
    }

    // Check if sorting is correct
    let isCorrect = true;
    const correctAnswer = currentQuestion.correctAnswer;
    
    for (const binName of Object.keys(correctAnswer)) {
      const expectedWords = correctAnswer[binName].sort();
      const actualWords = (sortedWords[binName] || []).sort();
      
      if (expectedWords.length !== actualWords.length || 
          !expectedWords.every((word, index) => word === actualWords[index])) {
        isCorrect = false;
        break;
      }
    }

    const isFirstAttempt = !firstAttempts[currentQuestionIndex];
    
    // Mark this question as attempted
    if (isFirstAttempt) {
      setFirstAttempts(prev => ({
        ...prev,
        [currentQuestionIndex]: true
      }));
    }

    setIsCorrect(isCorrect);
    setHasAnswered(true);
    setShowFeedback(true);

    if (isCorrect) {
      // Only increment score if it's the first attempt
      if (isFirstAttempt) {
        setScore(prev => prev + 1);
      }
      
      // Celebrate with confetti!
      celebrateWithConfetti();
      const feedbackMessage = {
        type: 'ai' as const,
        content: `🎉 ${currentQuestion.explanation}`,
        timestamp: Date.now()
      };
      setChatMessages((prev: any) => [...prev, feedbackMessage]);
      playMessageSound();
      ttsService.speakAIMessage(feedbackMessage.content);
    } else {
      try {
        // Generate AI reflection response for drag-and-drop
        const reflectionResponse = await aiService.generateReflectionPrompt(
          displayQuestionText, // Use the contextual question text
          null, // No options for drag-and-drop
          'current sorting has errors', // Student's answer description
          'correct sorting needed', // Correct answer description
          currentQuestion.topicName,
          getGradeLevel(currentQuestion.topicId),
          'drag_drop'
        );
        
        const hintMessage = {
          type: 'ai' as const,
          content: reflectionResponse,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, hintMessage]);
        playMessageSound();
        ttsService.speakAIMessage(hintMessage.content);
      } catch (error) {
        console.error('Error generating reflection prompt for drag-drop:', error);
        
        // Fallback to a simple message if AI fails
        const fallbackMessage = {
          type: 'ai' as const,
          content: `🤔 Interesting sorting work on ${currentQuestion.topicName.replace(/_/g, ' ').toLowerCase()}! Can you tell me what rule you're using to sort these words? What sounds do you hear in each word?`,
          timestamp: Date.now()
        };
        
        setChatMessages((prev: any) => [...prev, fallbackMessage]);
        playMessageSound();
        ttsService.speakAIMessage(fallbackMessage.content);
      }
      
      // Allow retry
      setHasAnswered(false);
      setShowFeedback(false);
    }

    setSidebarCollapsed(false);
  }, [isDragDropType, currentQuestion, availableWords.length, sortedWords, setChatMessages]);

  // Reset quiz state
  const resetQuiz = useCallback(() => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setHasAnswered(false);
    setScore(0);
    setQuizCompleted(false);
    setShowCompletionPage('none');
    setFirstAttempts({});
    setFillBlankAnswer('');
    setIsInReflectionMode(false);
    setHasReflected(false);
    setSortedWords({});
    setAvailableWords([]);
    setDraggedWord(null);
    setIsDragOverBin(null);
  }, []);

  // Reset quiz state when topic changes
  useEffect(() => {
    resetQuiz();
    // Clear contextual questions and images for new topic
    setContextualQuestions({});
    setGeneratedImages({});
    setIsGeneratingQuestion(false);
    setIsGeneratingImage(false);
  }, [selectedTopicId, resetQuiz]);

  // Show completion pages
  if (showCompletionPage === 'success') {
    return (
      <TopicComplete
        score={score}
        totalQuestions={currentTopic.questions.length}
        topicName={currentTopic.topicInfo.topicName}
        onNextTopic={() => {
          const nextTopicId = getNextTopicId();
          if (nextTopicId && onNextTopic) {
            // Reset quiz state before moving to next topic
            resetQuiz();
            // Pass the next topic ID to the parent component
            onNextTopic(nextTopicId);
          } else {
            // No more topics, go back to topic selection
            resetQuiz();
            if (onBackToTopics) {
              onBackToTopics();
            }
          }
        }}
        onRetryTopic={() => {
          resetQuiz();
          if (onRetryTopic) {
            onRetryTopic();
          }
        }}
        onBackToTopics={() => {
          resetQuiz();
          if (onBackToTopics) {
            onBackToTopics();
          }
        }}
      />
    );
  }

  if (showCompletionPage === 'practice') {
    return (
      <PracticeNeeded
        score={score}
        totalQuestions={currentTopic.questions.length}
        topicName={currentTopic.topicInfo.topicName}
        onRetryTopic={() => {
          resetQuiz();
          if (onRetryTopic) {
            onRetryTopic();
          }
        }}
        onBackToTopics={() => {
          resetQuiz();
          if (onBackToTopics) {
            onBackToTopics();
          }
        }}
      />
    );
  }

  return (
    <main 
      className="flex-1 flex items-center justify-center min-h-0 overflow-hidden px-4 py-4 lg:px-6 bg-primary/60 relative" 
      style={{
        backgroundImage: `url('/backgrounds/random3.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'multiply'
      }}
      role="main"
    >
      {/* Glass blur overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-primary/10"></div>
      
      {/* Main container */}
      <div 
        className="relative responsive-max-width"
        style={{ 
          width: '95%',
          maxWidth: '1520px',
          aspectRatio: getAspectRatio,
          maxHeight: 'calc(100vh - 100px)',
          minHeight: '500px',
          transition: 'all 0.3s ease-in-out'
        }}
      >
        {/* Background Container */}
        <div 
          className="absolute inset-0 rounded-3xl z-0"
          style={{ 
            border: '4px solid hsl(var(--primary) / 0.9)',
            boxShadow: '0 0 12px 3px rgba(0, 0, 0, 0.15)',
            backgroundColor: 'hsl(var(--primary) / 0.9)',
            overflow: 'hidden'
          }}
        />
        
        {/* Content Container */}
        <div 
          ref={containerRef}
          className="flex relative z-10 h-full w-full"
          style={{ 
            paddingTop: '8px',
            paddingBottom: '8px',
            paddingLeft: '8px',
            paddingRight: '8px'
          }}
        >
          {/* Main Content Panel */}
          <section 
            aria-label="MCQ content panel" 
            className="flex flex-col min-h-0 relative flex-1 transition-all duration-300 ease-in-out"
            style={{ marginRight: sidebarCollapsed ? '0px' : '5px' }}
          >

            
            {/* Question Card */}
            <div className="flex-1 flex items-center justify-center mb-2 relative z-10">
              <div 
                className="relative bg-white rounded-3xl p-8 max-w-3xl w-full"
                style={{
                  border: '4px solid black',
                  boxShadow: '0 8px 0 black',
                  borderRadius: '24px'
                }}
              >


                {/* Notebook spiral binding */}
                <div className="absolute top-0 left-0 right-0 h-6 flex justify-evenly items-center px-4">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="relative">
                      <div 
                        className="w-4 h-4 border-2 border-black rounded-full bg-gray-300"
                        style={{
                          marginTop: '-12px',
                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)'
                        }}
                      />
                      <div 
                        className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full border border-gray-400"
                        style={{
                          transform: 'translate(-50%, -50%)',
                          marginTop: '-12px'
                        }}
                      />
                    </div>
                  ))}
                </div>
                
                {/* Question content */}
                <div className="mt-4">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
                    Question {currentQuestionIndex + 1} of {currentTopic.questions.length}
                  </h2>
                  

                  
                  {!isReadingComprehension && (
                    <div className="text-xl font-medium text-gray-800 mb-8 text-center leading-relaxed">
                      {isGeneratingQuestion ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Creating your adventure question...</span>
                        </div>
                      ) : (
                        <p>{displayQuestionText}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Dynamic Image Section */}
                  {!isReadingComprehension && (
                    <div className="mb-8 flex justify-center">
                    <div className="relative">
                      <div 
                        className="w-64 h-48 border-2 border-gray-300 rounded-xl overflow-hidden"
                        style={{
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}
                      >
                        {isGeneratingImage ? (
                          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                            <div className="text-center text-gray-600">
                              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                              <p className="text-sm font-medium">Creating your adventure image...</p>
                            </div>
                          </div>
                        ) : generatedImages[currentQuestionIndex] ? (
                          <img 
                            src={generatedImages[currentQuestionIndex]} 
                            alt={`Illustration for ${currentQuestion.word}`}
                            className="w-full h-full object-cover"
                            style={{
                              filter: 'brightness(1.05) contrast(1.1) saturate(1.1)'
                            }}
                            onError={(e) => {
                              // If image fails to load, show placeholder
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const placeholder = target.nextElementSibling as HTMLElement;
                              if (placeholder) placeholder.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        
                        {/* Fallback placeholder (hidden by default, shown on image error or no image) */}
                        <div 
                          className={cn(
                            "w-full h-full bg-gray-100 flex items-center justify-center",
                            !isGeneratingImage && !generatedImages[currentQuestionIndex] ? 'flex' : 'hidden'
                          )}
                        >
                          <div className="text-center text-gray-400">
                            <div className="text-4xl mb-2">🎨</div>
                            <p className="text-sm font-medium">Adventure image</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Answer Speaker Button - always visible on left side */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleSpeakAnswer}
                        className={cn(
                          "absolute -bottom-3 -left-3 h-10 w-10 rounded-full border-2 border-blue-600 bg-blue-100 hover:bg-blue-200 z-10 transition-all duration-200 hover:scale-110",
                          isSpeaking && "animate-pulse"
                        )}
                        style={{ boxShadow: '0 3px 0 #2563eb' }}
                        title="Read the question description aloud"
                      >
                        <Volume2 className="h-4 w-4 text-blue-600" />
                      </Button>
                    </div>
                  </div>
                  )}
                  
                  {/* Answer Options - MCQ, Drag Drop, or Fill Blank */}
                  {isDragDropQuestion && isDragDropType(currentQuestion) ? (
                    /* Drag and Drop Interface */
                    <div className="space-y-6">
                      {/* Available Words to Sort */}
                      <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                        <h3 className="text-lg font-bold text-blue-800 mb-3 text-center">Words to Sort</h3>
                        <div className="flex flex-wrap justify-center gap-3 min-h-[60px] items-center">
                          {availableWords.map((word) => (
                            <div
                              key={word}
                              draggable
                              onDragStart={() => handleDragStart(word)}
                              className="bg-white border-2 border-blue-600 rounded-xl px-4 py-2 font-medium text-lg cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-105 hover:shadow-md"
                              style={{ boxShadow: '0 2px 0 #2563eb' }}
                            >
                              {word}
                            </div>
                          ))}
                          {availableWords.length === 0 && (
                            <p className="text-blue-600 font-medium italic">All words sorted! 🎉</p>
                          )}
                        </div>
                      </div>

                      {/* Sorting Bins */}
                      <div className="grid grid-cols-2 gap-6">
                        {currentQuestion.sortingBins.map((binName) => (
                          <div
                            key={binName}
                            onDragOver={(e) => handleDragOver(e, binName)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, binName)}
                            className={cn(
                              "border-2 border-dashed rounded-xl p-4 min-h-[120px] transition-all duration-200",
                              isDragOverBin === binName
                                ? "border-green-500 bg-green-50 scale-105"
                                : "border-gray-400 bg-gray-50 hover:bg-gray-100"
                            )}
                          >
                            <h3 className="text-lg font-bold text-center mb-3 text-gray-700">{binName}</h3>
                            <div className="space-y-2 min-h-[60px]">
                              {sortedWords[binName]?.map((word) => (
                                <div
                                  key={word}
                                  onClick={() => handleRemoveFromBin(word, binName)}
                                  className="bg-white border-2 border-gray-600 rounded-lg px-3 py-2 font-medium text-center cursor-pointer transition-all duration-200 hover:bg-red-50 hover:border-red-400"
                                  style={{ boxShadow: '0 2px 0 #4b5563' }}
                                  title="Click to remove from bin"
                                >
                                  {word}
                                </div>
                              )) || null}
                              {(!sortedWords[binName] || sortedWords[binName].length === 0) && (
                                <div className="text-center text-gray-400 italic py-4">
                                  Drop words here
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Check Answer Button */}
                      <div className="flex justify-center">
                        <Button
                          onClick={handleCheckDragDropAnswer}
                          disabled={hasAnswered && isCorrect}
                          className="border-2 bg-blue-600 hover:bg-blue-700 text-white btn-animate px-8 py-3 text-lg font-bold"
                          style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                        >
                          Check My Sorting
                        </Button>
                      </div>
                    </div>
                  ) : currentQuestion.templateType === 'fill_blank' ? (
                    /* Fill Blank Interface */
                    <div className="space-y-6">
                      <div className="flex flex-col items-center gap-6">
                        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 w-full max-w-md">
                          <h3 className="text-lg font-bold text-yellow-800 mb-4 text-center">Enter your answer:</h3>
                          <div className="flex flex-col gap-4">
                            <input
                              type="text"
                              value={fillBlankAnswer}
                              onChange={(e) => setFillBlankAnswer(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleFillBlankSubmit();
                                }
                              }}
                              placeholder="Type the complete word here..."
                              disabled={(hasAnswered && isCorrect) || isGeneratingQuestion || isInReflectionMode}
                              className={cn(
                                "w-full p-4 text-center text-xl font-medium rounded-xl border-2 transition-all duration-200",
                                "focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500",
                                (hasAnswered && isCorrect) ? "bg-green-100 border-green-500 text-green-800" : "bg-white border-yellow-400",
                                isGeneratingQuestion && "opacity-50 cursor-not-allowed"
                              )}
                              style={{
                                boxShadow: hasAnswered && isCorrect ? '0 4px 0 #10b981' : '0 4px 0 #fbbf24'
                              }}
                            />
                            <Button
                              onClick={handleFillBlankSubmit}
                              disabled={(hasAnswered && isCorrect) || isGeneratingQuestion || isInReflectionMode || !fillBlankAnswer.trim()}
                              className={cn(
                                "border-2 text-white btn-animate px-6 py-3 text-lg font-bold transition-all duration-200",
                                hasAnswered && isCorrect 
                                  ? "bg-green-600 hover:bg-green-700 border-green-700"
                                  : "bg-yellow-600 hover:bg-yellow-700 border-yellow-700"
                              )}
                              style={{
                                boxShadow: hasAnswered && isCorrect ? '0 4px 0 #10b981' : '0 4px 0 #d97706'
                              }}
                            >
                              {hasAnswered && isCorrect ? (
                                <div className="flex items-center gap-2">
                                  <Check className="h-5 w-5" />
                                  <span>Correct!</span>
                                </div>
                              ) : (
                                'Submit Answer'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : isReadingComprehension ? (
                    /* Reading Comprehension Interface */
                    <div className="space-y-6">
                      {/* AI-Generated Reading Passage */}
                      <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-6">
                        <div className="bg-white border border-purple-200 rounded-lg p-6 leading-relaxed">
                          {isGeneratingQuestion ? (
                            <div className="flex items-center justify-center gap-2 py-4">
                              <Loader2 className="h-5 w-5 animate-spin" />
                              <span>Creating your adventure reading passage...</span>
                            </div>
                          ) : (
                            <p className="text-lg text-gray-800 leading-loose">
                              {contextualQuestions[currentQuestionIndex] || currentQuestion.passage}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Image Section */}
                      <div className="flex justify-center">
                        <div className="relative">
                          <div 
                            className="w-64 h-48 border-2 border-gray-300 rounded-xl overflow-hidden"
                            style={{
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            {isGeneratingImage ? (
                              <div className="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                                <div className="text-center text-gray-600">
                                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                                  <p className="text-sm font-medium">Creating your adventure image...</p>
                                </div>
                              </div>
                            ) : generatedImages[currentQuestionIndex] ? (
                              <img 
                                src={generatedImages[currentQuestionIndex]} 
                                alt={`Illustration for ${currentQuestion.word}`}
                                className="w-full h-full object-cover"
                                style={{
                                  filter: 'brightness(1.05) contrast(1.1) saturate(1.1)'
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const placeholder = target.nextElementSibling as HTMLElement;
                                  if (placeholder) placeholder.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            
                            <div 
                              className={cn(
                                "w-full h-full bg-gray-100 flex items-center justify-center",
                                !isGeneratingImage && !generatedImages[currentQuestionIndex] ? 'flex' : 'hidden'
                              )}
                            >
                              <div className="text-center text-gray-400">
                                <div className="text-4xl mb-2">🎨</div>
                                <p className="text-sm font-medium">Adventure image</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Passage Speaker Button - always visible on left side */}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleSpeakPassage}
                            className={cn(
                              "absolute -bottom-3 -left-3 h-10 w-10 rounded-full border-2 border-blue-600 bg-blue-100 hover:bg-blue-200 z-10 transition-all duration-200 hover:scale-110",
                              isSpeaking && "animate-pulse"
                            )}
                            style={{ boxShadow: '0 3px 0 #2563eb' }}
                            title="Read the passage aloud"
                          >
                            <Volume2 className="h-4 w-4 text-blue-600" />
                          </Button>
                        </div>
                      </div>

                      {/* Microphone Controls */}
                      <div className="flex justify-center">
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 w-full max-w-md">
                          <h3 className="text-lg font-bold text-blue-800 mb-4 text-center">Read the passage aloud!</h3>
                          
                          {/* Microphone Button */}
                          <div className="flex justify-center mb-4">
                            <Button
                              onClick={isRecording ? stopRecording : startRecording}
                              disabled={hasAnswered && isCorrect}
                              className={cn(
                                "rounded-full w-20 h-20 border-4 transition-all duration-200",
                                isRecording 
                                  ? "bg-red-500 hover:bg-red-600 border-red-600 animate-pulse" 
                                  : "bg-blue-500 hover:bg-blue-600 border-blue-600 hover:scale-110"
                              )}
                              style={{
                                boxShadow: isRecording ? '0 6px 0 #dc2626' : '0 6px 0 #2563eb'
                              }}
                            >
                              <Mic className={cn("h-8 w-8 text-white", isRecording && "animate-pulse")} />
                            </Button>
                          </div>
                          
                          {/* Recording Status */}
                          <div className="text-center">
                            {isRecording ? (
                              <p className="text-red-600 font-medium animate-pulse">
                                🎤 Recording... Speak clearly!
                              </p>
                            ) : recordedText ? (
                              <div className="space-y-2">
                                <p className="text-green-600 font-medium">✓ Recording complete!</p>
                                <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                                  <p className="text-sm text-gray-700 italic">"{recordedText}"</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-blue-600 font-medium">
                                Click the microphone to start reading
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* MCQ Interface */
                    <div className="space-y-4">
                      {(currentQuestion as MCQQuestion).options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleAnswerClick(index)}
                          disabled={(hasAnswered && isCorrect) || isGeneratingQuestion || isInReflectionMode}
                          className={cn(
                            "w-full p-4 text-left rounded-xl border-3 border-black transition-all duration-200 hover:scale-[1.02] font-medium text-lg",
                            hasAnswered && isCorrect && index === (currentQuestion as MCQQuestion).correctAnswer && "bg-green-200 border-green-600",
                            index === selectedAnswer && !isCorrect && "bg-red-100 border-red-400 animate-pulse",
                            (!hasAnswered || !isCorrect) && !isGeneratingQuestion && "bg-white hover:bg-primary/10 cursor-pointer",
                            ((hasAnswered && isCorrect) || isGeneratingQuestion) && "cursor-not-allowed",
                            isGeneratingQuestion && "opacity-50"
                          )}
                          style={{ 
                            boxShadow: hasAnswered && isCorrect && index === (currentQuestion as MCQQuestion).correctAnswer 
                              ? '0 4px 0 #16a34a' 
                              : index === selectedAnswer && !isCorrect
                                ? '0 3px 0 #f87171' 
                                : '0 4px 0 black'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span>{option}</span>
                            {hasAnswered && isCorrect && index === (currentQuestion as MCQQuestion).correctAnswer && (
                              <Check className="h-6 w-6 text-green-600" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Next Question Button */}
                  {showFeedback && !isInReflectionMode && (
                    <div className="flex justify-center mt-8">
                      <Button
                        variant="default"
                        size="lg"
                        onClick={handleNextQuestion}
                        className="border-2 bg-green-600 hover:bg-green-700 text-white btn-animate px-8 py-3 text-lg font-bold"
                        style={{ borderColor: 'hsl(from hsl(var(--primary)) h s 25%)', boxShadow: '0 4px 0 black' }}
                      >
                        {currentQuestionIndex < currentTopic.questions.length - 1 ? 'Next Question' : 'Finish Adventure'}
                      </Button>
                    </div>
                  )}
                  
                  {/* Reflection mode indicator */}
                  {isInReflectionMode && (
                    <div className="flex justify-center mt-8">
                      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-xl px-6 py-3 text-center">
                        <p className="text-lg font-medium text-yellow-800">
                          💭 Think about it and share your thoughts in the chat!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Right Sidebar */}
          <aside 
            className={cn(
              "flex flex-col min-h-0 z-10 relative rounded-3xl overflow-hidden border-2 border-black transition-all duration-300 ease-in-out",
              isResizing ? 'chat-panel-resizing' : ''
            )}
            style={{ 
              width: sidebarCollapsed ? '0%' : `${chatPanelWidthPercent}%`,
              minWidth: sidebarCollapsed ? '0px' : '320px',
              maxWidth: sidebarCollapsed ? '0px' : '450px',
              opacity: sidebarCollapsed ? 0 : 1,
              height: '100%',
              backgroundImage: `url('/backgrounds/space.png')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              marginLeft: sidebarCollapsed ? '0px' : '5px',
              pointerEvents: sidebarCollapsed ? 'none' : 'auto'
            }}
          >
            {/* Glass blur overlay */}
            <div 
              className="absolute inset-0 backdrop-blur-sm bg-gradient-to-b from-primary/15 via-white/40 to-primary/10"
              style={{ zIndex: 1 }}
            />
            
            <div className="relative z-10 flex flex-col h-full">
              {/* Close Button */}
              {!sidebarCollapsed && (
                <div className="absolute top-3 right-3 z-20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      playClickSound();
                      setSidebarCollapsed(true);
                    }}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground btn-animate bg-white/20 backdrop-blur-sm rounded-full"
                    aria-label="Close chat panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            
              {!sidebarCollapsed && (
                <>
                  {/* Avatar Section */}
                  <div className="flex-shrink-0 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/20 to-primary/25 backdrop-blur-sm" />
                    <div className="relative z-10">
                      <ChatAvatar />
                    </div>
                  </div>
                
                  {/* Messages */}
                  <div className="flex-1 min-h-0 relative">
                    <div 
                      ref={messagesScrollRef}
                      className="h-full overflow-y-auto space-y-3 p-3 bg-white/95 backdrop-blur-sm"
                    >
                      {chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          <p>📚 Answer the questions and get feedback from Krafty!</p>
                        </div>
                      ) : (
                        chatMessages.map((message, index) => (
                          <div
                            key={`${message.timestamp}-${index}`}
                            className={cn(
                              "flex animate-slide-up-smooth",
                              message.type === 'user' ? "justify-end" : "justify-start"
                            )}
                            style={{ 
                              animationDelay: index < lastMessageCount - 1 ? `${Math.min(index * 0.04, 0.2)}s` : "0s"
                            }}
                          >
                            <div
                              className={cn(
                                "max-w-[80%] rounded-lg px-3 py-2 text-sm transition-all duration-200",
                                message.type === 'user' 
                                  ? "bg-primary text-primary-foreground" 
                                  : "bg-card border-2"
                              )}
                              style={message.type === 'ai' ? { borderColor: 'hsla(var(--primary), 0.9)' } : {}}
                            >
                              <div className="font-medium text-xs mb-1 opacity-70">
                                {message.type === 'user' ? 'You' : '🤖 Krafty'}
                              </div>
                              <div>{message.content}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Input Bar */}
                  <div className="flex-shrink-0 p-3 border-t border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                    <InputBar onGenerate={handleGenerate} onGenerateImage={onGenerateImage} />
                  </div>
                </>
              )}
              
              {/* Resize Handle */}
              {!sidebarCollapsed && (
                <div
                  className="absolute top-0 left-0 w-1 h-full cursor-ew-resize bg-transparent hover:bg-foreground/20 transition-colors duration-200 group hidden sm:block"
                  onMouseDown={handleResizeStart}
                  title="Drag to resize chat panel"
                >
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-12 bg-transparent group-hover:bg-foreground/50 transition-colors duration-200" />
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default MCQScreenTypeA;
