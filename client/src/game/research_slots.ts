import type { CompiledGame, EntityDef } from "../../../shared/data";

/**
 * The research buttons a building shows, one per upgrade: each slot starts at an upgrade's first
 * level and moves on to the next level (`follows`) once the previous one is finished. The HUD
 * and the Q/W/E/R hotkeys both use this, so slot order and keys always match.
 */
export function researchSlots(def: EntityDef, researched: readonly string[], game: CompiledGame): string[] {
  const offered = new Set(def.researches);
  return def.researches
    .filter((id) => !game.research[id]?.follows)
    .map((first) => {
      let current = first;
      while (researched.includes(current)) {
        const next = def.researches.find((id) => game.research[id]?.follows === current && offered.has(id));
        if (!next) break;
        current = next;
      }
      return current;
    });
}
