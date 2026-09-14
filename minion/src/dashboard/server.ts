/**
 * Dashboard server (SPEC §5.2 dashboard, FR16). A separate read-only process
 * from `minion run`: the command *writes* run state to `runs/`, this server
 * *reads and serves* it. They communicate only through the filesystem, so the
 * dashboard never executes anything — it is the glass, not the engine.
 *
 * Node's built-in http only — no framework, no new dependency.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { BLUEPRINT_NODES } from "../blueprint.js";

export interface DashboardOptions {
  /** Directory holding run-<id>.json + run-<id>.log (SPEC §9.2). */
  runsDir: string;
  /** Path to the dashboard HTML shell. */
  htmlPath: string;
  port: number;
}

export interface RunningDashboard {
  url: string;
  close(): Promise<void>;
}

export function startDashboard(opts: DashboardOptions): Promise<RunningDashboard> {
  const server = createServer((req, res) => {
    handle(req, res, opts).catch((err: unknown) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
  });

  return new Promise((resolve) => {
    server.listen(opts.port, () => {
      resolve({
        url: `http://localhost:${opts.port}/`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  opts: DashboardOptions,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const p = url.pathname;

  if (p === "/" || p === "/minion-console.html") {
    const html = await readFile(opts.htmlPath, "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    res.end(html);
    return;
  }

  if (p === "/api/blueprint") {
    sendJson(res, 200, { nodes: BLUEPRINT_NODES });
    return;
  }

  if (p === "/api/runs") {
    sendJson(res, 200, { runs: await listRuns(opts.runsDir) });
    return;
  }

  const logMatch = /^\/api\/runs\/([^/]+)\/log$/.exec(p);
  if (logMatch) {
    sendJson(res, 200, { log: await readLog(opts.runsDir, logMatch[1]!) });
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
}

/** All runs, newest first. Missing dir or unreadable files degrade to []. */
async function listRuns(runsDir: string): Promise<unknown[]> {
  let entries: string[];
  try {
    entries = await readdir(runsDir);
  } catch {
    return [];
  }
  const files = entries.filter((f) => f.startsWith("run-") && f.endsWith(".json"));
  const runs = await Promise.all(
    files.map(async (f) => {
      try {
        return JSON.parse(await readFile(path.join(runsDir, f), "utf8")) as { createdAt?: string };
      } catch {
        return null; // atomic writes mean this is rare; skip a torn/removed file
      }
    }),
  );
  return runs
    .filter((r): r is { createdAt?: string } => r !== null)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

async function readLog(runsDir: string, id: string): Promise<unknown[]> {
  const safe = id.replace(/[^A-Za-z0-9_-]/g, "");
  try {
    const raw = await readFile(path.join(runsDir, `run-${safe}.log`), "utf8");
    return raw
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try {
          return JSON.parse(l) as unknown;
        } catch {
          return null;
        }
      })
      .filter((e) => e !== null);
  } catch {
    return [];
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-cache" });
  res.end(JSON.stringify(body));
}
