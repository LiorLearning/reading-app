import { sampleMCQData } from '@/data/mcq-questions';
import { getNextTopicByPreference } from '@/lib/utils';
import { setSpellboxAnchorForLevel } from '@/lib/questionBankUtils';

export interface AssignmentSwitchDeps {
  currentGradeDisplayName?: string | null;
  updateUserData: (data: Partial<any>) => Promise<void> | void;
  handleStartAdventure?: (topicId: string, mode?: 'new' | 'continue') => void;
  onNextTopic?: (nextTopicId: string) => void;
  // Decision inputs
  isCorrect?: boolean;              // this attempt correct?
  questionId?: number;              // 1-based id within assignment
  isLastQuestion?: boolean;         // is this the final question of assignment?
  // hadAnyIncorrect?: boolean;     // no longer needed; if an incorrect happened earlier,
                                    // grade would have switched away from assignment already
}

/**
 * Shared handler: On first incorrect attempt while on Assignment grade, switch to Grade 2 Start.
 * - Persists grade to Firebase via updateUserData
 * - Navigates to a Grade 2 start topic via handleStartAdventure (preferred) or onNextTopic
 * - Returns true if a switch was performed (caller should early-return)
 */
export async function handleFirstIncorrectAssignment(
  isFirstDecision: boolean,
  deps: AssignmentSwitchDeps
): Promise<boolean> {
  try {
    const grade = (deps.currentGradeDisplayName || '').toLowerCase();
    const isCorrect = deps.isCorrect ?? false;
    const questionId = typeof deps.questionId === 'number' ? (deps.questionId as number) : 1;
    const isLast = !!deps.isLastQuestion;

    if (!isFirstDecision || grade !== 'assignment') return false;

    // Tiers mapping 1..8
    const TIERS = [
      { gdn: 'Kindergarten', grade: 'gradeK', level: 'start' as const, ldn: 'Start Level' as const, pref: 'start' as const }, // 1
      { gdn: 'Kindergarten', grade: 'gradeK', level: 'mid'   as const, ldn: 'Mid Level'   as const, pref: 'middle' as const }, // 2
      { gdn: '1st Grade',    grade: 'grade1', level: 'start' as const, ldn: 'Start Level' as const, pref: 'start' as const }, // 3
      { gdn: '1st Grade',    grade: 'grade1', level: 'mid'   as const, ldn: 'Mid Level'   as const, pref: 'middle' as const }, // 4
      { gdn: '2nd Grade',    grade: 'grade2', level: 'start' as const, ldn: 'Start Level' as const, pref: 'start' as const }, // 5
      { gdn: '2nd Grade',    grade: 'grade2', level: 'mid'   as const, ldn: 'Mid Level'   as const, pref: 'middle' as const }, // 6
      { gdn: '3rd Grade',    grade: 'grade3', level: 'start' as const, ldn: 'Start Level' as const, pref: 'start' as const }, // 7
      { gdn: '3rd Grade',    grade: 'grade3', level: 'mid'   as const, ldn: 'Mid Level'   as const, pref: 'middle' as const }, // 8
    ];

    const clampTierIndex = (qid: number): number => {
      // Simple integer clamp 1..8 without floor/ceil
      if (qid < 1) return 1;
      if (qid > 8) return 8;
      return qid;
    };

    let targetTierIdx: number | null = null; // 1..8

    if (!isCorrect) {
      // Immediate: incorrect switches to previous tier by question id (clamped)
      const currentTier = clampTierIndex(questionId);
      targetTierIdx = Math.max(1, currentTier - 1);
    } else if (isLast) {
      // End: all-correct assignment ⇒ highest tier (3 Mid)
      targetTierIdx = 8;
    } else {
      // No-op for intermediate correct answers
      return false;
    }

    const tier = TIERS[(targetTierIdx - 1) as number];

    try {
      await deps.updateUserData({
        grade: tier.grade,
        gradeDisplayName: tier.gdn,
        level: tier.level,
        levelDisplayName: tier.ldn,
      } as any);
    } catch (e) {
      console.warn('Failed to persist grade switch', e);
    }

    // Reposition SpellBox to the corresponding Start/Middle anchor and reset ONLY that topic
    try {
      // Note: we do not have userId here; the hybrid saver in setSpellboxAnchorForLevel will persist locally
      await setSpellboxAnchorForLevel(tier.gdn, tier.pref);
    } catch (anchorErr) {
      console.warn('Failed to set SpellBox anchor after assignment switch:', anchorErr);
    }

    const allTopicIds = Object.keys(sampleMCQData.topics);
    const nextTopic = getNextTopicByPreference(allTopicIds, tier.pref, tier.gdn) || null;

    if (nextTopic) {
      if (deps.handleStartAdventure) {
        deps.handleStartAdventure(nextTopic, 'new');
      } else if (deps.onNextTopic) {
        deps.onNextTopic(nextTopic);
      }
    }

    return true;
  } catch {
    return false;
  }
}


