import { topicHubService } from '../services/topicHubService.js';
import { studyNow } from '../services/studySessionService.js';

export async function getHub(request, response) {
  response.json({ success: true, data: await topicHubService.getHub(request.user.id, request.params.topicId) });
}

export async function startStudying(request, response) {
  response.json({ success: true, data: { session: await studyNow(request.user.id, request.params.topicId, request.body) } });
}
