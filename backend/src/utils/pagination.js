import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function getPagination({ page, limit }) {
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function paginatedResponse(items, total, { page, limit }) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
