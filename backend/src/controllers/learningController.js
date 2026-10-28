import * as learning from '../services/learningService.js';
import { getOrGenerate } from '../services/aiContentService.js';
import { featureDefinitions } from '../services/ai/features.js';

const sourcesOf = ({ documentIds, resourceIds }) => ({ documentIds, resourceIds });

const typeFor = {
  notes: 'NOTES',
  flashcards: 'FLASHCARDS',
  quiz: 'QUIZ',
  mindmap: 'MINDMAP',
};

export const notes = {
  get: async (request, response) => response.json({ success: true, data: await learning.getNotes(request.user.id, request.params.topicId) }),
  generate: async (request, response) => response.json({ success: true, data: await learning.generateNotes(request.user.id, request.params.topicId, request.body.regenerate, sourcesOf(request.body)) }),
  save: async (request, response) => response.json({ success: true, data: { note: await learning.saveNote(request.user.id, request.params.topicId, request.body.content) } }),
};

export const flashcards = {
  list: async (request, response) => response.json({ success: true, data: { flashcards: await learning.listFlashcards(request.user.id, request.params.topicId) } }),
  generate: async (request, response) => response.json({ success: true, data: await learning.generateFlashcards(request.user.id, request.params.topicId, request.body.regenerate, sourcesOf(request.body)) }),
  create: async (request, response) => response.status(201).json({ success: true, data: { flashcard: await learning.createFlashcard(request.user.id, request.params.topicId, request.body) } }),
  update: async (request, response) => response.json({ success: true, data: { flashcard: await learning.updateFlashcard(request.user.id, request.params.id, request.body) } }),
  remove: async (request, response) => { await learning.deleteFlashcard(request.user.id, request.params.id); response.status(204).send(); },
  due: async (request, response) => response.json({ success: true, data: { flashcards: await learning.dueFlashcards(request.user.id, request.query.topicId, request.query.limit) } }),
  review: async (request, response) => response.json({ success: true, data: { review: await learning.reviewFlashcard(request.user.id, request.params.id, request.body.rating) } }),
};

export const recall = {
  summary: async (request, response) => response.json({ success: true, data: await learning.getRecallSummary(request.user.id) }),
};

export const quiz = {
  get: async (request, response) => response.json({ success: true, data: { quiz: await learning.getQuiz(request.user.id, request.params.topicId) } }),
  generate: async (request, response) => response.json({ success: true, data: { quiz: await learning.generateQuiz(request.user.id, request.params.topicId, request.body.regenerate, sourcesOf(request.body)) } }),
  submit: async (request, response) => response.json({ success: true, data: await learning.submitQuiz(request.user.id, request.params.topicId, request.body.answers) }),
};

export const mindmap = {
  get: async (request, response) => response.json({ success: true, data: { mindmap: await learning.getMindmap(request.user.id, request.params.topicId) } }),
  generate: async (request, response) => response.json({ success: true, data: { mindmap: await learning.generateMindmap(request.user.id, request.params.topicId, request.body.regenerate, sourcesOf(request.body)) } }),
};

export async function generate(request, response) {
  const type = typeFor[request.params.type];
  const content = await getOrGenerate({
    userId: request.user.id,
    topicId: request.params.topicId,
    type,
    regenerate: request.body.regenerate,
    sources: sourcesOf(request.body),
    feature: featureDefinitions[type],
  });
  response.json({ success: true, data: { content } });
}
