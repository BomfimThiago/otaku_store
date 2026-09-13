/**
 * Minion entry point.
 *
 * Wiring (orchestrator, scheduler, dispatch loop) lands in later steps. For now
 * this only exercises the toolchain and the declarative blueprint.
 */
import { BLUEPRINT_NODES } from "./blueprint.js";

function main(): void {
  const nodes = BLUEPRINT_NODES.map((n) => n.node).join(" → ");
  console.log(`minion: ${BLUEPRINT_NODES.length} blueprint nodes`);
  console.log(nodes);
}

main();
