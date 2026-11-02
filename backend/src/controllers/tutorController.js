import { findOwnedTopic } from '../services/aiContentService.js';
import { ragService } from '../services/rag/ragService.js';
import { tutorHistoryService } from '../services/rag/tutorHistoryService.js';

/**
 * Answers a question from the student's sources. With a topic, the answer also uses the topic's
 * recent conversation (so follow-ups work) and the question and answer are saved to it.
 */
export async function ask(request, response) {
  const userId = request.user.id;
  const { topicId, question, mode } = request.body;
  if (topicId) await findOwnedTopic(userId, topicId);
  const history = topicId ? await tutorHistoryService.recent(userId, topicId) : [];
  const result = await ragService.ask({ userId, ...request.body, history });
  const ids = topicId ? await tutorHistoryService.saveTurn(userId, topicId, { question, mode, answer: result }) : {};
  response.json({ success: true, data: { ...result, ...ids } });
}

export async function history(request, response) {
  const userId = request.user.id;
  const { topicId } = request.query;
  await findOwnedTopic(userId, topicId);
  response.json({ success: true, data: { messages: await tutorHistoryService.list(userId, topicId) } });
}

export async function clearHistory(request, response) {
  const userId = request.user.id;
  const { topicId } = request.query;
  await findOwnedTopic(userId, topicId);
  await tutorHistoryService.clear(userId, topicId);
  response.status(204).send();
}
