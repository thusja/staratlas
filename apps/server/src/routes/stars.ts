import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { StarsResponse } from '@staratlas/shared';

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

      try {
        // Redis 캐시 확인
        const cached = await app.redis.get(cacheKey);
        if (cached) {
          reply.header('Cache-Control', 'public, max-age=86400');
          return reply.send(JSON.parse(cached) as StarsResponse);
        }

        // DB 조회
        const rows = await app.prisma.star.findMany({
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

        // Redis 캐시 저장 (실패해도 응답은 정상 반환)
        await app.redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL).catch((err) => {
          app.log.warn({ err }, 'Redis 캐시 저장 실패 — 응답은 계속 진행');
        });

        reply.header('Cache-Control', 'public, max-age=86400');
        return reply.send(response);
      } catch (err) {
        app.log.error({ err }, '별 카탈로그 조회 실패');
        return reply.status(500).send({
          error: 'server_error',
          message: 'Failed to load star catalog',
        });
      }
    },
  );
}
