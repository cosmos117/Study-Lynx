import {
  createExam,
  deleteExam,
  getExam,
  listExams,
  updateExam,
} from '../services/examService.js';

export async function create(request, response) {
  const exam = await createExam(request.user.id, request.body);
  response.status(201).json({ success: true, data: { exam } });
}

export async function list(request, response) {
  const data = await listExams(request.user.id, request.query);
  response.json({ success: true, data });
}

export async function get(request, response) {
  const exam = await getExam(request.user.id, request.params.id);
  response.json({ success: true, data: { exam } });
}

export async function update(request, response) {
  const exam = await updateExam(request.user.id, request.params.id, request.body);
  response.json({ success: true, data: { exam } });
}

export async function remove(request, response) {
  await deleteExam(request.user.id, request.params.id);
  response.status(204).send();
}
