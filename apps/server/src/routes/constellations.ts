import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createSchema = z.object({
  name:       z.string().min(1, '별자리 이름을 입력하세요.').max(50),
  memo:       z.string().max(200).optional(),
  thumbnail:  z.string().max(2_000_000).optional(),
  lat:        z.number().min(-90).max(90),
  lng:        z.number().min(-180).max(180),
  observedAt: z.string().datetime(),
  stars: z
    .array(
      z.object({
        hipId: z.number().int().positive(),
        order: z.number().int().min(0),
      }),
    )
    .min(2, '별자리는 최소 2개의 별이 필요합니다.')
    .max(20),
});

const updateSchema = z.object({
  name: z.string().min(1, '별자리 이름을 입력하세요.').max(50).optional(),
  memo: z.string().max(200).nullable().optional(),
  thumbnail: z.string().max(2_000_000).nullable().optional(),
  stars: z
    .array(
      z.object({
        hipId: z.number().int().positive(),
        order: z.number().int().min(0),
      }),
    )
    .min(2, '별자리는 최소 2개의 별이 필요합니다.')
    .max(20)
    .optional(),
}).superRefine((val, ctx) => {
  if (val.name === undefined && val.memo === undefined && val.thumbnail === undefined && val.stars === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '수정할 필드가 없습니다.',
    });
  }

  if (val.stars) {
    const seen = new Set<number>();
    for (const s of val.stars) {
      if (seen.has(s.hipId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '중복된 별은 저장할 수 없습니다.',
          path: ['stars'],
        });
        break;
      }
      seen.add(s.hipId);
    }
  }
});

export default async function constellationsRoute(app: FastifyInstance) {
  // 모든 라우트에 JWT 인증 적용 (이 플러그인은 fp 미사용 — 캡슐화 유지)
  app.addHook('onRequest', app.authenticate);

  // GET /api/constellations — 내 별자리 목록
  app.get('/', async (request, reply) => {
    const userId = request.user.userId;
    const constellations = await app.prisma.constellation.findMany({
      where:   { userId },
      include: { stars: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ constellations });
  });

  // POST /api/constellations — 별자리 저장
  app.post('/', async (request, reply) => {
    const userId = request.user.userId;
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message ?? 'Invalid input',
      });
    }
    const { name, memo, thumbnail, lat, lng, observedAt, stars } = parsed.data;

    const constellation = await app.prisma.constellation.create({
      data: {
        userId,
        name,
        memo,
        thumbnail,
        lat,
        lng,
        observedAt: new Date(observedAt),
        stars: {
          create: stars.map((s) => ({ hipId: s.hipId, order: s.order })),
        },
      },
      include: { stars: { orderBy: { order: 'asc' } } },
    });
    return reply.status(201).send({ constellation });
  });

  // GET /api/constellations/:id — 별자리 상세
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.user.userId;
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'Invalid id' });
    }

    const constellation = await app.prisma.constellation.findFirst({
      where:   { id, userId },
      include: { stars: { orderBy: { order: 'asc' } } },
    });
    if (!constellation) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: '별자리를 찾을 수 없습니다.' });
    }
    return reply.send({ constellation });
  });

  // PATCH /api/constellations/:id — 별자리 수정 (이름/메모/구성 별)
  app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.user.userId;
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'Invalid id' });
    }

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message ?? 'Invalid input',
      });
    }

    const exists = await app.prisma.constellation.findFirst({ where: { id, userId } });
    if (!exists) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: '별자리를 찾을 수 없습니다.' });
    }

    const { name, memo, thumbnail, stars } = parsed.data;
    const constellation = await app.prisma.constellation.update({
      where: { id },
      data: {
        name: name === undefined ? undefined : name.trim(),
        memo: memo === undefined ? undefined : (memo?.trim() ? memo.trim() : null),
        thumbnail: thumbnail === undefined ? undefined : (thumbnail?.trim() ? thumbnail.trim() : null),
        stars: stars
          ? {
              deleteMany: {},
              create: stars.map((s, i) => ({
                hipId: s.hipId,
                order: i,
              })),
            }
          : undefined,
      },
      include: { stars: { orderBy: { order: 'asc' } } },
    });

    return reply.send({ constellation });
  });

  // DELETE /api/constellations/:id — 별자리 삭제
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.user.userId;
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'INVALID_ID', message: 'Invalid id' });
    }

    const constellation = await app.prisma.constellation.findFirst({ where: { id, userId } });
    if (!constellation) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: '별자리를 찾을 수 없습니다.' });
    }

    await app.prisma.constellation.delete({ where: { id } });
    return reply.status(204).send();
  });
}
