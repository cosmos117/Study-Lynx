import prisma from '../config/prisma.js';
import { env } from '../config/env.js';

export async function usage(request, response) {
  const date = new Date(new Date().toISOString().slice(0, 10));
  const row = await prisma.aiUsage.findUnique({
    where: { userId_date_feature: { userId: request.user.id, date, feature: 'ALL' } },
  });
  response.json({
    success: true,
    data: {
      userUsedToday: row?.count || 0,
      userLimit: env.ai.userDailyLimit,
      globalAvailable: env.ai.dailyLimit === null
        ? true
        : ((await prisma.aiUsage.findFirst({ where: { userId: null, date, feature: 'ALL' } }))?.count || 0) < env.ai.dailyLimit,
    },
  });
}
