import { distance } from "../geometry";
import type { System } from "../step";
import { NEUTRAL } from "../world";

/**
 * Capture points (GDD: Economy). For each point, add up the capture weight of every player's
 * units standing in it (a unit counts when its centre is inside the point's radius):
 * - Units of two players: contested, nothing changes.
 * - Nobody: unfinished progress drains away at the base rate.
 * - One player: progress grows at their weight (capped) per tick. If someone else had progress,
 *   it is pushed back first. A full bar on an enemy point makes it neutral; a full bar on a
 *   neutral point makes it theirs. The owner standing on their own point clears enemy progress.
 * Runs after deaths, so units killed this tick don't count. Owned points pay through `income`.
 */
export const capture: System = (world, game) => {
  const all = Object.values(world.entities);
  const units = all.filter((e) => game.defs[e.type]!.kind === "unit");
  const cap = game.economy.captureWeightCap;

  for (const point of all) {
    const def = game.defs[point.type]!;
    if (def.kind !== "point") continue;

    const weight = new Map<number, number>();
    for (const u of units) {
      if (distance(u.x, u.y, point.x, point.y) > def.radius) continue;
      weight.set(u.owner, (weight.get(u.owner) ?? 0) + game.defs[u.type]!.captureWeight);
    }

    if (weight.size > 1) continue;
    if (weight.size === 0) {
      point.captureProgress = Math.max(0, point.captureProgress - 1);
      if (point.captureProgress === 0) point.captureBy = NEUTRAL;
      continue;
    }

    const [player, w] = [...weight][0]!;
    const rate = Math.min(w, cap);
    if (player === point.owner) {
      // Defenders on their own point wipe out an enemy's partial capture.
      point.captureProgress = Math.max(0, point.captureProgress - rate);
      if (point.captureProgress === 0) point.captureBy = NEUTRAL;
      continue;
    }
    if (point.captureBy !== player && point.captureProgress > 0) {
      point.captureProgress = Math.max(0, point.captureProgress - rate);
      if (point.captureProgress === 0) point.captureBy = NEUTRAL;
      continue;
    }

    point.captureBy = player;
    point.captureProgress += rate;
    if (point.captureProgress >= def.captureTicks) {
      point.owner = point.owner === NEUTRAL ? player : NEUTRAL;
      point.captureProgress = 0;
      point.captureBy = point.owner === NEUTRAL ? player : NEUTRAL;
    }
  }
};
