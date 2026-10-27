import { hitDamage } from "../damage";
import { edgeDistance } from "../geometry";
import type { System } from "../step";

/**
 * Units in range of their target with a ready cooldown deal one hit (see `hitDamage` for armour
 * and tag bonuses) and record the tick, so clients can draw the shot.
 */
export const combat: System = (world, game) => {
  for (const e of Object.values(world.entities)) {
    const def = game.defs[e.type]!;
    const attack = def.attack;
    if (!attack) continue;
    if (e.cooldown > 0) e.cooldown--;
    if (e.cooldown > 0 || e.target === null) continue;
    const target = world.entities[e.target];
    if (!target || target.owner === e.owner) continue;
    if (edgeDistance(e, target, game) > attack.range) continue;
    target.hp -= hitDamage(def, game.defs[target.type]!);
    e.cooldown = attack.intervalTicks;
    e.lastAttackTick = world.tick;
  }
};
