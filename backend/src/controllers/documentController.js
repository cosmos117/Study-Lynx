import { createHttpError } from '../utils/httpError.js';
import { documentIngestionService as documents } from '../services/rag/documentIngestionService.js';

// Multer reads multipart filenames as latin1; recover the UTF-8 original.
const decodeFileName = (name) => Buffer.from(String(name || ''), 'latin1').toString('utf-8');

export async function upload(request, response) {
  const { file } = request;
  if (!file) throw createHttpError(400, 'No file uploaded');
  const document = await documents.ingestFile({
    userId: request.user.id,
    topicId: request.body.topicId,
    name: request.body.name || decodeFileName(file.originalname),
    mimeType: file.mimetype,
    buffer: file.buffer,
    size: file.size,
  });
  response.status(202).json({ success: true, data: { document } });
}

export async function createText(request, response) {
  const document = await documents.ingestText({ userId: request.user.id, ...request.body });
  response.status(202).json({ success: true, data: { document } });
}

export async function list(request, response) {
  const data = await documents.listDocuments(request.user.id, request.query);
  response.json({ success: true, data: { documents: data } });
}

export async function get(request, response) {
  const document = await documents.getDocument(request.user.id, request.params.id);
  response.json({ success: true, data: { document } });
}

export async function chunks(request, response) {
  const data = await documents.listChunks(request.user.id, request.params.id, request.query);
  response.json({ success: true, data: { chunks: data } });
}

export async function remove(request, response) {
  await documents.deleteDocument(request.user.id, request.params.id);
  response.status(204).send();
}

export async function attach(request, response) {
  const document = await documents.attachToTopic(request.user.id, request.params.id, request.body.topicId);
  response.json({ success: true, data: { document } });
}
