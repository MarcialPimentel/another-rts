import { GAME, type CompiledGame } from "./data";
import type { Vec, World } from "./sim/world";

/** What a client needs to draw one entity. */
export interface ViewEntity {
  id: number;
  type: string;
  owner: number;
  x: number;
  y: number;
  hp: number;
  /** Entity this one is fighting, or null. */
  target: number | null;
  /** Tick of its most recent hit, or -1 (for drawing shots). */
  lastAttackTick: number;
  /** Production queue (producers only; empty otherwise). */
  queue: string[];
  /** Progress of the first queued item, 0..1. */
  progress: number;
  rally: Vec | null;
  /** Capture points only: who is capturing (a player id, or -1) and how far, 0..1. */
  capture: { by: number; progress: number } | null;
}

export interface ViewPlayer {
  id: number;
  gold: number;
  defeated: boolean;
  /** Finished research ids. */
  researched: string[];
  /** Research in progress, with progress 0..1, or null. */
  researching: { id: string; progress: number } | null;
}

/** A drawable picture of the world at one tick. Built from the World locally or from a snapshot. */
export interface ViewState {
  tick: number;
  players: ViewPlayer[];
  entities: ViewEntity[];
  status: "playing" | "ended";
  winner: number | null;
  endReason: string | null;
}

export function worldToView(world: World, game: CompiledGame = GAME): ViewState {
  return {
    tick: world.tick,
    players: world.players.map((p) => ({
      id: p.id,
      gold: Math.floor(p.gold),
      defeated: p.defeated,
      researched: [...p.researched],
      researching: p.researching
        ? { id: p.researching, progress: Math.min(1, p.researchProgress / game.research[p.researching]!.ticks) }
        : null,
    })),
    entities: Object.values(world.entities).map((e) => {
      const def = game.defs[e.type]!;
      const next = e.queue[0];
      const total = next ? game.defs[next]!.buildTicks : 0;
      return {
        id: e.id,
        type: e.type,
        owner: e.owner,
        x: e.x,
        y: e.y,
        hp: e.hp,
        target: e.target,
        lastAttackTick: e.lastAttackTick,
        queue: [...e.queue],
        progress: total > 0 ? Math.min(1, e.progress / total) : 0,
        rally: e.rally ? { ...e.rally } : null,
        capture:
          def.kind === "point"
            ? { by: e.captureBy, progress: Math.min(1, e.captureProgress / def.captureTicks) }
            : null,
      };
    }),
    status: world.status,
    winner: world.winner,
    endReason: world.endReason,
  };
}

/**
 * Blends entity positions between two views (`t` from 0 to 1). Everything else comes from `next`.
 * Entities that only exist in `next` appear at their new position.
 */
export function interpolateView(prev: ViewState, next: ViewState, t: number): ViewState {
  const clamped = Math.min(1, Math.max(0, t));
  const before = new Map(prev.entities.map((e) => [e.id, e]));
  return {
    ...next,
    entities: next.entities.map((e) => {
      const p = before.get(e.id);
      if (!p) return e;
      return { ...e, x: p.x + (e.x - p.x) * clamped, y: p.y + (e.y - p.y) * clamped };
    }),
  };
}
