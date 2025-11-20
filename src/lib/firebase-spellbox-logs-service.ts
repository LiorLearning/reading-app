// Firebase service for Spellbox attempt logs
import { 
  doc, 
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from './firebase';

export interface SpellboxAttempt {
  value: string;
  // Optional extras for reading fluency or rich attempts
  transcript?: string;
  accuracy?: number; // 0..1
  isReadingFluency?: boolean;
}

export interface SpellboxQuestionAttempt {
  created_at: Timestamp | number;
  correctAnswer: string;
  question_blank: string; // Format like "_ _ T" where _ represents blanks
  attempts: SpellboxAttempt[];
  // Optional metadata
  questionId?: number;
  generated_line?: string; // For reading fluency: store the dynamic line used
}

export interface SpellboxLogDocument {
  userId: string;
  topicId: string;
  grade: string;
  created_at: Timestamp | number;
  updated_at: Timestamp | number;
  questions: SpellboxQuestionAttempt[];
}

class FirebaseSpellboxLogsService {
  private readonly COLLECTION_NAME = 'spellboxLogs';

  /**
   * Log or update a spellbox attempt
   * Document ID format: userId#topicId
   */
  async logSpellboxAttempt(
    userId: string,
    topicId: string,
    grade: string,
    questionId: number,
    correctAnswer: string,
    questionBlank: string,
    userAttempt: string,
    isCorrect: boolean,
    extras?: { isReadingFluency?: boolean; generatedLine?: string; transcript?: string; accuracy?: number }
  ): Promise<void> {
    try {
      if (!userId || !topicId) {
        console.error('[SpellboxLogs] ERROR: Missing required fields', {
          hasUserId: !!userId,
          hasTopicId: !!topicId,
          userId,
          topicId
        });
        throw new Error('Missing required fields: userId and topicId are required');
      }

      // Verify userId is not empty string
      if (userId.trim() === '') {
        console.error('[SpellboxLogs] ERROR: userId is empty string');
        throw new Error('userId cannot be empty');
      }

      const docId = `${userId}#${topicId}`;
      const docRef = doc(db, this.COLLECTION_NAME, docId);
      const docSnap = await getDoc(docRef);

      const now = serverTimestamp() as Timestamp;
      const nowMillis = Date.now();
      if (docSnap.exists()) {
        // Document exists - update it
        
        const existingData = docSnap.data() as SpellboxLogDocument;
        let questions = [...(existingData.questions || [])];
        
        // Find existing question entry or create new one
        const questionIndex = questions.findIndex(
          (q: any) => {
            // Match by question ID if available, otherwise by correctAnswer
            return (q.questionId === questionId) || 
                   (q.correctAnswer?.toLowerCase() === correctAnswer.toLowerCase());
          }
        );

        if (questionIndex >= 0) {
          // Question exists - append attempt to attempts array
          const existingQuestion = questions[questionIndex];
          
          // Only prevent duplicate if it's the same as the LAST attempt
          // Allow repeats if it's not the latest attempt
          const attempts = [...(existingQuestion.attempts || [])];
          const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
          
          // Only skip if this attempt is the same as the last one
          // Handle both old format (string) and new format (object with value property)
          const lastAttemptValue = lastAttempt && typeof lastAttempt === 'object' ? lastAttempt.value : lastAttempt;
          if (lastAttemptValue !== userAttempt) {
            attempts.push({
              value: userAttempt,
              ...(extras?.transcript ? { transcript: extras.transcript } : {}),
              ...(typeof extras?.accuracy === 'number' ? { accuracy: extras.accuracy } : {}),
              ...(extras?.isReadingFluency ? { isReadingFluency: true } : {})
            });
          } 
          
          // Update the question in the array
          questions[questionIndex] = {
            ...existingQuestion,
            attempts: attempts,
            question_blank: existingQuestion.question_blank || questionBlank, // Preserve existing or use new
            // For fluency, persist the generated line if provided
            generated_line: existingQuestion.generated_line || extras?.generatedLine || undefined,
            questionId: existingQuestion.questionId || questionId,
            // Preserve existing created_at timestamp, don't overwrite it
            // Use number (milliseconds) since serverTimestamp() can't be used in arrays
            created_at: existingQuestion.created_at || nowMillis
          };
        } else {
          // New question - add to questions array
          const newQuestion: SpellboxQuestionAttempt = {
            created_at: nowMillis, // Use milliseconds since serverTimestamp() can't be used in arrays
            correctAnswer: correctAnswer, // Full word string
            question_blank: questionBlank, // For fluency, this can store the line as well
            attempts: [{
              value: userAttempt,
              ...(extras?.transcript ? { transcript: extras.transcript } : {}),
              ...(typeof extras?.accuracy === 'number' ? { accuracy: extras.accuracy } : {}),
              ...(extras?.isReadingFluency ? { isReadingFluency: true } : {})
            }],
            questionId,
            generated_line: extras?.generatedLine || undefined
          };
          
          questions.push(newQuestion);
        }
        
        // Write the updated questions array back to Firestore
        await updateDoc(docRef, {
          updated_at: now,
          questions: questions
        });
        
        console.log('[SpellboxLogs] ✅ Updated existing document:', docId);
      } else {
        // Document doesn't exist - create new one    
        const docData = {
          userId: userId, // Explicitly set userId to ensure it matches auth.uid
          topicId: topicId,
          grade: grade || '',
          created_at: now, // serverTimestamp() for document-level fields
          updated_at: now, // serverTimestamp() for document-level fields
          questions: [{
            created_at: nowMillis, // Use milliseconds since serverTimestamp() can't be used in arrays
            correctAnswer: correctAnswer, // Full word string
            question_blank: questionBlank, // Format like "_ _ T"
            attempts: [{ value: userAttempt }]
          }]
        };
        await setDoc(docRef, docData);
        
        console.log('[SpellboxLogs] ✅ Created new document:', docId);
      }
    } catch (error: any) {
      console.error('[SpellboxLogs] ❌ ERROR logging attempt:', {
        error: error.message,
        code: error.code,
        userId,
        topicId,
        grade,
        questionId,
        correctAnswer,
        questionBlank,
        userAttempt,
        stack: error.stack
      });
      
      // Don't throw - log failures shouldn't break the app
      // But log extensively for debugging
      if (error.code === 'permission-denied') {
        console.error('[SpellboxLogs] PERMISSION DENIED - Check Firebase security rules');
      } else if (error.code === 'unavailable') {
        console.error('[SpellboxLogs] SERVICE UNAVAILABLE - Firebase may be down');
      }
    }
  }

  /**
   * Get spellbox logs for a user and topic
   */
  async getSpellboxLogs(userId: string, topicId: string): Promise<SpellboxLogDocument | null> {
    try {
      const docId = `${userId}#${topicId}`;
      const docRef = doc(db, this.COLLECTION_NAME, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as SpellboxLogDocument;
        return data;
      }

      return null;
    } catch (error: any) {
      console.error('[SpellboxLogs] ERROR retrieving logs:', {
        error: error.message,
        userId,
        topicId
      });
      return null;
    }
  }
}

// Export singleton instance
export const firebaseSpellboxLogsService = new FirebaseSpellboxLogsService();
export default firebaseSpellboxLogsService;

