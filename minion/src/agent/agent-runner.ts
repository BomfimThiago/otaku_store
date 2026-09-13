/**
 * The seam between the deterministic engine (TS) and the agentic layer (the
 * markdown skills/subagents run by the Agent SDK). Node handlers depend only on
 * this interface, so the engine stays testable with a fake and the real SDK
 * implementation plugs in behind it (SPEC §5.2, §9.6).
 */
export interface AgentRequest {
  /** Subagent name, matching a file in `.claude/agents/` (e.g. "planner"). */
  agent: string;
  /** The task + gathered context handed to the agent. */
  prompt: string;
  /** Working directory (the run's isolated clone) for agents that edit files. */
  cwd?: string;
  /** Optional skill to steer the agent (e.g. "judging"). */
  skill?: string;
}

export interface AgentResponse {
  /** The agent's final text output (may contain a fenced JSON block). */
  text: string;
}

export interface AgentRunner {
  run(req: AgentRequest): Promise<AgentResponse>;
}

/**
 * Pull the JSON payload out of an agent's reply: the first fenced block (```json
 * or plain ```), or the whole text if unfenced. Throws if it does not parse —
 * a malformed agent output should fail loudly, not silently.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1]! : text).trim();
  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new Error(`agent output is not valid JSON: ${(err as Error).message}`);
  }
}

/** Run an agent and parse its structured output with the given validator. */
export async function runStructured<T>(
  runner: AgentRunner,
  req: AgentRequest,
  parse: (u: unknown) => T,
): Promise<T> {
  const res = await runner.run(req);
  return parse(extractJson(res.text));
}
