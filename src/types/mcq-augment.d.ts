// Augment question types to allow reading fluency flag in dataset entries
// This avoids editing the very large mcq-questions.tsx file directly.
declare interface ReadingQuestion {
  /** When present, marks a reading item as a fluency prompt provider. */
  isReadingFluency?: boolean;
}

// Optionally widen Topic.questions union via a helper interface name
// If Topic is re-declared, TS will merge members by name.
declare interface ReadingFluencyQuestion extends ReadingQuestion {
  isReading: boolean;
  isReadingFluency: boolean;
}

