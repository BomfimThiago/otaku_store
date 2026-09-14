import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app.js';

type App = Awaited<ReturnType<typeof createTestApp>>;

let emailCounter = 0;
function uniqueEmail(): string {
  emailCounter += 1;
  return `user-${emailCounter}-${Date.now()}@example.com`;
}

function findSetCookie(headers: string | string[] | undefined, name: string): string | undefined {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  return list.find((header) => header.startsWith(`${name}=`));
}

async function register(
  app: App,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      name: overrides.name ?? 'Ada Lovelace',
      email: overrides.email ?? uniqueEmail(),
      password: overrides.password ?? 'password1',
    },
  });
}

describe('POST /api/auth/register', () => {
  let app: App;

  afterEach(async () => {
    await app.close();
  });

  it('returns 201 with the public user and no password fields', async () => {
    app = await createTestApp();
    const email = uniqueEmail();

    const response = await register(app, { email });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toEqual({ id: expect.any(String), name: 'Ada Lovelace', email });
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('sets a signed, HttpOnly, SameSite=Lax sid cookie with Path=/', async () => {
    app = await createTestApp();

    const response = await register(app);

    const setCookie = findSetCookie(response.headers['set-cookie'], 'sid');
    expect(setCookie).toBeDefined();
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    // A signed cookie value carries a `.<signature>` suffix.
    expect(setCookie).toMatch(/sid=[^;]+\.[^;]+;/);
  });

  it('returns 409 in the {error,message,statusCode} shape for a duplicate email', async () => {
    app = await createTestApp();
    const email = uniqueEmail();
    await register(app, { email });

    const response = await register(app, { email });

    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body).toMatchObject({ statusCode: 409 });
    expect(typeof body.error).toBe('string');
    expect(typeof body.message).toBe('string');
  });

  it('returns 400 for a password shorter than 8 characters', async () => {
    app = await createTestApp();

    const response = await register(app, { password: 'ab1' });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for a password without a letter', async () => {
    app = await createTestApp();

    const response = await register(app, { password: '12345678' });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for a password without a digit', async () => {
    app = await createTestApp();

    const response = await register(app, { password: 'abcdefgh' });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for an invalid email', async () => {
    app = await createTestApp();

    const response = await register(app, { email: 'not-an-email' });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for an empty name', async () => {
    app = await createTestApp();

    const response = await register(app, { name: '   ' });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  let app: App;

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with the user and sets the cookie for correct credentials', async () => {
    app = await createTestApp();
    const email = uniqueEmail();
    await register(app, { email, password: 'password1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'password1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toEqual({ id: expect.any(String), name: 'Ada Lovelace', email });
    expect(findSetCookie(response.headers['set-cookie'], 'sid')).toBeDefined();
  });

  it('returns 401 with the same body for a wrong password', async () => {
    app = await createTestApp();
    const email = uniqueEmail();
    await register(app, { email, password: 'password1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'wrong-password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ statusCode: 401, message: 'Credenciais inválidas' });
  });

  it('returns 401 with the same body for an unknown email', async () => {
    app = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: uniqueEmail(), password: 'password1' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ statusCode: 401, message: 'Credenciais inválidas' });
  });
});

describe('GET /api/auth/me', () => {
  let app: App;

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 without a cookie', async () => {
    app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 with a tampered cookie', async () => {
    app = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid: 's%3Atampered-value.invalidsignature' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 with an unsigned cookie', async () => {
    app = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid: 'plain-unsigned-value' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 200 with the user for the cookie from login', async () => {
    app = await createTestApp();
    const email = uniqueEmail();
    await register(app, { email, password: 'password1' });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'password1' },
    });
    const sid = loginResponse.cookies.find((c) => c.name === 'sid')?.value;
    expect(sid).toBeDefined();

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid: sid! },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: expect.any(String), name: 'Ada Lovelace', email });
  });
});

describe('POST /api/auth/logout', () => {
  let app: App;

  afterEach(async () => {
    await app.close();
  });

  it('returns 204 and clears the cookie', async () => {
    app = await createTestApp();
    const registerResponse = await register(app);
    const sid = registerResponse.cookies.find((c) => c.name === 'sid')?.value;

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { sid: sid! },
    });

    expect(response.statusCode).toBe(204);
    const clearedCookie = findSetCookie(response.headers['set-cookie'], 'sid');
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toMatch(/Expires=/i);
  });

  it('revokes the session so /me with the old cookie returns 401 afterwards', async () => {
    app = await createTestApp();
    const email = uniqueEmail();
    await register(app, { email, password: 'password1' });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'password1' },
    });
    const sid = loginResponse.cookies.find((c) => c.name === 'sid')?.value;

    await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { sid: sid! } });

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { sid: sid! },
    });

    expect(meResponse.statusCode).toBe(401);
  });
});
