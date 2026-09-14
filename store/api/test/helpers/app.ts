import { buildApp } from '../../src/app.js';

type App = ReturnType<typeof buildApp>;

export async function createTestApp(configure?: (app: App) => void | Promise<void>): Promise<App> {
  const app = buildApp();

  if (configure) {
    await configure(app);
  }

  await app.ready();

  return app;
}
