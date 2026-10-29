import {
  createSubject,
  deleteSubject,
  listSubjects,
  updateSubject,
} from '../services/subjectService.js';

export async function create(request, response) {
  const subject = await createSubject(request.user.id, request.body);
  response.status(201).json({ success: true, data: { subject } });
}

export async function list(request, response) {
  const subjects = await listSubjects(request.user.id);
  response.json({ success: true, data: { subjects } });
}

export async function update(request, response) {
  const subject = await updateSubject(request.user.id, request.params.id, request.body);
  response.json({ success: true, data: { subject } });
}

export async function remove(request, response) {
  await deleteSubject(request.user.id, request.params.id);
  response.status(204).send();
}
