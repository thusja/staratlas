import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const registerSchema = z.object({
  email:    z.string().email('유효한 이메일을 입력하세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

export default async function authRoute(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message ?? 'Invalid input',
      });
    }
    const { email, password } = parsed.data;

    const existing = await app.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({
        error: 'CONFLICT',
        message: '이미 사용 중인 이메일입니다.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await app.prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    return reply.status(201).send({ token, user });
  });

  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Invalid input',
      });
    }
    const { email, password } = parsed.data;

    const user = await app.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    const token = app.jwt.sign({ userId: user.id, email: user.email });
    return reply.send({ token, user: { id: user.id, email: user.email } });
  });
}
