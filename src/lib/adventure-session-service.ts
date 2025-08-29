import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  Timestamp,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatMessage } from './utils';

export interface MCQAnswer {
  questionId: number;
  selectedAnswer: number;
  isCorrect: boolean;
  timestamp: number;
  topicId: string;
  questionIndex?: number; // Track the actual question index in the topic
}

export interface AdventureSession {
  id?: string;
  userId: string;
  sessionType: 'new_adventure' | 'continue_adventure' | 'continue_specific';
  adventureId: string;
  topicId: string;
  title: string;
  
  // Chat data
  chatMessages: ChatMessage[];
  totalChatMessages: number;
  
  // Question data
  mcqAnswers: MCQAnswer[];
  totalQuestionsAnswered: number;
  correctAnswers: number;
  currentQuestionIndex: number;
  
  // Adventure state
  adventureMode: 'new' | 'continue';
  isInQuestionMode: boolean;
  adventurePromptCount: number;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActivityAt: Timestamp;
}

class AdventureSessionService {
  private readonly COLLECTION_NAME = 'adventureSessions';

  // Create new adventure session (non-blocking, graceful failure)
  async createAdventureSession(
    userId: string,
    sessionType: 'new_adventure' | 'continue_adventure' | 'continue_specific',
    adventureId: string,
    topicId: string,
    adventureMode: 'new' | 'continue',
    title?: string
  ): Promise<string | null> {
    try {
      const sessionTitle = title || this.generateSessionTitle(sessionType, adventureMode, topicId);
      
      const newSession: Omit<AdventureSession, 'id'> = {
        userId,
        sessionType,
        adventureId,
        topicId,
        title: sessionTitle,
        
        // Initialize chat data
        chatMessages: [],
        totalChatMessages: 0,
        
        // Initialize question data
        mcqAnswers: [],
        totalQuestionsAnswered: 0,
        correctAnswers: 0,
        currentQuestionIndex: 0,
        
        // Initialize adventure state
        adventureMode,
        isInQuestionMode: false,
        adventurePromptCount: 0,
        
        // Timestamps
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        lastActivityAt: serverTimestamp() as Timestamp
      };

      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), newSession);
      console.log(`✅ Created adventure session: ${docRef.id} (${sessionType})`);
      return docRef.id;
    } catch (error) {
      console.warn('⚠️ Failed to create adventure session (continuing without Firebase):', error);
      return null; // Return null on failure, app continues normally
    }
  }

  // Add chat message (non-blocking)
  async addChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    if (!sessionId) return; // Graceful exit if no session

    try {
      const sessionRef = doc(db, this.COLLECTION_NAME, sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (sessionDoc.exists()) {
        const currentSession = sessionDoc.data() as AdventureSession;
        const updatedMessages = [...currentSession.chatMessages, message];
        
        await updateDoc(sessionRef, {
          chatMessages: updatedMessages,
          totalChatMessages: updatedMessages.length,
          updatedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp()
        });

        console.log(`💬 Saved message to session: ${message.type}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to save message to session (continuing normally):', error);
      // Don't throw error - app continues working without Firebase sync
    }
  }

  // Add MCQ answer (non-blocking)
  async addMCQAnswer(sessionId: string, mcqAnswer: MCQAnswer): Promise<void> {
    if (!sessionId) return; // Graceful exit if no session

    try {
      const sessionRef = doc(db, this.COLLECTION_NAME, sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (sessionDoc.exists()) {
        const currentSession = sessionDoc.data() as AdventureSession;
        const updatedAnswers = [...currentSession.mcqAnswers, mcqAnswer];
        const newCorrectCount = currentSession.correctAnswers + (mcqAnswer.isCorrect ? 1 : 0);
        
        await updateDoc(sessionRef, {
          mcqAnswers: updatedAnswers,
          totalQuestionsAnswered: updatedAnswers.length,
          correctAnswers: newCorrectCount,
          currentQuestionIndex: mcqAnswer.questionIndex || currentSession.currentQuestionIndex,
          updatedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp()
        });

        console.log(`✅ Saved MCQ answer to session: Q${mcqAnswer.questionId}, Correct: ${mcqAnswer.isCorrect}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to save MCQ answer to session (continuing normally):', error);
      // Don't throw error - app continues working without Firebase sync
    }
  }

  // Update adventure state (non-blocking)
  async updateAdventureState(
    sessionId: string, 
    updates: {
      isInQuestionMode?: boolean;
      adventurePromptCount?: number;
      currentQuestionIndex?: number;
    }
  ): Promise<void> {
    if (!sessionId) return; // Graceful exit if no session

    try {
      const sessionRef = doc(db, this.COLLECTION_NAME, sessionId);
      
      await updateDoc(sessionRef, {
        ...updates,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp()
      });

      console.log(`📊 Updated adventure state for session`);
    } catch (error) {
      console.warn('⚠️ Failed to update adventure state (continuing normally):', error);
      // Don't throw error - app continues working without Firebase sync
    }
  }

  // Simplified function to track MCQ answer from any component
  async trackMCQAnswer(
    sessionId: string | null,
    questionId: number,
    selectedAnswer: number,
    isCorrect: boolean,
    topicId: string,
    questionIndex?: number
  ): Promise<void> {
    if (!sessionId) {
      console.log('📝 No session ID - MCQ answer not tracked (app continues normally)');
      return;
    }

    const mcqAnswer: MCQAnswer = {
      questionId,
      selectedAnswer,
      isCorrect,
      timestamp: Date.now(),
      topicId,
      questionIndex
    };

    await this.addMCQAnswer(sessionId, mcqAnswer);
  }

  // Get user's recent adventure sessions
  async getUserAdventureSessions(userId: string, limitCount: number = 20): Promise<AdventureSession[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('lastActivityAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AdventureSession));
    } catch (error) {
      console.warn('⚠️ Failed to fetch user adventure sessions:', error);
      return []; // Return empty array on failure
    }
  }

  // Get specific adventure session
  async getAdventureSession(sessionId: string): Promise<AdventureSession | null> {
    try {
      const sessionDoc = await getDoc(doc(db, this.COLLECTION_NAME, sessionId));

      if (sessionDoc.exists()) {
        return {
          id: sessionId,
          ...sessionDoc.data()
        } as AdventureSession;
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Failed to fetch adventure session:', error);
      return null;
    }
  }

  // Generate session title based on type and mode
  private generateSessionTitle(
    sessionType: 'new_adventure' | 'continue_adventure' | 'continue_specific',
    adventureMode: 'new' | 'continue',
    topicId: string
  ): string {
    const topicLabel = topicId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    switch (sessionType) {
      case 'new_adventure':
        return `New Adventure: ${topicLabel}`;
      case 'continue_adventure':
        return `Continue Adventure: ${topicLabel}`;
      case 'continue_specific':
        return `Resume Adventure: ${topicLabel}`;
      default:
        return `Adventure Session: ${topicLabel}`;
    }
  }

  // Batch save current state (useful for periodic syncing)
  async syncCurrentState(
    sessionId: string, 
    messages: ChatMessage[],
    adventureState: {
      isInQuestionMode: boolean;
      adventurePromptCount: number;
    }
  ): Promise<void> {
    if (!sessionId) return;

    try {
      const sessionRef = doc(db, this.COLLECTION_NAME, sessionId);
      
      await updateDoc(sessionRef, {
        chatMessages: messages,
        totalChatMessages: messages.length,
        ...adventureState,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp()
      });

      console.log(`🔄 Synced current state to session`);
    } catch (error) {
      console.warn('⚠️ Failed to sync current state (continuing normally):', error);
    }
  }
}

export const adventureSessionService = new AdventureSessionService();
