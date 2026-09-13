/**
 * Deterministic AgentRunner for tests and offline development. Maps an agent
 * name to a canned text reply (typically a JSON block), so the whole pipeline
 * can run end to end without the SDK, a key, or the network.
 */
import type { AgentRequest, AgentResponse, AgentRunner } from "./agent-runner.js";

export type FakeHandler = (req: AgentRequest) => string | Promise<string>;

export class FakeAgentRunner implements AgentRunner {
  constructor(private readonly handlers: Record<string, FakeHandler>) {}

  async run(req: AgentRequest): Promise<AgentResponse> {
    const handler = this.handlers[req.agent];
    if (handler === undefined) {
      throw new Error(`FakeAgentRunner: no handler for agent "${req.agent}"`);
    }
    return { text: await handler(req) };
  }
}

/** Convenience: wrap an object as a fenced JSON reply. */
export function jsonReply(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}
