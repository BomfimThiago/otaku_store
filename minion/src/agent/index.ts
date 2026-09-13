/** Barrel for the agent layer (SPEC §5.2, §9.6). */
export {
  extractJson,
  runStructured,
  type AgentRequest,
  type AgentResponse,
  type AgentRunner,
} from "./agent-runner.js";
export {
  parsePlan,
  parseVerdict,
  parseBacklogItems,
  type DecomposedItem,
  type VerdictOutput,
} from "./parse.js";
export { FakeAgentRunner, jsonReply, type FakeHandler } from "./fake.js";
export { SdkAgentRunner, loadMcpServers, type SdkRunnerOptions } from "./sdk-runner.js";
