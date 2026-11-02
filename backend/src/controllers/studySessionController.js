import * as studySessions from '../services/studySessionService.js';

export async function complete(request, response) {
  response.json({ success: true, data: { session: await studySessions.completeSession(request.user.id, request.params.id, request.body.actualDuration) } });
}

export async function skip(request, response) {
  response.json({ success: true, data: { session: await studySessions.skipSession(request.user.id, request.params.id) } });
}

