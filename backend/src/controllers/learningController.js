import * as learning from '../services/learningService.js';

const sourcesOf = ({ documentIds, resourceIds }) => ({ documentIds, resourceIds });

export const notes = {
  get: async (request, response) => response.json({ success: true, data: await learning.getNotes(request.user.id, request.params.topicId) }),
  save: async (request, response) => response.json({ success: true, data: { note: await learning.saveNote(request.user.id, request.params.topicId, request.body.content) } }),
};

export const flashcards = {
  list: async (request, response) => response.json({ success: true, data: { flashcards: await learning.listFlashcards(request.user.id, request.params.topicId) } }),
  generate: async (request, response) => response.json({ success: true, data: await learning.generateFlashcards(request.user.id, request.params.topicId, request.body.regenerate, sourcesOf(request.body)) }),
  dueCount: async (request, response) => response.json({ success: true, data: { count: await learning.countDueFlashcards(request.user.id) } }),
  review: async (request, response) => response.json({ success: true, data: { review: await learning.reviewFlashcard(request.user.id, request.params.id, request.body.rating) } }),
};

export const recall = {
  summary: async (request, response) => response.json({ success: true, data: await learning.getRecallSummary(request.user.id) }),
};

export const quiz = {
  get: async (request, response) => response.json({ success: true, data: await learning.getQuizWithAttempt(request.user.id, request.params.topicId) }),
  generate: async (request, response) => response.json({ success: true, data: { quiz: await learning.generateQuiz(request.user.id, request.params.topicId, request.body.regenerate, sourcesOf(request.body), request.body.quizType) } }),
  submit: async (request, response) => response.json({ success: true, data: await learning.submitQuiz(request.user.id, request.params.topicId, request.body.answers) }),
  remove: async (request, response) => {
    await learning.deleteQuiz(request.user.id, request.params.topicId);
    response.status(204).send();
  },
};

export const mindmap = {
  get: async (request, response) => response.json({ success: true, data: { mindmap: await learning.getMindmap(request.user.id, request.params.topicId) } }),
  generate: async (request, response) => response.json({ success: true, data: { mindmap: await learning.generateMindmap(request.user.id, request.params.topicId, request.body.regenerate, sourcesOf(request.body)) } }),
};

