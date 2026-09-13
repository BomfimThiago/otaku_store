/**
 * Minimal glob matcher for frontend-file detection (FR11). Supports a single
 * star (within a path segment), a double star (across segments, optionally with
 * a trailing slash) and "?". Kept tiny and dependency-free — it only needs to
 * decide "does this file look like frontend?" deterministically.
 */

const REGEX_SPECIALS = ".+^${}()|[]\\";

function escapeChar(c: string): string {
  return REGEX_SPECIALS.includes(c) ? `\\${c}` : c;
}

function globToRegExp(glob: string): RegExp {
  let re = "^";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") {
      if (glob[i + 2] === "/") {
        re += "(?:.*/)?"; // **/ matches zero or more directories
        i += 3;
      } else {
        re += ".*";
        i += 2;
      }
    } else if (c === "*") {
      re += "[^/]*";
      i++;
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else {
      re += escapeChar(c);
      i++;
    }
  }
  re += "$";
  return new RegExp(re);
}

export function matchGlob(pattern: string, filepath: string): boolean {
  return globToRegExp(pattern).test(filepath);
}

/** True if any glob matches the path. */
export function matchesAny(patterns: string[], filepath: string): boolean {
  return patterns.some((p) => matchGlob(p, filepath));
}
