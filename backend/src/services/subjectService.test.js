import { beforeEach, describe, expect, it, vi } from 'vitest';

// Every query is answered by these mocks, so the tests never touch a real database.
const db = vi.hoisted(() => ({
  subject: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  topic: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('../config/prisma.js', () => ({ default: db }));

const subjects = await import('./subjectService.js');
const topics = await import('./topicService.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subjects belong to one user', () => {
  it('creates a subject owned by the signed-in user', async () => {
    db.subject.create.mockResolvedValue({ id: 1 });
    await subjects.createSubject(7, { name: 'Databases', examDate: null });
    expect(db.subject.create.mock.calls[0][0].data).toEqual({ name: 'Databases', examDate: null, userId: 7 });
  });

  it("lists only the user's own subjects, with their topics", async () => {
    db.subject.findMany.mockResolvedValue([]);
    await subjects.listSubjects(7);
    const args = db.subject.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ userId: 7 });
    expect(args.include.topics).toBeTruthy();
  });

  it.each([
    ['update', () => subjects.updateSubject(7, 99, { name: 'X' }), () => db.subject.update],
    ['delete', () => subjects.deleteSubject(7, 99), () => db.subject.delete],
  ])("refuses to %s another user's subject", async (_name, run, write) => {
    db.subject.findFirst.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({ statusCode: 404 });
    expect(db.subject.findFirst.mock.calls[0][0].where).toEqual({ id: 99, userId: 7 });
    expect(write()).not.toHaveBeenCalled();
  });
});

describe('topics are reached through an owned subject', () => {
  it("refuses to add a topic to another user's subject", async () => {
    db.subject.findFirst.mockResolvedValue(null);
    await expect(topics.createTopic(7, 99, { name: 'Joins' })).rejects.toMatchObject({ statusCode: 404 });
    expect(db.subject.findFirst.mock.calls[0][0].where).toEqual({ id: 99, userId: 7 });
    expect(db.topic.create).not.toHaveBeenCalled();
  });

  it.each([
    ['update', () => topics.updateTopic(7, 5, { name: 'X' }), () => db.topic.update],
    ['delete', () => topics.deleteTopic(7, 5), () => db.topic.delete],
  ])("refuses to %s a topic in another user's subject", async (_name, run, write) => {
    db.topic.findFirst.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({ statusCode: 404 });
    expect(db.topic.findFirst.mock.calls[0][0].where).toEqual({ id: 5, subject: { userId: 7 } });
    expect(write()).not.toHaveBeenCalled();
  });
});
