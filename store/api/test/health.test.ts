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
