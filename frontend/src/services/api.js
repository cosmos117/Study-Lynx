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
  generate: (topicId, payload = {}) => api.post(`/topics/${topicId}/notes/generate`, payload),
  save: (topicId, payload) => api.put(`/topics/${topicId}/notes`, payload),
};

export const flashcardAPI = {
  list: (topicId) => api.get(`/topics/${topicId}/flashcards`),
  generate: (topicId, payload = {}) => api.post(`/topics/${topicId}/flashcards/generate`, payload),
  create: (topicId, payload) => api.post(`/topics/${topicId}/flashcards`, payload),
  update: (id, payload) => api.put(`/flashcards/${id}`, payload),
  remove: (id) => api.delete(`/flashcards/${id}`),
  review: (id, payload) => api.post(`/flashcards/${id}/review`, payload),
};

export const recallAPI = {
  summary: () => api.get('/recall/summary'),
};

export const quizAPI = {
  get: (topicId) => api.get(`/topics/${topicId}/quiz`),
  generate: (topicId, payload = {}) => api.post(`/topics/${topicId}/quiz/generate`, payload),
  submit: (topicId, payload) => api.post(`/topics/${topicId}/quiz/submit`, payload),
};

export const mindmapAPI = {
  get: (topicId) => api.get(`/topics/${topicId}/mindmap`),
  generate: (topicId, payload = {}) => api.post(`/topics/${topicId}/mindmap/generate`, payload),
};

export const examAPI = {
  list: (params) => api.get('/exams', { params }),
  create: (payload) => api.post('/exams', payload),
  get: (id) => api.get(`/exams/${id}`),
  update: (id, payload) => api.put(`/exams/${id}`, payload),
  remove: (id) => api.delete(`/exams/${id}`),
};

export const subjectAPI = {
  list: (examId, params) => api.get(`/exams/${examId}/subjects`, { params }),
  create: (examId, payload) => api.post(`/exams/${examId}/subjects`, payload),
  update: (id, payload) => api.put(`/subjects/${id}`, payload),
  remove: (id) => api.delete(`/subjects/${id}`),
};

export const topicAPI = {
  list: (subjectId, params) => api.get(`/subjects/${subjectId}/topics`, { params }),
  create: (subjectId, payload) => api.post(`/subjects/${subjectId}/topics`, payload),
  update: (id, payload) => api.put(`/topics/${id}`, payload),
  remove: (id) => api.delete(`/topics/${id}`),
};

export const studySessionAPI = {
  today: (date) => api.get('/study-sessions/today', { params: date ? { date } : {} }),
  create: (payload) => api.post('/study-sessions', payload),
  generate: (payload) => api.post('/study-sessions/generate', payload),
  update: (id, payload) => api.patch(`/study-sessions/${id}`, payload),
  start: (id) => api.post(`/study-sessions/${id}/start`),
  complete: (id, payload = {}) => api.post(`/study-sessions/${id}/complete`, payload),
  skip: (id) => api.post(`/study-sessions/${id}/skip`),
};

export const resourceAPI = {
  list: (topicId) => api.get('/resources', { params: topicId ? { topicId } : {} }),
  get: (id) => api.get(`/resources/${id}`),
  addYoutube: (payload) => api.post('/resources/youtube', payload),
  progress: (id, payload) => api.patch(`/resources/${id}/progress`, payload),
  remove: (id) => api.delete(`/resources/${id}`),
};

export const documentAPI = {
  list: (params = {}) => api.get('/documents', { params }),
  get: (id) => api.get(`/documents/${id}`),
  chunks: (id, params = {}) => api.get(`/documents/${id}/chunks`, { params }),
  upload: (formData) => api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  createText: (payload) => api.post('/documents/text', payload),
  attach: (id, topicId) => api.patch(`/documents/${id}/topic`, { topicId: topicId ? Number(topicId) : null }),
  remove: (id) => api.delete(`/documents/${id}`),
};

export const hubAPI = {
  get: (topicId) => api.get(`/topics/${topicId}/hub`),
  studyNow: (topicId, payload = {}) => api.post(`/topics/${topicId}/study-now`, payload),
};

export const insightsAPI = {
  overview: () => api.get('/overview'),
  analytics: (days) => api.get('/analytics', { params: { days } }),
};

export const tutorAPI = {
  ask: (payload) => api.post('/ai-tutor/ask', payload),
};

export default api;
