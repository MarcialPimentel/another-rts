import type { CompiledGame, EntityDef } from "../data";
import type { World } from "./world";

/** What a player's finished research adds up to. Neutral values for players with none. */
export interface TechModifiers {
  /** Multiplier on damage dealt (1.15 after Weapons 1). */
  damage: number;
  /** Multiplier on damage taken (0.85 after Armour 1). */
  damageTaken: number;
  /** Extra gold per second from each owned capture point. */
  pointIncome: number;
}

export const NO_TECH: TechModifiers = { damage: 1, damageTaken: 1, pointIncome: 0 };

/** Works on the simulation's players and on drawable views of them. */
export function techModifiers(
  player: { researched: readonly string[] } | undefined,
  game: CompiledGame,
): TechModifiers {
  if (!player) return NO_TECH;
  let damage = 0;
  let armour = 0;
  let pointIncome = 0;
  for (const id of player.researched) {
    const r = game.research[id];
    if (!r) continue;
    damage += r.effect.damage;
    armour += r.effect.armour;
    pointIncome += r.effect.pointIncome;
  }
  return { damage: 1 + damage, damageTaken: Math.max(0, 1 - armour), pointIncome };
}

/** Modifiers for an entity's owner (neutral for capture points and unknown owners). */
export function ownerTech(world: World, owner: number, game: CompiledGame): TechModifiers {
  return techModifiers(world.players[owner], game);
}

/** Whether the player has finished every research in `ids`. */
export function hasResearched(player: { researched: readonly string[] }, ids: readonly string[]): boolean {
  return ids.every((id) => player.researched.includes(id));
}

/** Whether a player may train this unit type now (its `requires` are researched). */
export function canTrain(player: { researched: readonly string[] }, def: EntityDef): boolean {
  return hasResearched(player, def.requires);
}
