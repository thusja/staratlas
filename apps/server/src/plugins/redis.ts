import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async function redisPlugin(app: FastifyInstance) {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

  redis.on('error', (err) => app.log.error({ err }, 'Redis connection error'));

  app.decorate('redis', redis);
  app.addHook('onClose', async () => {
    await redis.quit();
  });
});
