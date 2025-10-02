import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface FeedbackData {
  adventureId: string | null;
  userId: string;
  timestamp: any; // Firestore serverTimestamp
  questions: Array<{
    question: string;
    answer: string;
  }>;
}

export const feedbackService = {
  async saveFeedback(
    adventureId: string | null,
    userId: string,
    enjoymentAnswer: string
  ): Promise<void> {
    try {
      const feedbackData: FeedbackData = {
        adventureId,
        userId,
        timestamp: serverTimestamp(),
        questions: [
          {
            question: "Was the class fun?",
            answer: enjoymentAnswer
          }
        ]
      };

      // Save to Firestore 'feedbacks' collection
      const docRef = await addDoc(collection(db, 'feedbacks'), feedbackData);
      console.log('Feedback saved successfully with ID:', docRef.id);
      
    } catch (error) {
      console.error('Error saving feedback to Firestore:', error);
      throw error;
    }
  }
};

// Lightweight telemetry helper (console for now; hook to analytics later)
export function trackEvent(eventName: string, payload?: Record<string, any>) {
  try {
    const data = {
      event: eventName,
      ts: Date.now(),
      ...(payload || {})
    };
    console.log('[telemetry]', data);
  } catch {}
}
