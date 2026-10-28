import type { EntityDef } from "../data";
import { NO_TECH, type TechModifiers } from "./tech";

/**
 * Damage one hit from `attacker` deals to `target`: base damage times the largest bonus that
 * matches one of the target's tags, times the attacker's Weapons upgrades, minus the target's
 * armour, then times the target's Armour upgrades; never below 1.
 */
export function hitDamage(
  attacker: EntityDef,
  target: EntityDef,
  attackerTech: TechModifiers = NO_TECH,
  targetTech: TechModifiers = NO_TECH,
): number {
  const attack = attacker.attack;
  if (!attack) return 0;
  let multiplier = 1;
  for (const tag of target.tags) {
    const bonus = attack.bonus[tag];
    if (bonus !== undefined && bonus > multiplier) multiplier = bonus;
  }
  const raw = attack.damage * multiplier * attackerTech.damage - target.armor;
  return Math.max(1, raw * targetTech.damageTaken);
}
