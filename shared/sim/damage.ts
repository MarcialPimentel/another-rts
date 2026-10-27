import type { EntityDef } from "../data";

/**
 * Damage one hit from `attacker` deals to `target`: base damage times the largest bonus that
 * matches one of the target's tags, minus the target's armour, never below 1.
 */
export function hitDamage(attacker: EntityDef, target: EntityDef): number {
  const attack = attacker.attack;
  if (!attack) return 0;
  let multiplier = 1;
  for (const tag of target.tags) {
    const bonus = attack.bonus[tag];
    if (bonus !== undefined && bonus > multiplier) multiplier = bonus;
  }
  return Math.max(1, attack.damage * multiplier - target.armor);
}
