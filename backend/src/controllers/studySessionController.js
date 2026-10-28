import * as studySessions from '../services/studySessionService.js';

export async function listToday(request, response) {
  const date = request.query.date || new Date();
  response.json({ success: true, data: { sessions: await studySessions.listSessions(request.user.id, new Date(date), null) } });
}

export async function listRange(request, response) {
  response.json({ success: true, data: { sessions: await studySessions.listSessionsByRange(request.user.id, request.query.from, request.query.to) } });
}

export async function create(request, response) {
  response.status(201).json({ success: true, data: { session: await studySessions.createSession(request.user.id, request.body) } });
}

export async function update(request, response) {
  response.json({ success: true, data: { session: await studySessions.updateSession(request.user.id, request.params.id, request.body) } });
}

export async function start(request, response) {
  response.json({ success: true, data: { session: await studySessions.startSession(request.user.id, request.params.id) } });
}

export async function complete(request, response) {
  response.json({ success: true, data: { session: await studySessions.completeSession(request.user.id, request.params.id, request.body.actualDuration) } });
}

export async function skip(request, response) {
  response.json({ success: true, data: { session: await studySessions.skipSession(request.user.id, request.params.id) } });
}

export async function generate(request, response) {
  response.status(201).json({ success: true, data: { sessions: await studySessions.generatePlan(request.user.id, request.body) } });
}
