import * as resources from '../services/resourceService.js';

export async function list(request, response) {
  response.json({ success: true, data: { resources: await resources.listResources(request.user.id, request.query.topicId) } });
}

export async function get(request, response) {
  response.json({ success: true, data: { resource: await resources.getResource(request.user.id, request.params.id) } });
}

export async function createYoutube(request, response) {
  response.status(201).json({ success: true, data: { resource: await resources.createYoutubeResource(request.user.id, request.body) } });
}

export async function progress(request, response) {
  response.json({ success: true, data: { resource: await resources.updateProgress(request.user.id, request.params.id, request.body) } });
}

export async function remove(request, response) {
  await resources.deleteResource(request.user.id, request.params.id);
  response.status(204).send();
}
