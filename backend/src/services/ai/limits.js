import { AiLimitError } from './errors.js';

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function createMemoryUsageStore() {
  const entries = new Map();

  return {
    async getUserCount(userId, date = new Date()) {
      return entries.get(`${userId}:${utcDateKey(date)}`) || 0;
    },
    async getGlobalCount(date = new Date()) {
      return entries.get(`global:${utcDateKey(date)}`) || 0;
    },
    async increment(userId, date = new Date()) {
      const key = utcDateKey(date);
      const userKey = `${userId}:${key}`;
      const globalKey = `global:${key}`;
      entries.set(userKey, (entries.get(userKey) || 0) + 1);
      entries.set(globalKey, (entries.get(globalKey) || 0) + 1);
    },
  };
}

export function createPrismaUsageStore(prisma) {
  return {
    async getUserCount(userId, date = new Date()) {
      const row = await prisma.aiUsage.findUnique({
        where: { userId_date_feature: { userId, date: new Date(date.toISOString().slice(0, 10)), feature: 'ALL' } },
      });
      return row?.count || 0;
    },
    async getGlobalCount(date = new Date()) {
      const row = await prisma.aiUsage.findFirst({
        where: { userId: null, date: new Date(date.toISOString().slice(0, 10)), feature: 'ALL' },
      });
      return row?.count || 0;
    },
    async increment(userId, date = new Date()) {
      const normalizedDate = new Date(date.toISOString().slice(0, 10));
      await prisma.$transaction(async (transaction) => {
        await transaction.aiUsage.upsert({
          where: { userId_date_feature: { userId, date: normalizedDate, feature: 'ALL' } },
          create: { userId, date: normalizedDate, feature: 'ALL', count: 1 },
          update: { count: { increment: 1 } },
        });
        // The shared (all users) counter has a NULL userId, which the unique index cannot match.
        const shared = await transaction.aiUsage.findFirst({ where: { userId: null, date: normalizedDate, feature: 'ALL' } });
        if (shared) {
          await transaction.aiUsage.update({ where: { id: shared.id }, data: { count: { increment: 1 } } });
        } else {
          await transaction.aiUsage.create({ data: { date: normalizedDate, feature: 'ALL', count: 1 } });
        }
      });
    },
  };
}

export function createAiLimits({
  usageStore,
  userDailyLimit,
  globalDailyLimit,
}) {
  if (!usageStore) throw new Error('AI usage store is required');

  return {
    async assertAvailable(userId) {
      const userCount = await usageStore.getUserCount(userId);
      if (userCount >= userDailyLimit) {
        throw new AiLimitError(
          'AI_USER_LIMIT_REACHED',
          'Your daily AI generation limit has been reached.',
        );
      }

      if (globalDailyLimit !== null) {
        const globalCount = await usageStore.getGlobalCount();
        if (globalCount >= globalDailyLimit) {
          throw new AiLimitError(
            'AI_LIMIT_REACHED',
            'The shared daily AI generation limit has been reached.',
          );
        }
      }
    },
    increment: (userId) => usageStore.increment(userId),
  };
}
