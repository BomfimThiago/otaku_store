/**
 * End-to-end runner. Boots the built store once, then executes every
 * `cases/*.e2e.mjs` against it. Each case default-exports `async ({ base, assert })`
 * and throws on failure. Reliable by design: plain fetch, no browser, one server.
 *
 * Run:  npm run test:e2e   (from store/)   ·   wired as the Minion `commands.e2e`.
 * Add coverage: drop a new `cases/<feature>.e2e.mjs` — see cases/smoke.e2e.mjs.
 */
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const storeDir = path.resolve(here, '..');
const PORT = process.env.E2E_PORT || String(4100 + (process.pid % 1500));
const base = `http://127.0.0.1:${PORT}`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function waitReady(timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${base}/api/products`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(700);
  }
  return false;
}

const srv = spawn('npm', ['start', '-w', '@store/api'], {
  cwd: storeDir,
  env: { ...process.env, PORT, COOKIE_SECRET: process.env.COOKIE_SECRET || 'e2e-secret' },
  stdio: 'ignore',
});

let exitCode = 1;
const results = [];
try {
  if (!(await waitReady())) throw new Error(`store server never became ready on ${base}`);

  const casesDir = path.join(here, 'cases');
  let files = [];
  try {
    files = (await readdir(casesDir)).filter((f) => f.endsWith('.e2e.mjs')).sort();
  } catch {
    /* no cases dir */
  }
  if (files.length === 0) throw new Error('no e2e cases found in store/e2e/cases');

  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(casesDir, f)).href);
    const run = mod.default ?? mod.run;
    if (typeof run !== 'function') {
      results.push([f, false, 'no default/run export']);
      continue;
    }
    try {
      await run({ base, assert });
      results.push([f, true, '']);
    } catch (e) {
      results.push([f, false, e instanceof Error ? e.message : String(e)]);
    }
  }

  for (const [f, ok, msg] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}${msg ? '  — ' + msg : ''}`);
  const failed = results.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(`\nE2E FAILED: ${failed.length}/${results.length} case(s)`);
    exitCode = 1;
  } else {
    console.log(`\nE2E PASSED: ${results.length} case(s)`);
    exitCode = 0;
  }
} catch (e) {
  console.error('E2E ERROR:', e instanceof Error ? e.message : String(e));
  exitCode = 1;
} finally {
  srv.kill('SIGKILL');
  process.exit(exitCode);
}
