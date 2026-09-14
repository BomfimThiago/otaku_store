/**
 * Dashboard server (SPEC §5.2 dashboard, FR16). A separate read-only process
 * from `minion run`: the command *writes* run state to `runs/`, this server
 * *reads and serves* it. They communicate only through the filesystem, so the
 * dashboard never executes anything — it is the glass, not the engine.
 *
 * Node's built-in http only — no framework, no new dependency.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { BLUEPRINT_NODES } from "../blueprint.js";

export interface DashboardOptions {
  /** Directory holding run-<id>.json + run-<id>.log (SPEC §9.2). */
  runsDir: string;
  /** Path to the dashboard HTML shell. */
  htmlPath: string;
  port: number;
  /**
   * The `minion/` project dir. When set, the dashboard exposes POST /api/trigger
   * to launch `minion run --issue N` from here — turning the read-only glass into
   * a live "ask the Minion to work on a ticket" surface for demos. Omit to keep
   * the dashboard strictly read-only.
   */
  projectDir?: string | undefined;
  /** Hard cap on how many runs the public trigger may launch (abuse guard). */
  maxTriggeredRuns?: number | undefined;
}

// One triggered run at a time; a per-process cap stops a public URL from
// spawning unbounded agent builds. Deterministic guards, no LLM.
let triggerActive = false;
let triggeredCount = 0;

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

  if (p === "/api/config") {
    sendJson(res, 200, { trigger: opts.projectDir !== undefined });
    return;
  }

  if (p === "/api/trigger") {
    await handleTrigger(req, res, opts);
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

/**
 * POST /api/trigger { issue: number }  →  launches `minion run --issue N`.
 * Guards: trigger must be enabled (projectDir set), method POST, a valid positive
 * integer issue, only one active triggered run, and a per-process run cap.
 */
async function handleTrigger(
  req: IncomingMessage,
  res: ServerResponse,
  opts: DashboardOptions,
): Promise<void> {
  if (!opts.projectDir) {
    sendJson(res, 404, { error: "trigger disabled" });
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "use POST" });
    return;
  }
  const cap = opts.maxTriggeredRuns ?? 25;
  if (triggerActive) {
    sendJson(res, 409, { error: "um run já está em andamento — aguarde ele terminar" });
    return;
  }
  if (triggeredCount >= cap) {
    sendJson(res, 429, { error: `limite de ${cap} runs desta sessão atingido` });
    return;
  }

  let body: { issue?: unknown; token?: unknown };
  try {
    body = JSON.parse(await readBody(req)) as { issue?: unknown; token?: unknown };
  } catch {
    sendJson(res, 400, { error: "corpo inválido (JSON esperado)" });
    return;
  }
  // Optional access token (abuse guard on a public URL) — enforced only if set.
  const requiredToken = process.env.TRIGGER_TOKEN;
  if (requiredToken && body.token !== requiredToken) {
    sendJson(res, 401, { error: "token de acesso inválido ou ausente" });
    return;
  }
  const issue = Number(body.issue);
  if (!Number.isInteger(issue) || issue <= 0) {
    sendJson(res, 400, { error: "informe o número da issue (inteiro positivo)" });
    return;
  }

  triggerActive = true;
  triggeredCount += 1;
  const child = spawn("npx", ["tsx", "src/index.ts", "run", "--issue", String(issue), "--pr"], {
    cwd: opts.projectDir,
    env: process.env,
    stdio: "ignore",
  });
  child.on("exit", () => {
    triggerActive = false;
  });
  child.on("error", () => {
    triggerActive = false;
  });

  sendJson(res, 202, {
    ok: true,
    issue,
    message: `Minion iniciado na issue #${issue} — acompanhe o run abaixo`,
    remaining: cap - triggeredCount,
  });
}

/** Read a request body with a small size cap (trigger payloads are tiny). */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 4096) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
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
