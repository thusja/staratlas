import 'dotenv/config';
import Fastify from 'fastify';
import corsPlugin from './plugins/cors';
import redisPlugin from './plugins/redis';
import prismaPlugin from './plugins/prisma';
import jwtPlugin from './plugins/jwt';
import starsRoute from './routes/stars';
import authRoute from './routes/auth';
import constellationsRoute from './routes/constellations';

const app = Fastify({ logger: true });

async function main() {
  await app.register(corsPlugin);
  await app.register(redisPlugin);
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);
  await app.register(starsRoute, { prefix: '/api' });
  await app.register(authRoute,  { prefix: '/api/auth' });
  await app.register(constellationsRoute, { prefix: '/api/constellations' });

  // 헬스 체크 — 서버·DB·Redis 연결 상태 확인
  app.get('/health', async (_request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      await app.redis.ping();
      return reply.send({ status: 'ok', db: 'ok', redis: 'ok' });
    } catch (err) {
      app.log.error({ err }, 'Health check 실패');
      return reply.status(503).send({ status: 'error' });
    }
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});

// 그레이스풀 종료 — Prisma/Redis 연결 정상 해제
const shutdown = async (signal: string) => {
  app.log.info(`${signal} 수신 — 서버 종료 중...`);
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
