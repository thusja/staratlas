import 'dotenv/config';
import Fastify from 'fastify';
import corsPlugin from './plugins/cors';
import redisPlugin from './plugins/redis';
import starsRoute from './routes/stars';

const app = Fastify({ logger: true });

async function main() {
  await app.register(corsPlugin);
  await app.register(redisPlugin);
  await app.register(starsRoute, { prefix: '/api' });

  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
