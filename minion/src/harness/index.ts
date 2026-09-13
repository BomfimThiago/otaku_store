/** Barrel for the harness (SPEC §5.2 harness_runner, FR9/FR11). */
export {
  HarnessRunner,
  type CommandCheck,
  type EvalsCheck,
  type ShellRunner,
} from "./harness-runner.js";
export {
  defaultRegistry,
  diffSizeEval,
  type Eval,
  type EvalContext,
  type EvalRegistry,
  type EvalResult,
} from "./evals.js";
