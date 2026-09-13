/**
 * Thin child-process wrapper. `run` executes a binary with an argv array (no
 * shell — safe for `git`); `runShell` runs a command string in a shell (for the
 * project's own lint/test commands from minion.config). Both capture output and
 * resolve with the exit code rather than throwing, so callers decide what a
 * non-zero code means.
 */
import { spawn, type SpawnOptions } from "node:child_process";

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
}

function collect(
  command: string,
  args: string[],
  shell: boolean,
  opts: ExecOptions,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const options: SpawnOptions = { shell };
    if (opts.cwd !== undefined) options.cwd = opts.cwd;

    const child = spawn(command, args, options);
    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;

    if (opts.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`command timed out after ${opts.timeoutMs}ms: ${command}`));
      }, opts.timeoutMs);
    }

    child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** Run a binary with an argv array (no shell). */
export function run(command: string, args: string[], opts: ExecOptions = {}): Promise<CommandResult> {
  return collect(command, args, false, opts);
}

/** Run a command string in a shell (for configured project commands). */
export function runShell(command: string, opts: ExecOptions = {}): Promise<CommandResult> {
  return collect(command, [], true, opts);
}
