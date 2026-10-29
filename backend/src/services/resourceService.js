import prisma from '../config/prisma.js';
import { createHttpError } from '../utils/httpError.js';
import { findOwnedTopic } from './aiContentService.js';

const youtubeIdFromUrl = (value) => {
  let url;
  try { url = new URL(value); } catch { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null;
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v');
    if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || null;
    if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || null;
  }
  return null;
};

async function youtubeMetadata(videoId) {
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`);
    if (!response.ok) return null;
    const data = await response.json();
    return { title: data.title, authorName: data.author_name, authorUrl: data.author_url, thumbnailUrl: data.thumbnail_url, provider: data.provider_name };
  } catch {
    return null;
  }
}

const includeResource = {
  topic: { select: { id: true, name: true, subject: { select: { id: true, name: true } } } },
};

// Videos added before the ID was saved have none stored; it can always be recovered from the URL.
const withVideoId = (resource) => (resource.youtubeVideoId
  ? resource
  : { ...resource, youtubeVideoId: youtubeIdFromUrl(resource.url) });

export function extractYoutubeVideoId(url) {
  const videoId = youtubeIdFromUrl(url);
  if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) throw createHttpError(400, 'Enter a valid YouTube video URL');
  return videoId;
}

export async function createYoutubeResource(userId, data) {
  await findOwnedTopic(userId, data.topicId);
  const youtubeVideoId = extractYoutubeVideoId(data.url);
  const metadata = await youtubeMetadata(youtubeVideoId);
  return prisma.learningResource.create({
    data: {
      userId, topicId: data.topicId, type: 'YOUTUBE', url: data.url, youtubeVideoId,
      title: data.title || metadata?.title || 'YouTube learning resource',
      transcript: data.transcript || null,
      metadata: metadata || undefined,
    },
    include: includeResource,
  });
}

export async function listResources(userId, topicId) {
  if (topicId) await findOwnedTopic(userId, topicId);
  const resources = await prisma.learningResource.findMany({
    where: { userId, ...(topicId ? { topicId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: includeResource,
  });
  return resources.map(withVideoId);
}

export async function getResource(userId, id) {
  const resource = await prisma.learningResource.findFirst({ where: { id, userId }, include: includeResource });
  if (!resource) throw createHttpError(404, 'Learning resource not found');
  return withVideoId(resource);
}

// Watching 90% counts as finished, so skipping the outro or credits still completes a video.
const COMPLETE_AT_PERCENT = 90;

/**
 * Records how far into a video the student has got. Progress only ever moves forward, so
 * rewinding to rewatch a part never lowers it, and a finished video stays finished.
 */
export async function updateProgress(userId, id, data) {
  const resource = await getResource(userId, id);
  const watchedPercent = data.completed ? 100 : Math.max(resource.watchedPercent || 0, data.watchedPercent);
  const completed = Boolean(resource.completedAt) || data.completed || watchedPercent >= COMPLETE_AT_PERCENT;
  const updated = await prisma.learningResource.update({
    where: { id: resource.id },
    data: {
      watchedPercent,
      // Unlike the percentage, the position follows the student back when they rewind.
      ...(data.positionSeconds !== undefined ? { positionSeconds: data.positionSeconds } : {}),
      startedAt: resource.startedAt || new Date(),
      completedAt: completed ? (resource.completedAt || new Date()) : null,
    },
    include: includeResource,
  });
  return withVideoId(updated);
}

export async function deleteResource(userId, id) {
  await getResource(userId, id);
  await prisma.learningResource.delete({ where: { id } });
}
