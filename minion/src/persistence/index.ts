/** Barrel for the persistence layer (SPEC §9.2). */
export { StateStore } from "./store.js";
export { createPaths, type StorePaths } from "./paths.js";
export {
  writeJsonAtomic,
  readJson,
  appendJsonl,
  readJsonl,
} from "./atomic.js";
