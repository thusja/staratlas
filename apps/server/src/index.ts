import 'dotenv/config';
import Fastify from 'fastify';
import corsPlugin from './plugins/cors';
import redisPlugin from './plugins/redis';
import prismaPlugin from './plugins/prisma';
import starsRoute from './routes/stars';

const app = Fastify({ logger: true });

async function main() {
  await app.register(corsPlugin);
  await app.register(redisPlugin);
  await app.register(prismaPlugin);
  await app.register(starsRoute, { prefix: '/api' });

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
