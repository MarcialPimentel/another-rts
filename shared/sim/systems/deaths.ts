import { TICKS_PER_SECOND } from "../constants";
import type { System } from "../step";

/** How long a death is remembered for clients (one second). */
export const DEATH_MEMORY_TICKS = TICKS_PER_SECOND;

/**
 * Removes entities at 0 HP and clears every reference to them. Deaths are remembered for a
 * second, so a client under fog of war can tell a unit that died from one that left its sight.
 */
export const deaths: System = (world) => {
  world.recentDeaths = world.recentDeaths.filter((d) => world.tick - d.tick < DEATH_MEMORY_TICKS);
  const dead = new Set<number>();
  for (const e of Object.values(world.entities)) {
    if (e.hp <= 0) dead.add(e.id);
  }
  if (dead.size === 0) return;
  for (const id of dead) {
    const e = world.entities[id]!;
    world.recentDeaths.push({ id, owner: e.owner, x: e.x, y: e.y, tick: world.tick });
    delete world.entities[id];
  }
  for (const e of Object.values(world.entities)) {
    if (e.target !== null && dead.has(e.target)) e.target = null;
    if (e.order.kind === "attack" && dead.has(e.order.target)) e.order = { kind: "idle" };
  }
};
