import prisma from '../config/prisma.js';
import { env } from '../config/env.js';
import { aiService } from './ai/aiService.js';
import { AiError } from './ai/errors.js';
import { materialContextService } from './rag/materialContextService.js';

const types = new Set(['NOTES', 'FLASHCARDS', 'QUIZ', 'MINDMAP']);

export async function findOwnedTopic(userId, topicId) {
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, subject: { exam: { userId } } },
    include: { subject: { include: { exam: true } } },
  });
  if (!topic) {
    const error = new Error('Topic not found');
    error.statusCode = 404;
    throw error;
  }
  return topic;
}

function contextFor(topic, userNotes = '', material = null) {
  const trimmedNotes = userNotes.slice(0, env.ai.inputMaxChars);
  return {
    examName: topic.subject.exam.name,
    subjectName: topic.subject.name,
    topicName: topic.name,
    topicDifficulty: topic.difficulty,
    userNotes: trimmedNotes || null,
    material,
    mode: material ? 'from_material' : trimmedNotes ? 'from_notes' : 'from_topic',
  };
}

/**
 * Returns the cached AI content for a topic, generating it when missing.
 * `sources` ({ documentIds, resourceIds }) grounds the generation in the student's own
 * materials; choosing sources always regenerates, since the cached copy was not based on them.
 */
export async function getOrGenerate({ userId, topicId, type, regenerate = false, feature, sources = {} }) {
  if (!types.has(type)) throw new Error('Unsupported AI content type');
  const topic = await findOwnedTopic(userId, topicId);
  const material = await materialContextService.build(userId, { ...sources, topicName: topic.name });
  if (material) regenerate = true;
  const existing = await prisma.aiContent.findUnique({
    where: { userId_topicId_type: { userId, topicId, type } },
  });
  const lockAge = Date.now() - (existing?.lockedAt?.getTime() || 0);

  if (existing?.status === 'READY' && !regenerate) return existing;
  if (existing?.status === 'GENERATING' && lockAge < env.ai.lockTimeoutSeconds * 1000) {
    throw new AiError('AI_BUSY', 'Generation is already in progress');
  }

  let lock = existing;
  const now = new Date();
  const staleBefore = new Date(now.getTime() - env.ai.lockTimeoutSeconds * 1000);
  if (!lock) {
    try {
      lock = await prisma.aiContent.create({
        data: {
          userId, topicId, type, status: 'GENERATING', lockedAt: now, promptVersion: feature.promptVersion,
        },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
      throw new AiError('AI_BUSY', 'Generation is already in progress');
    }
  } else {
    const claimed = await prisma.aiContent.updateMany({
      where: {
        id: lock.id,
        OR: [
          { status: { not: 'GENERATING' } },
          { status: 'GENERATING', lockedAt: { lt: staleBefore } },
          { status: 'GENERATING', lockedAt: null },
        ],
      },
      data: { status: 'GENERATING', lockedAt: now, errorCode: null, promptVersion: feature.promptVersion },
    });
    if (claimed.count !== 1) throw new AiError('AI_BUSY', 'Generation is already in progress');
    lock = await prisma.aiContent.findUnique({ where: { id: lock.id } });
  }

  try {
    const savedNote = await prisma.note.findUnique({ where: { userId_topicId: { userId, topicId } } });
    const context = contextFor(topic, savedNote?.content || '', material);
    const result = await aiService.generateStructured({
      feature: type,
      system: feature.system,
      user: feature.buildPrompt(context),
      schema: feature.schema,
      userId,
    });
    return await prisma.aiContent.update({
      where: { id: lock.id },
      data: {
        status: 'READY',
        content: result.data,
        provider: result.provider,
        model: result.model,
        lockedAt: null,
        errorCode: null,
      },
    });
  } catch (error) {
    await prisma.aiContent.update({
      where: { id: lock.id },
      data: {
        status: 'FAILED',
        lockedAt: null,
        errorCode: error.code || 'AI_PROVIDER_UNAVAILABLE',
        ...(existing?.status === 'READY' ? { content: existing.content, status: 'READY' } : {}),
      },
    });
    throw error;
  }
}
