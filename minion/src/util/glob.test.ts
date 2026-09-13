import { test } from "node:test";
import assert from "node:assert/strict";
import { matchGlob, matchesAny } from "./glob.js";

test("* stays within a path segment", () => {
  assert.equal(matchGlob("*.css", "a.css"), true);
  assert.equal(matchGlob("*.css", "dir/a.css"), false);
});

test("** crosses path segments", () => {
  assert.equal(matchGlob("src/frontend/**", "src/frontend/a.ts"), true);
  assert.equal(matchGlob("src/frontend/**", "src/frontend/deep/a.ts"), true);
  assert.equal(matchGlob("src/frontend/**", "src/backend/a.ts"), false);
});

test("**/ matches zero or more leading directories", () => {
  assert.equal(matchGlob("**/*.tsx", "App.tsx"), true);
  assert.equal(matchGlob("**/*.tsx", "src/App.tsx"), true);
  assert.equal(matchGlob("**/*.tsx", "src/ui/App.tsx"), true);
  assert.equal(matchGlob("**/*.tsx", "src/App.ts"), false);
});

test("? matches a single non-separator char", () => {
  assert.equal(matchGlob("a?.ts", "ab.ts"), true);
  assert.equal(matchGlob("a?.ts", "a/.ts"), false);
});

test("matchesAny across a glob list", () => {
  const globs = ["**/*.tsx", "**/*.css"];
  assert.equal(matchesAny(globs, "src/App.tsx"), true);
  assert.equal(matchesAny(globs, "src/styles.css"), true);
  assert.equal(matchesAny(globs, "src/pricing.ts"), false);
});
