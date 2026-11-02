import { createTopic, deleteTopic } from '../services/topicService.js';

export async function create(request, response) {
  const topic = await createTopic(
    request.user.id,
    request.params.subjectId,
    request.body,
  );
  response.status(201).json({ success: true, data: { topic } });
}

export async function remove(request, response) {
  await deleteTopic(request.user.id, request.params.id);
  response.status(204).send();
}
