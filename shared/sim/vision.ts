import type { CompiledGame, EntityDef } from "../data";
import type { Entity, World } from "./world";

/** A circle a player can see into, centred on one of their entities. */
export interface VisionCircle {
  x: number;
  y: number;
  r: number;
}

/** How far from its centre an entity sees: its own radius plus its sight. 0 = gives no vision. */
export function visionRadius(def: EntityDef): number {
  return def.sight > 0 ? def.radius + def.sight : 0;
}

/** The vision circles of everything `player` owns. Works on world entities and view entities. */
export function visionCircles(
  entities: Iterable<{ owner: number; type: string; x: number; y: number }>,
  player: number,
  game: CompiledGame,
): VisionCircle[] {
  const circles: VisionCircle[] = [];
  for (const e of entities) {
    if (e.owner !== player) continue;
    const def = game.defs[e.type];
    const r = def ? visionRadius(def) : 0;
    if (r > 0) circles.push({ x: e.x, y: e.y, r });
  }
  return circles;
}

/** True when any part of a circle at (x, y) with `radius` is inside a vision circle. */
export function canSee(circles: readonly VisionCircle[], x: number, y: number, radius = 0): boolean {
  for (const c of circles) {
    const dx = x - c.x;
    const dy = y - c.y;
    const reach = c.r + radius;
    if (dx * dx + dy * dy <= reach * reach) return true;
  }
  return false;
}

/**
 * Fog of war for one player (GDD: Camera and fog of war). The server runs one per player and
 * snapshots only what `apply` returns, so hidden units never reach that player's client.
 *
 * - Own entities: everything.
 * - Enemy units: only while inside your vision.
 * - Enemy buildings: always where they stand, but HP only updates while seen, and their
 *   production queue and rally point stay hidden.
 * - Capture points: ownership always; capture progress only where you can see, or on your own
 *   points (so you notice a raid).
 * - Enemy gold is hidden; research stays public (shown in the top bar).
 * - Deaths: only those you could see, or of your own entities.
 * - Once the match has ended, everything is revealed.
 */
export class PlayerVision {
  /** Last HP seen for each enemy building. */
  private readonly lastSeenHp = new Map<number, number>();

  constructor(readonly player: number) {}

  /** A copy of `world` as this player may see it. Never modifies `world`. */
  apply(world: World, game: CompiledGame): World {
    if (world.status === "ended") return world;
    const circles = visionCircles(Object.values(world.entities), this.player, game);
    const entities: Record<number, Entity> = {};
    for (const e of Object.values(world.entities)) {
      const def = game.defs[e.type]!;
      if (e.owner === this.player) {
        entities[e.id] = e;
        continue;
      }
      const seen = canSee(circles, e.x, e.y, def.radius);
      if (def.kind === "unit") {
        if (seen) entities[e.id] = e;
      } else if (def.kind === "point") {
        entities[e.id] = seen ? e : { ...e, captureBy: -1, captureProgress: 0 };
      } else {
        if (seen) this.lastSeenHp.set(e.id, e.hp);
        entities[e.id] = {
          ...e,
          hp: this.lastSeenHp.get(e.id) ?? def.hp,
          queue: [],
          progress: 0,
          rally: null,
          target: null,
        };
      }
    }
    return {
      ...world,
      players: world.players.map((p) => (p.id === this.player ? p : { ...p, gold: 0 })),
      entities,
      recentDeaths: world.recentDeaths.filter((d) => d.owner === this.player || canSee(circles, d.x, d.y)),
    };
  }
}
