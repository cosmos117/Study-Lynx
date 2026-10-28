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
      userId, topicId: data.topicId, type: 'YOUTUBE', url: data.url,
      title: data.title || metadata?.title || 'YouTube learning resource',
      transcript: data.transcript || null,
      metadata: metadata || undefined,
    },
    include: includeResource,
  });
}

export async function listResources(userId, topicId) {
  if (topicId) await findOwnedTopic(userId, topicId);
  return prisma.learningResource.findMany({
    where: { userId, ...(topicId ? { topicId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: includeResource,
  });
}

export async function getResource(userId, id) {
  const resource = await prisma.learningResource.findFirst({ where: { id, userId }, include: includeResource });
  if (!resource) throw createHttpError(404, 'Learning resource not found');
  return resource;
}

export async function updateProgress(userId, id, data) {
  const resource = await getResource(userId, id);
  const completed = data.completed || data.watchedPercent >= 90;
  return prisma.learningResource.update({
    where: { id: resource.id },
    data: {
      watchedPercent: data.watchedPercent,
      startedAt: resource.startedAt || new Date(),
      completedAt: completed ? (resource.completedAt || new Date()) : null,
    },
    include: includeResource,
  });
}

export async function deleteResource(userId, id) {
  await getResource(userId, id);
  await prisma.learningResource.delete({ where: { id } });
}
