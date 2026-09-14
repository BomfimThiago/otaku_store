/**
 * The /sobre route is a client-side SPA route (About page). The server has no
 * knowledge of it beyond falling through to the SPA shell, so this case just
 * confirms the shell is served there.
 *
 * A case default-exports `async ({ base, assert })` and throws on failure.
 */
export default async function ({ base, assert }) {
  const res = await fetch(`${base}/sobre`);
  assert(res.status === 200, `GET /sobre returns 200 (got ${res.status})`);
  assert(/id="root"/.test(await res.text()), 'GET /sobre serves the SPA shell (#root)');
}
