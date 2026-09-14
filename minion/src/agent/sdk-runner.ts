/**
 * Real AgentRunner backed by the Claude Agent SDK (`query()`), the one piece
 * that needs a key + network (SPEC §9.6).
 *
 * Each Minion node runs exactly one named agent (the orchestrator already
 * decided which), so we don't rely on the SDK's subagent *delegation*. Instead
 * we resolve the name to its markdown definition under `<projectDir>/.claude`
 * and run it as a single-purpose agent:
 *   - the file body becomes the `systemPrompt`,
 *   - the `model` frontmatter maps straight to the SDK `model` alias,
 *   - `tools` / `allowed-tools` becomes `allowedTools`,
 *   - `cwd` is the run's isolated clone, so file edits land there — decoupled
 *     from where the agent definitions live (the Minion project).
 *
 * Names resolve against `.claude/agents/<name>.md` first, then
 * `.claude/skills/<name>/SKILL.md` (the two context gatherers are skills).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { query, type McpServerConfig, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentRequest, AgentResponse, AgentRunner } from "./agent-runner.js";

export interface SdkRunnerOptions {
  /** Directory containing `.claude/agents` and `.claude/skills`. */
  projectDir: string;
  /** MCP servers exposed to agents (e.g. Tavily/Context7 for context skills). */
  mcpServers?: Record<string, McpServerConfig>;
  /** Safety ceiling on the agent loop per node. */
  maxTurns?: number;
}

interface Definition {
  systemPrompt: string;
  model?: string; // "opus" | "sonnet" — SDK resolves the alias
  allowedTools: string[];
  /** Skills referenced in frontmatter, inlined into the system prompt. */
  skills: string[];
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export class SdkAgentRunner implements AgentRunner {
  private readonly cache = new Map<string, Definition>();

  constructor(private readonly options: SdkRunnerOptions) {}

  async run(req: AgentRequest): Promise<AgentResponse> {
    const def = this.load(req.agent);
    const allowed = this.allowedTools(def);
    let text = "";
    let errorSubtype: string | undefined;

    // Map tier aliases → concrete, currently-valid model IDs. The SDK's bare
    // "opus"/"sonnet" alias can resolve to a model ID a given API key doesn't
    // have (→ not_found → the query loops), so we pin real IDs (env-overridable).
    const modelAliases: Record<string, string> = {
      opus: process.env.MINION_MODEL_OPUS ?? "claude-opus-4-6",
      sonnet: process.env.MINION_MODEL_SONNET ?? "claude-sonnet-4-5-20250929",
      haiku: process.env.MINION_MODEL_HAIKU ?? "claude-haiku-4-5-20251001",
    };
    const model = def.model !== undefined ? (modelAliases[def.model] ?? def.model) : undefined;

    // Build options omitting undefined keys (exactOptionalPropertyTypes).
    // settingSources: [] so we don't inherit the target repo's own .claude /
    // CLAUDE.md — agent definitions come from the Minion project, set explicitly.
    const options: Options = {
      cwd: req.cwd ?? this.options.projectDir,
      systemPrompt: def.systemPrompt,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      settingSources: [],
      maxTurns: this.options.maxTurns ?? 120,
      ...(model !== undefined ? { model } : {}),
      ...(allowed !== undefined ? { allowedTools: allowed } : {}),
      ...(this.options.mcpServers !== undefined ? { mcpServers: this.options.mcpServers } : {}),
    };

    for await (const message of query({ prompt: req.prompt, options })) {
      if (message.type === "result") {
        if (message.subtype === "success") text = message.result;
        else errorSubtype = message.subtype;
      }
    }

    if (text === "") {
      throw new Error(
        `agent "${req.agent}" produced no successful result` +
          (errorSubtype ? ` (${errorSubtype})` : ""),
      );
    }
    return { text };
  }

  /** Definition tools plus every MCP server's toolset (context skills need it). */
  private allowedTools(def: Definition): string[] | undefined {
    const mcp = Object.keys(this.options.mcpServers ?? {}).map((s) => `mcp__${s}`);
    const all = [...def.allowedTools, ...mcp];
    return all.length > 0 ? all : undefined;
  }

  private load(name: string): Definition {
    const cached = this.cache.get(name);
    if (cached !== undefined) return cached;

    const parsed = parseDefinition(readFileSync(this.resolve(name), "utf8"));
    // An agent that declares `skills: [...]` needs those skill bodies inlined —
    // the SDK isn't loading them from disk (cwd is the clone, not this project),
    // and a judge referencing "the judging skill" must actually see its rubric.
    const skillBlocks = parsed.skills.map(
      (s) => `\n\n## Skill: ${s}\n\n${parseDefinition(readFileSync(this.resolveSkill(s), "utf8")).systemPrompt}`,
    );
    const def: Definition = {
      ...parsed,
      systemPrompt: parsed.systemPrompt + skillBlocks.join(""),
    };
    this.cache.set(name, def);
    return def;
  }

  /** An agent (`.claude/agents/<name>.md`) or a top-level skill (`.claude/skills/<name>/SKILL.md`). */
  private resolve(name: string): string {
    const agentPath = join(this.options.projectDir, ".claude", "agents", `${name}.md`);
    if (existsSync(agentPath)) return agentPath;
    const skillPath = this.resolveSkill(name, false);
    if (existsSync(skillPath)) return skillPath;
    throw new Error(`no agent or skill named "${name}" under ${this.options.projectDir}/.claude`);
  }

  private resolveSkill(name: string, checked = true): string {
    const skillPath = join(this.options.projectDir, ".claude", "skills", name, "SKILL.md");
    if (checked && !existsSync(skillPath)) {
      throw new Error(`referenced skill "${name}" not found at ${skillPath}`);
    }
    return skillPath;
  }
}

function parseDefinition(raw: string): Definition {
  const m = FRONTMATTER.exec(raw);
  if (m === null) return { systemPrompt: raw.trim(), allowedTools: [], skills: [] };
  const front = m[1] ?? "";
  const body = (m[2] ?? "").trim();
  const allowedTools = list(field(front, "tools") ?? field(front, "allowed-tools"));
  const skills = list(field(front, "skills"));
  const model = field(front, "model");
  const base = { systemPrompt: body, allowedTools, skills };
  return model !== undefined ? { ...base, model } : base;
}

/** Parse a frontmatter list: `a, b`, `[a, b]`, or a single value. */
function list(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function field(frontmatter: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(frontmatter);
  return m?.[1]?.trim();
}

/**
 * Load MCP server definitions from a `.mcp.json`, expanding `${VAR}` from the
 * environment (the file keeps secrets out of git; the values live in `.env`).
 * Returns the shape the SDK's `mcpServers` option expects.
 */
export function loadMcpServers(mcpJsonPath: string): Record<string, McpServerConfig> {
  if (!existsSync(mcpJsonPath)) return {};
  const parsed = JSON.parse(readFileSync(mcpJsonPath, "utf8")) as {
    mcpServers?: Record<string, unknown>;
  };
  const expand = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.replace(/\$\{([^}]+)\}/g, (_, name: string) => process.env[name] ?? "");
    }
    if (Array.isArray(value)) return value.map(expand);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, expand(v)]),
      );
    }
    return value;
  };
  return expand(parsed.mcpServers ?? {}) as Record<string, McpServerConfig>;
}
