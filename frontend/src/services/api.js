import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('study_planner_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  google: (credential) => api.post('/auth/google', { credential }),
  me: () => api.get('/auth/me'),
};

export const aiAPI = {
  usage: () => api.get('/ai/usage'),
};

export const motivationAPI = {
  today: () => api.get('/motivation/today'),
};

export const notesAPI = {
  get: (topicId) => api.get(`/topics/${topicId}/notes`),
  save: (topicId, payload) => api.put(`/topics/${topicId}/notes`, payload),
};

export const flashcardAPI = {
  dueCount: () => api.get('/flashcards/due/count'),
  list: (topicId) => api.get(`/topics/${topicId}/flashcards`),
  generate: (topicId, payload = {}) => api.post(`/topics/${topicId}/flashcards/generate`, payload),
  review: (id, payload) => api.post(`/flashcards/${id}/review`, payload),
};

export const recallAPI = {
  summary: () => api.get('/recall/summary'),
};

export const quizAPI = {
  get: (topicId) => api.get(`/topics/${topicId}/quiz`),
  generate: (topicId, payload = {}) => api.post(`/topics/${topicId}/quiz/generate`, payload),
  submit: (topicId, payload) => api.post(`/topics/${topicId}/quiz/submit`, payload),
  remove: (topicId) => api.delete(`/topics/${topicId}/quiz`),
};

export const mindmapAPI = {
  get: (topicId) => api.get(`/topics/${topicId}/mindmap`),
  generate: (topicId, payload = {}) => api.post(`/topics/${topicId}/mindmap/generate`, payload),
};

export const subjectAPI = {
  list: () => api.get('/subjects'),
  create: (payload) => api.post('/subjects', payload),
  update: (id, payload) => api.put(`/subjects/${id}`, payload),
  remove: (id) => api.delete(`/subjects/${id}`),
};

export const topicAPI = {
  create: (subjectId, payload) => api.post(`/subjects/${subjectId}/topics`, payload),
  remove: (id) => api.delete(`/topics/${id}`),
};

export const studySessionAPI = {
  complete: (id, payload = {}) => api.post(`/study-sessions/${id}/complete`, payload),
  skip: (id) => api.post(`/study-sessions/${id}/skip`),
};

export const resourceAPI = {
  get: (id) => api.get(`/resources/${id}`),
  addYoutube: (payload) => api.post('/resources/youtube', payload),
  progress: (id, payload) => api.patch(`/resources/${id}/progress`, payload),
  remove: (id) => api.delete(`/resources/${id}`),
};

export const documentAPI = {
  upload: (formData) => api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  createText: (payload) => api.post('/documents/text', payload),
  remove: (id) => api.delete(`/documents/${id}`),
};

export const hubAPI = {
  get: (topicId) => api.get(`/topics/${topicId}/hub`),
  studyNow: (topicId, payload = {}) => api.post(`/topics/${topicId}/study-now`, payload),
};

export const insightsAPI = {
  overview: () => api.get('/overview'),
};

export const tutorAPI = {
  ask: (payload) => api.post('/ai-tutor/ask', payload),
};

export default api;
