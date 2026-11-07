import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  createSession,
  createUser,
  db,
  deleteSession,
  findUserById,
  findUserByNorm,
  hashPin,
  normalizeUsername,
  pullSyncRecords,
  purgeExpiredSessions,
  SESSION_TTL_MS,
  sessionUser,
  upsertSyncRecords,
  verifyPin,
  type UserRow,
} from './db.js';

const APP_NAME = 'Aurum';
const COOKIE_NAME = 'aurum_session';
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

const ENTITIES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'goals',
  'recurring_bills',
  'salary_profile',
  'deductions',
] as const;

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
  trustProxy: process.env.TRUST_PROXY === 'true',
  bodyLimit: 12 * 1024 * 1024,
});

await app.register(cookie);

app.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/api')) {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  }
  return payload;
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
    .max(24, 'O nome pode ter no máximo 24 caracteres.')
    .regex(
      /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u,
      'Use letras, números, espaço, ponto, hífen ou sublinhado.',
    ),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'O PIN deve ter de 4 a 6 dígitos.'),
});

function fail(reply: FastifyReply, status: number, error: string) {
  return reply.code(status).send({ error });
}

function zodError(reply: FastifyReply, error: z.ZodError) {
  const message = error.issues[0]?.message ?? 'Dados inválidos.';
  return fail(reply, 400, message);
}

type RateEntry = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateEntry>();

function checkRate(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.count >= 12) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

function registerFailure(key: string): void {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  entry.count += 1;
}

function setSessionCookie(request: FastifyRequest, reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE || request.protocol === 'https',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}

function authenticate(request: FastifyRequest, reply: FastifyReply): UserRow | null {
  const token = request.cookies[COOKIE_NAME];
  if (!token) {
    fail(reply, 401, 'Sessão expirada. Entre novamente.');
    return null;
  }
  const user = sessionUser(token);
  if (!user) {
    clearSessionCookie(reply);
    fail(reply, 401, 'Sessão expirada. Entre novamente.');
    return null;
  }
  return user;
}

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

app.post('/api/auth/register', async (request, reply) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) return zodError(reply, parsed.error);

  const { username, pin } = parsed.data;
  const normalized = normalizeUsername(username);
  const rateKey = `${request.ip}:${normalized}`;
  const rate = checkRate(rateKey);
  if (!rate.allowed) {
    reply.header('Retry-After', String(rate.retryAfter));
    return fail(reply, 429, 'Muitas tentativas. Aguarde alguns minutos.');
  }

  if (findUserByNorm(normalized)) {
    registerFailure(rateKey);
    return fail(reply, 409, 'Este nome já está em uso. Escolha outro.');
  }

  let user: UserRow;
  try {
    user = createUser(username, hashPin(pin));
  } catch {
    return fail(reply, 409, 'Este nome já está em uso. Escolha outro.');
  }

  const token = createSession(user.id);
  setSessionCookie(request, reply, token);
  return reply.code(201).send({
    user: { id: user.id, username: user.username },
    vaultSalt: user.vault_salt,
  });
});

app.post('/api/auth/login', async (request, reply) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) return zodError(reply, parsed.error);

  const { username, pin } = parsed.data;
  const normalized = normalizeUsername(username);
  const rateKey = `${request.ip}:${normalized}`;
  const rate = checkRate(rateKey);
  if (!rate.allowed) {
    reply.header('Retry-After', String(rate.retryAfter));
    return fail(reply, 429, 'Muitas tentativas. Aguarde alguns minutos.');
  }

  const user = findUserByNorm(normalized);
  if (!user || !verifyPin(pin, user.pin_hash)) {
    registerFailure(rateKey);
    return fail(reply, 401, 'Nome ou PIN incorretos.');
  }

  rateBuckets.delete(rateKey);
  const token = createSession(user.id);
  setSessionCookie(request, reply, token);
  return {
    user: { id: user.id, username: user.username },
    vaultSalt: user.vault_salt,
  };
});

app.post('/api/auth/logout', async (request, reply) => {
  const token = request.cookies[COOKIE_NAME];
  if (token) deleteSession(token);
  clearSessionCookie(reply);
  return { ok: true };
});

app.get('/api/auth/me', async (request, reply) => {
  const user = authenticate(request, reply);
  if (!user) return;
  const fresh = findUserById(user.id) ?? user;
  return {
    user: { id: fresh.id, username: fresh.username },
    vaultSalt: fresh.vault_salt,
  };
});

/* ------------------------------------------------------------------ */
/* Sync                                                               */
/* ------------------------------------------------------------------ */

const pullSchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

app.get('/api/sync/pull', async (request, reply) => {
  const user = authenticate(request, reply);
  if (!user) return;

  const parsed = pullSchema.safeParse(request.query);
  if (!parsed.success) return zodError(reply, parsed.error);

  const { since, limit } = parsed.data;
  const rows = pullSyncRecords(user.id, since, limit);
  const nextCursor = rows.length > 0 ? rows[rows.length - 1].seq : since;

  return {
    records: rows.map((row) => ({
      seq: row.seq,
      entity: row.entity,
      id: row.record_id,
      payload: row.payload,
      updatedAt: row.updated_at,
    })),
    cursor: nextCursor,
    hasMore: rows.length === limit,
  };
});

const pushSchema = z.object({
  records: z
    .array(
      z.object({
        entity: z.enum(ENTITIES),
        id: z.string().min(1).max(80),
        updatedAt: z.number().int().nonnegative(),
        payload: z.string().min(1).max(500_000),
      }),
    )
    .max(200),
});

app.post('/api/sync/push', async (request, reply) => {
  const user = authenticate(request, reply);
  if (!user) return;

  const parsed = pushSchema.safeParse(request.body);
  if (!parsed.success) return zodError(reply, parsed.error);

  const records = parsed.data.records;
  let accepted = 0;
  if (records.length > 0) {
    accepted = upsertSyncRecords(
      user.id,
      records.map((record) => ({
        entity: record.entity,
        id: record.id,
        updated_at: record.updatedAt,
        payload: record.payload,
      })),
    );
  }

  return { ok: true, accepted };
});

/* ------------------------------------------------------------------ */
/* Infra                                                              */
/* ------------------------------------------------------------------ */

app.get('/api/health', async () => {
  db.prepare('SELECT 1').get();
  return { ok: true, app: APP_NAME, time: new Date().toISOString() };
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(currentDir, '../../client/dist');

if (existsSync(clientDist)) {
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: '/',
    index: ['index.html'],
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api')) {
      return fail(reply, 404, 'Rota não encontrada.');
    }
    return reply.type('text/html').sendFile('index.html');
  });
}

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (reply.sent) return;
  const status =
    typeof (error as { statusCode?: number }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;
  const message =
    error instanceof Error ? error.message : 'Não foi possível concluir a solicitação.';
  return reply
    .code(status)
    .send({ error: status >= 500 ? 'Erro interno. Tente novamente.' : message });
});

const cleanup = setInterval(() => {
  purgeExpiredSessions();
  const now = Date.now();
  for (const [key, entry] of rateBuckets) {
    if (entry.resetAt <= now) rateBuckets.delete(key);
  }
}, 60 * 60 * 1000);

cleanup.unref();

async function shutdown(signal: string) {
  app.log.info(`Encerrando (${signal})…`);
  clearInterval(cleanup);
  await app.close();
  db.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`${APP_NAME} disponível em http://localhost:${PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
