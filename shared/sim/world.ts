import { GAME, type CompiledGame } from "../data";

/** Owner of a capture point nobody holds. */
export const NEUTRAL = -1;

export interface Vec {
  x: number;
  y: number;
}

/** What a unit has been told to do. Set by commands; read by systems. */
export type Order =
  | { kind: "idle" }
  | { kind: "move"; x: number; y: number }
  | { kind: "attack"; target: number }
  | { kind: "attack_move"; x: number; y: number };

/**
 * One unit or building. All fields are plain data so the world can be serialized as is.
 * Fields that don't apply to an entity's type keep neutral values (e.g. buildings stay "idle").
 */
export interface Entity {
  id: number;
  owner: number;
  type: string;
  x: number;
  y: number;
  hp: number;
  /** Current order (units). */
  order: Order;
  /** Entity currently being fought, chosen by the targeting system. */
  target: number | null;
  /** Ticks until this entity can attack again. */
  cooldown: number;
  /** Tick of this entity's most recent hit, or -1. Lets clients draw shots. */
  lastAttackTick: number;
  /** Production queue of unit type ids (producers). */
  queue: string[];
  /** Ticks spent on the first item in the queue. */
  progress: number;
  /** Where newly trained units walk to (producers). */
  rally: Vec | null;
  /** Points: the player whose capture is in progress, or NEUTRAL. */
  captureBy: number;
  /** Points: ticks of capture progress by `captureBy` (full at the point's captureTicks). */
  captureProgress: number;
}

export interface PlayerState {
  id: number;
  gold: number;
  defeated: boolean;
  /** Finished research ids, in the order they finished. */
  researched: string[];
  /** Research in progress at the HQ (one at a time), or null. */
  researching: string | null;
  /** Ticks spent on `researching`. */
  researchProgress: number;
}

/** An entity that died recently, so clients can tell a death from leaving their sight. */
export interface RecentDeath {
  id: number;
  owner: number;
  x: number;
  y: number;
  tick: number;
}

export interface World {
  tick: number;
  /** Next entity id. Ids are never reused within a match. */
  nextId: number;
  players: PlayerState[];
  /** Entities keyed by id. Integer keys keep iteration in ascending id order. */
  entities: Record<number, Entity>;
  status: "playing" | "ended";
  /** Winning player id, or null for a draw or while playing. */
  winner: number | null;
  endReason: string | null;
  /** Deaths in the last second (see deaths system), for drawing death bursts under fog of war. */
  recentDeaths: RecentDeath[];
}

/** Adds an entity of `type` for `owner` at a position and returns it. */
export function spawnEntity(
  world: World,
  owner: number,
  type: string,
  x: number,
  y: number,
  game: CompiledGame = GAME,
): Entity {
  const def = game.defs[type];
  if (!def) throw new Error(`Unknown entity type "${type}"`);
  const entity: Entity = {
    id: world.nextId++,
    owner,
    type,
    x,
    y,
    hp: def.hp,
    order: { kind: "idle" },
    target: null,
    cooldown: 0,
    lastAttackTick: -1,
    queue: [],
    progress: 0,
    rally: null,
    captureBy: NEUTRAL,
    captureProgress: 0,
  };
  world.entities[entity.id] = entity;
  return entity;
}

/** Creates the starting world: each player's base from the map, and starting gold. */
export function createWorld(game: CompiledGame = GAME, playerCount = game.map.bases.length): World {
  const world: World = {
    tick: 0,
    nextId: 1,
    players: [],
    entities: {},
    status: "playing",
    winner: null,
    endReason: null,
    recentDeaths: [],
  };
  for (const point of game.map.points) spawnEntity(world, NEUTRAL, point.type, point.x, point.y, game);
  for (let p = 0; p < playerCount; p++) {
    world.players.push({
      id: p,
      gold: game.economy.startingGold,
      defeated: false,
      researched: [],
      researching: null,
      researchProgress: 0,
    });
    const base = game.map.bases[p];
    if (!base) throw new Error(`Map has no base for player ${p}`);
    for (const start of base.entities) {
      const e = spawnEntity(world, p, start.type, start.x, start.y, game);
      if (game.defs[start.type]!.produces.length > 0) e.rally = { ...base.rally };
    }
  }
  return world;
}

/** Entities in ascending id order. Systems iterate in this order so results are deterministic. */
export function entityList(world: World): Entity[] {
  return Object.values(world.entities);
}

/** Whether units can attack this kind of entity. Capture points can't be attacked. */
export function isAttackable(e: Entity, game: CompiledGame): boolean {
  return game.defs[e.type]!.kind !== "point";
}

export function getEntity(world: World, id: number | null | undefined): Entity | undefined {
  return id === null || id === undefined ? undefined : world.entities[id];
}
