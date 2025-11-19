import type { MCQData } from "../data/mcq-questions";

export function getUnprefilledPairs(
  data: MCQData
): Array<{ topicId: string; questionId: number | string }> {
  const pairs: Array<{ topicId: string; questionId: number | string }> = [];
  for (const [topicId, topic] of Object.entries(data.topics)) {
    for (const q of topic.questions ?? []) {
      const anyQuestion = q as any;
      const hasPrefilledArray =
        Array.isArray(anyQuestion?.prefilledIndexes) &&
        anyQuestion.prefilledIndexes.length > 0;
      const isExplicitlyFalse = anyQuestion?.isPrefilled === false;

      if (isExplicitlyFalse && hasPrefilledArray) {
        pairs.push({ topicId, questionId: anyQuestion.id });
      }
    }
  }
  return pairs;
}


