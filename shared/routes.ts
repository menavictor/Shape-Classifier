
import { z } from 'zod';
import { insertClassificationSchema, classifications } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  classifications: {
    list: {
      method: 'GET' as const,
      path: '/api/classifications' as const,
      responses: {
        200: z.array(z.custom<typeof classifications.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/classifications' as const,
      // Input is FormData, so we don't strictly validate body here in the same way, 
      // but we describe the expected result.
      input: z.any(), 
      responses: {
        201: z.custom<typeof classifications.$inferSelect>(),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
