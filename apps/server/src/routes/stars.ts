import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import type { StarsResponse } from '@staratlas/shared';

const prisma = new PrismaClient();

const querySchema = z.object({
  magnitude_max: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseFloat(v) : 5))
    .pipe(z.number().min(0).max(10)),
});

const CACHE_TTL = 60 * 60 * 24; // 24h — 별 카탈로그는 변하지 않음

export default async function starsRoute(app: FastifyInstance) {
  app.get<{ Querystring: { magnitude_max?: string } }>(
    '/stars',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            magnitude_max: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'invalid_magnitude',
          message: 'magnitude_max must be a number between 0 and 10',
        });
      }

      const { magnitude_max } = parsed.data;
      const cacheKey = `stars:mag:${magnitude_max}`;

      // Redis 캐시 확인
      const cached = await app.redis.get(cacheKey);
      if (cached) {
        return reply.send(JSON.parse(cached) as StarsResponse);
      }

      // DB 조회
      const rows = await prisma.star.findMany({
        where: { magnitude: { lte: magnitude_max } },
        orderBy: { magnitude: 'asc' },
      });

      const response: StarsResponse = {
        stars: rows.map((row) => ({
          hipId: row.hipId,
          ra: row.ra,
          dec: row.dec,
          magnitude: row.magnitude,
          name: row.name,
        })),
        total: rows.length,
        magnitudeMax: magnitude_max,
      };

      // Redis 캐시 저장
      await app.redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL);

      return reply.send(response);
    },
  );
}
