/**
 * `minion dashboard [--port N]` — starts the live dashboard (FR16).
 *
 * Runs independently of `minion run`: it reads the run state that the command
 * writes to `minion/runs/` and serves it, refreshing as runs progress. Leave it
 * running in one terminal while you fire `minion run` in another.
 */
import path from "node:path";
import { detectRepoRoot } from "../config/index.js";
import { startDashboard } from "../dashboard/server.js";

export async function dashboardCommand(argv: string[]): Promise<void> {
  const port = parsePort(argv);
  const repoRoot = await detectRepoRoot();
  const projectDir = path.join(repoRoot, "minion");

  const dash = await startDashboard({
    runsDir: path.join(projectDir, "runs"),
    htmlPath: path.join(projectDir, "minion-console.html"),
    port,
  });

  console.log(`minion dashboard → ${dash.url}`);
  console.log(`reading runs from ${path.join(projectDir, "runs")}`);
  console.log("Ctrl-C to stop.\n");

  const stop = (): void => {
    void dash.close().then(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

function parsePort(argv: string[]): number {
  const i = argv.indexOf("--port");
  if (i !== -1 && argv[i + 1] !== undefined) {
    const n = Number.parseInt(argv[i + 1]!, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 4173;
}
