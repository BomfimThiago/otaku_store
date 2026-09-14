import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app.js';

describe('GET /health', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with { status: "ok" }', async () => {
    app = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('error contract', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;

  afterEach(async () => {
    await app.close();
  });

  it('returns a 404 JSON body for unknown API routes', async () => {
    app = await createTestApp();

    // Non-API GET routes fall through to the SPA (client-side routing); the JSON
    // 404 contract applies to unknown /api/* routes.
    const response = await app.inject({ method: 'GET', url: '/api/does-not-exist' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'Not Found', statusCode: 404 });
  });

  it('returns a 400 JSON body with per-field details for a failed validation', async () => {
    app = await createTestApp((testApp) => {
      testApp.post(
        '/__test/validate',
        {
          schema: {
            body: z.object({
              name: z.string().min(1),
              age: z.number().int(),
            }),
          },
        },
        async () => ({ ok: true }),
      );
    });

    const response = await app.inject({
      method: 'POST',
      url: '/__test/validate',
      payload: { name: '', age: 'x' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('Bad Request');
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/name', code: expect.any(String), message: expect.any(String) }),
        expect.objectContaining({ path: '/age', code: expect.any(String), message: expect.any(String) }),
      ]),
    );
  });
});
