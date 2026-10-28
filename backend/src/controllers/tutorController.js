import { findOwnedTopic } from '../services/aiContentService.js';
import { ragService } from '../services/rag/ragService.js';

export async function ask(request, response) {
  const { topicId } = request.body;
  if (topicId) await findOwnedTopic(request.user.id, topicId);
  const result = await ragService.ask({ userId: request.user.id, ...request.body });
  response.json({ success: true, data: result });
}
