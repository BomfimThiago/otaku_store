/**
 * Minion entry point — `minion <command> [args]`.
 *
 * The only command today is `run` (SPEC §5, FR1): it accepts a work item (task,
 * spec, or issue) and drives it through the blueprint. The target repo is the
 * one the Minion is installed in, auto-detected inside the command.
 */
import { dashboardCommand } from "./cli/dashboard.js";
import { runCommand } from "./cli/run.js";

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "run":
      await runCommand(rest);
      return;
    case "dashboard":
      await dashboardCommand(rest);
      return;
    default:
      console.error(
        [
          "minion — unsupervised orchestrator of coding agents",
          "",
          "usage:",
          '  minion run "<task>"        run a task through the worker blueprint',
          "  minion run <spec>.md        decompose a spec via the roadmap layer (coming soon)",
          "  minion run --issue <n>      resolve a GitHub issue (coming soon)",
          "  minion dashboard [--port N] serve the live dashboard (reads minion/runs/)",
          "",
          "flags:",
          "  --pr    push the branch and open a real PR (default: dry-run, no push)",
        ].join("\n"),
      );
      process.exitCode = command === undefined ? 0 : 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
