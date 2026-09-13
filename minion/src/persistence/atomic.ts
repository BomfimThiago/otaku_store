/**
 * Low-level file helpers (SPEC §9.2).
 *
 * JSON state is written atomically (temp file + rename) so the polling dashboard
 * never observes a half-written file. Logs are append-only JSONL; a truncated
 * final line from a crash mid-append is tolerated on read.
 */
import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

function isEnoent(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}

/** Write `data` as pretty JSON atomically: temp file in the same dir, then rename. */
export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${randomUUID()}`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

/** Read and parse a JSON file; returns `undefined` if it does not exist yet. */
export async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (err) {
    if (isEnoent(err)) return undefined;
    throw err;
  }
}

/** Append one object as a JSON line (JSONL). Safe from a single writer. */
export async function appendJsonl(file: string, entry: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
}

/** Read a JSONL file into an array, skipping a truncated/garbled final line. */
export async function readJsonl<T>(file: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
  const out: T[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // Tolerate a partial last line written before a crash (SPEC §9.2).
    }
  }
  return out;
}
