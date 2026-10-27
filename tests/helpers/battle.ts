/**
 * Equal-gold battles for balance tests: two armies spawn facing each other in open ground,
 * both attack-move through the other's position, and the result is the gold value left alive.
 */
import { GAME, type CompiledGame } from "../../shared/data";
import { applyCommand } from "../../shared/sim/commands";
import { TICKS_PER_SECOND } from "../../shared/sim/constants";
import { SYSTEMS } from "../../shared/sim/systems";
import { winCheck } from "../../shared/sim/systems/win_check";
import { createWorld, entityList, spawnEntity, type World } from "../../shared/sim/world";

export interface BattleResult {
  /** Gold value of each side's surviving units. */
  left: [number, number];
  /** Fraction of each side's starting value still alive. */
  share: [number, number];
  seconds: number;
}

/** Every system except the win check, since the arena has no HQs. */
const ARENA_SYSTEMS = SYSTEMS.filter((s) => s !== winCheck);

/** An empty world (no bases) so only the two armies fight. */
function arena(game: CompiledGame): World {
  const w = createWorld(game);
  for (const e of entityList(w)) delete w.entities[e.id];
  return w;
}

function spawnArmy(w: World, owner: number, type: string, budget: number, x: number, game: CompiledGame) {
  const def = game.defs[type]!;
  const count = Math.floor(budget / def.cost);
  const spacing = def.radius * 2 + 6;
  const perColumn = 8;
  const dir = owner === 0 ? -1 : 1;
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    const y = 500 + (row - (Math.min(count, perColumn) - 1) / 2) * spacing;
    ids.push(spawnEntity(w, owner, type, x + dir * col * spacing, y, game).id);
  }
  return ids;
}

export function battle(a: string, b: string, budget = 600, game: CompiledGame = GAME): BattleResult {
  const w = arena(game);
  const left = spawnArmy(w, 0, a, budget, 900, game);
  const right = spawnArmy(w, 1, b, budget, 1500, game);
  applyCommand(w, 0, { type: "attack_move", units: left, x: 1900, y: 500 }, game);
  applyCommand(w, 1, { type: "attack_move", units: right, x: 500, y: 500 }, game);
  const value = (p: number) =>
    entityList(w)
      .filter((e) => e.owner === p)
      .reduce((sum, e) => sum + game.defs[e.type]!.cost, 0);
  const start: [number, number] = [value(0), value(1)];
  const max = 120 * TICKS_PER_SECOND;
  while (w.tick < max && value(0) > 0 && value(1) > 0) {
    for (const system of ARENA_SYSTEMS) system(w, game);
    w.tick++;
  }
  const end: [number, number] = [value(0), value(1)];
  return { left: end, share: [end[0] / start[0], end[1] / start[1]], seconds: w.tick / TICKS_PER_SECOND };
}

/** Seconds for `budget` gold of one unit type to destroy an undefended enemy HQ. */
export function secondsToKillHq(type: string, budget = 600, game: CompiledGame = GAME): number {
  const w = arena(game);
  const hq = Object.values(game.defs).find((d) => d.isHeadquarters)!;
  const target = spawnEntity(w, 1, hq.id, 1800, 500, game);
  const army = spawnArmy(w, 0, type, budget, 1200, game);
  applyCommand(w, 0, { type: "attack", units: army, target: target.id }, game);
  const max = 300 * TICKS_PER_SECOND;
  while (w.tick < max && w.entities[target.id]) {
    for (const system of ARENA_SYSTEMS) system(w, game);
    w.tick++;
  }
  return w.tick / TICKS_PER_SECOND;
}
