/**
 * Real AgentRunner backed by the Claude Agent SDK — the one piece that needs a
 * key + network (SPEC §9.6). Deliberately left as a documented seam: it will
 * load the `.claude/` skills and subagents, run the named agent with the given
 * prompt/cwd, and return the final text (which `parse.ts` validates).
 *
 * Wiring it in is intentionally last, so the whole deterministic engine can be
 * built and tested against FakeAgentRunner first.
 */
import type { AgentRequest, AgentResponse, AgentRunner } from "./agent-runner.js";

export interface SdkRunnerOptions {
  /** Directory containing `.claude/agents` and `.claude/skills`. */
  projectDir: string;
  /** Default model tier mapping is expressed in the agent definitions. */
}

export class SdkAgentRunner implements AgentRunner {
  constructor(private readonly options: SdkRunnerOptions) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async run(_req: AgentRequest): Promise<AgentResponse> {
    // TODO: call the Claude Agent SDK `query()` with:
    //   - agents/skills loaded from `${this.options.projectDir}/.claude`
    //   - the subagent named `_req.agent`, optional skill `_req.skill`
    //   - cwd `_req.cwd` for file-editing agents
    // then return { text: <final assistant message> }.
    throw new Error(
      `SdkAgentRunner is not wired yet (projectDir=${this.options.projectDir}). ` +
        "Use FakeAgentRunner until the SDK integration lands.",
    );
  }
}
