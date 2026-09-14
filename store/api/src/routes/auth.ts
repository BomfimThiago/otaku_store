import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createUsersStore, PASSWORD_MIN_LENGTH } from '../data/users.js';

const COOKIE_NAME = 'sid';

function unauthorized(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 401 });
}

const publicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
});

const registerBody = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one digit'),
});

const loginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const authRoute: FastifyPluginAsyncZod = async (app) => {
  // Built inside the plugin (rather than at module scope) so each buildApp()
  // gets its own in-memory state, keeping tests isolated from one another.
  const usersStore = createUsersStore();

  function setSidCookie(reply: FastifyReply, sid: string): void {
    reply.setCookie(COOKIE_NAME, sid, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      signed: true,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  app.post(
    '/api/auth/register',
    { schema: { body: registerBody, response: { 201: publicUserSchema } } },
    async (req, reply) => {
      const user = await usersStore.register(req.body);
      const sid = usersStore.createSession(user.id);
      setSidCookie(reply, sid);
      return reply.code(201).send(user);
    },
  );

  app.post(
    '/api/auth/login',
    { schema: { body: loginBody, response: { 200: publicUserSchema } } },
    async (req, reply) => {
      const user = await usersStore.verifyCredentials(req.body.email, req.body.password);
      if (!user) throw unauthorized('Credenciais inválidas');

      const sid = usersStore.createSession(user.id);
      setSidCookie(reply, sid);
      return user;
    },
  );

  app.post('/api/auth/logout', async (req, reply) => {
    const raw = req.cookies[COOKIE_NAME];
    if (raw) {
      const unsigned = req.unsignCookie(raw);
      if (unsigned.valid) {
        usersStore.deleteSession(unsigned.value);
      }
    }
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/api/auth/me', { schema: { response: { 200: publicUserSchema } } }, async (req, reply) => {
    const raw = req.cookies[COOKIE_NAME];
    if (!raw) throw unauthorized('Not authenticated');

    const unsigned = req.unsignCookie(raw);
    if (!unsigned.valid) throw unauthorized('Not authenticated');

    const user = usersStore.getUserBySession(unsigned.value);
    if (!user) throw unauthorized('Not authenticated');

    if (unsigned.renew) {
      setSidCookie(reply, unsigned.value);
    }
    return user;
  });
};

export default authRoute;
