import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export default fp(async function corsPlugin(app: FastifyInstance) {
  await app.register(cors, {
    origin: true, // 개발 환경: 모든 origin 허용 — 프로덕션에서 도메인으로 제한
  });
});
