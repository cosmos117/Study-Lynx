import prisma from '../../config/prisma.js';

// Enough to scroll back through a study session; older messages stay saved but aren't loaded.
const HISTORY_LIMIT = 60;
// How many earlier messages the model sees when answering a follow-up.
const CONTEXT_MESSAGES = 6;

/**
 * Saved Ask AI conversations, one per topic. Callers check that the topic belongs to the user;
 * every query here is also scoped to the user.
 */
export function createTutorHistoryService({ db = prisma } = {}) {
  /** The conversation, oldest first. */
  async function list(userId, topicId, limit = HISTORY_LIMIT) {
    const rows = await db.tutorMessage.findMany({
      where: { userId, topicId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.reverse().map(({ id, role, content, data, createdAt }) => ({ id, role, content, ...(data || {}), createdAt }));
  }

  /** The last few messages, for answering follow-ups. */
  async function recent(userId, topicId) {
    const messages = await list(userId, topicId, CONTEXT_MESSAGES);
    return messages.map(({ role, content }) => ({ role, content }));
  }

  /** Saves a question and its answer together, so the conversation never has half a turn. */
  async function saveTurn(userId, topicId, { question, mode, answer }) {
    const { answer: answerText, ...details } = answer;
    const now = Date.now();
    const [asked, answered] = await db.$transaction([
      db.tutorMessage.create({ data: { userId, topicId, role: 'user', content: question, data: { mode }, createdAt: new Date(now) } }),
      // A millisecond later, so the answer always sorts after its question.
      db.tutorMessage.create({ data: { userId, topicId, role: 'assistant', content: answerText, data: details, createdAt: new Date(now + 1) } }),
    ]);
    return { questionId: asked.id, answerId: answered.id };
  }

  async function clear(userId, topicId) {
    const { count } = await db.tutorMessage.deleteMany({ where: { userId, topicId } });
    return count;
  }

  return { list, recent, saveTurn, clear };
}

export const tutorHistoryService = createTutorHistoryService();
