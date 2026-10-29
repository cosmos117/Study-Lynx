import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  learningResource: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
}));
vi.mock('../config/prisma.js', () => ({ default: db }));
vi.mock('./aiContentService.js', () => ({ findOwnedTopic: vi.fn().mockResolvedValue({ id: 3 }) }));

const resources = await import('./resourceService.js');

beforeEach(() => {
  vi.clearAllMocks();
  // No network in tests: the title lookup fails and falls back to a default title.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

describe('extractYoutubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=KWkm1Gip4j4&pp=ygUEZGJtcw%3D%3D', 'KWkm1Gip4j4'],
    ['https://youtu.be/KWkm1Gip4j4?si=abc123', 'KWkm1Gip4j4'],
    ['https://m.youtube.com/watch?v=KWkm1Gip4j4', 'KWkm1Gip4j4'],
    ['https://www.youtube.com/shorts/KWkm1Gip4j4', 'KWkm1Gip4j4'],
    ['https://www.youtube.com/embed/KWkm1Gip4j4', 'KWkm1Gip4j4'],
  ])('reads the video id from %s', (url, id) => {
    expect(resources.extractYoutubeVideoId(url)).toBe(id);
  });

  it.each(['https://vimeo.com/123', 'not a url', 'https://www.youtube.com/watch'])('rejects %s', (url) => {
    expect(() => resources.extractYoutubeVideoId(url)).toThrow(/valid YouTube/);
  });
});

describe('YouTube resources', () => {
  it('saves the video id so the player can embed it', async () => {
    db.learningResource.create.mockResolvedValue({});
    await resources.createYoutubeResource(7, { topicId: 3, url: 'https://www.youtube.com/watch?v=KWkm1Gip4j4&pp=x' });
    expect(db.learningResource.create.mock.calls[0][0].data).toMatchObject({ youtubeVideoId: 'KWkm1Gip4j4', userId: 7, topicId: 3 });
  });

  it('recovers the id from the URL for videos saved without one', async () => {
    db.learningResource.findFirst.mockResolvedValue({ id: 1, url: 'https://www.youtube.com/watch?v=KWkm1Gip4j4', youtubeVideoId: null });
    expect((await resources.getResource(7, 1)).youtubeVideoId).toBe('KWkm1Gip4j4');

    db.learningResource.findMany.mockResolvedValue([{ id: 1, url: 'https://youtu.be/abcdefghijk', youtubeVideoId: null }]);
    expect((await resources.listResources(7))[0].youtubeVideoId).toBe('abcdefghijk');
  });

  it('keeps a stored id as it is', async () => {
    db.learningResource.findFirst.mockResolvedValue({ id: 1, url: 'https://youtu.be/other', youtubeVideoId: 'KWkm1Gip4j4' });
    expect((await resources.getResource(7, 1)).youtubeVideoId).toBe('KWkm1Gip4j4');
  });

  it('only finds the signed-in user\'s videos', async () => {
    db.learningResource.findFirst.mockResolvedValue(null);
    await expect(resources.getResource(7, 99)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.learningResource.findFirst.mock.calls[0][0].where).toEqual({ id: 99, userId: 7 });
  });
});

describe('watch progress', () => {
  const saved = (watchedPercent, completedAt = null) => ({ id: 1, url: 'https://youtu.be/abcdefghijk', youtubeVideoId: 'abcdefghijk', watchedPercent, completedAt, startedAt: null });
  const sent = () => db.learningResource.update.mock.calls[0][0].data;

  beforeEach(() => {
    db.learningResource.update.mockImplementation(async ({ data }) => ({ ...saved(0), ...data }));
  });

  it('moves forward as more is watched', async () => {
    db.learningResource.findFirst.mockResolvedValue(saved(20));
    await resources.updateProgress(7, 1, { watchedPercent: 45 });
    expect(sent()).toMatchObject({ watchedPercent: 45, completedAt: null });
  });

  it('never goes back when the student rewinds', async () => {
    db.learningResource.findFirst.mockResolvedValue(saved(60));
    await resources.updateProgress(7, 1, { watchedPercent: 10 });
    expect(sent().watchedPercent).toBe(60);
  });

  it('counts 90% as finished, and marking as watched sets 100%', async () => {
    db.learningResource.findFirst.mockResolvedValue(saved(80));
    await resources.updateProgress(7, 1, { watchedPercent: 92 });
    expect(sent().completedAt).toBeInstanceOf(Date);

    vi.clearAllMocks();
    db.learningResource.findFirst.mockResolvedValue(saved(30));
    await resources.updateProgress(7, 1, { watchedPercent: 30, completed: true });
    expect(sent()).toMatchObject({ watchedPercent: 100 });
  });

  it('saves where playback stopped, even when that is earlier than before', async () => {
    db.learningResource.findFirst.mockResolvedValue({ ...saved(60), positionSeconds: 2400 });
    await resources.updateProgress(7, 1, { watchedPercent: 60, positionSeconds: 300 });
    expect(sent()).toMatchObject({ watchedPercent: 60, positionSeconds: 300 });
  });

  it('leaves the saved position alone when none is sent', async () => {
    db.learningResource.findFirst.mockResolvedValue(saved(40));
    await resources.updateProgress(7, 1, { watchedPercent: 40, completed: true });
    expect(sent()).not.toHaveProperty('positionSeconds');
  });

  it('keeps a finished video finished', async () => {
    const finishedAt = new Date('2026-10-01');
    db.learningResource.findFirst.mockResolvedValue(saved(95, finishedAt));
    await resources.updateProgress(7, 1, { watchedPercent: 5 });
    expect(sent()).toMatchObject({ watchedPercent: 95, completedAt: finishedAt });
  });
});
