import { describe, expect, it } from 'vitest';
import { createPrismaUsageStore } from './limits.js';

/** Fake Prisma with the two behaviours that matter: callback transactions, and a NULL-user shared row. */
function createFakePrisma() {
  const rows = [];
  let id = 0;
  const aiUsage = {
    upsert: async ({ where, create, update }) => {
      const key = where.userId_date_feature;
      const row = rows.find((r) => r.userId === key.userId && +r.date === +key.date && r.feature === key.feature);
      if (row) row.count += update.count.increment; else rows.push({ id: (id += 1), ...create });
    },
    findFirst: async ({ where }) => rows.find((r) => r.userId === (where.userId ?? null) && +r.date === +where.date) || null,
    findUnique: async ({ where }) => {
      const key = where.userId_date_feature;
      return rows.find((r) => r.userId === key.userId && +r.date === +key.date) || null;
    },
    update: async ({ where, data }) => { rows.find((r) => r.id === where.id).count += data.count.increment; },
    create: async ({ data }) => { rows.push({ id: (id += 1), userId: null, ...data }); },
  };
  return {
    rows,
    aiUsage,
    // Prisma rejects an array containing anything but its own query promises, so only accept the callback form.
    $transaction: async (work) => {
      if (typeof work !== 'function') throw new Error('All elements of the array need to be Prisma Client promises.');
      return work({ aiUsage });
    },
  };
}

describe('createPrismaUsageStore.increment', () => {
  it('counts the user and the shared total in one transaction', async () => {
    const prisma = createFakePrisma();
    const store = createPrismaUsageStore(prisma);

    await store.increment(7);
    await store.increment(7);
    await store.increment(8);

    expect(await store.getUserCount(7)).toBe(2);
    expect(await store.getUserCount(8)).toBe(1);
    expect(await store.getGlobalCount()).toBe(3);
    expect(prisma.rows.filter((row) => row.userId === null)).toHaveLength(1);
  });
});

describe('shared daily quota day', async () => {
  const { createMemoryUsageStore, quotaDayKey } = await import('./limits.js');

  it("follows Google's Pacific-time day, not UTC", () => {
    // 05:00 UTC on 2 Nov is still 1 Nov in California (UTC-7/-8).
    expect(quotaDayKey(new Date('2026-11-02T05:00:00Z'))).toBe('2026-11-01');
    expect(quotaDayKey(new Date('2026-11-02T09:00:00Z'))).toBe('2026-11-02');
  });

  it('counts the shared total per Pacific day, while each student keeps a UTC day', async () => {
    const store = createMemoryUsageStore({ quotaTimeZone: 'America/Los_Angeles' });
    await store.increment(1, new Date('2026-11-02T01:00:00Z')); // UTC 2 Nov, Pacific 1 Nov
    await store.increment(1, new Date('2026-11-02T06:00:00Z')); // UTC 2 Nov, Pacific 1 Nov
    await store.increment(1, new Date('2026-11-02T10:00:00Z')); // UTC 2 Nov, Pacific 2 Nov
    expect(await store.getGlobalCount(new Date('2026-11-02T06:30:00Z'))).toBe(2);
    expect(await store.getGlobalCount(new Date('2026-11-02T10:30:00Z'))).toBe(1);
    expect(await store.getUserCount(1, new Date('2026-11-02T12:00:00Z'))).toBe(3);
  });
});
