/**
 * Definition format for units and buildings, as written by designers.
 * Durations are in seconds and speeds/rates per second; `compileDefs` converts them to ticks.
 */
export interface EntityDefData {
  /** Stable id used in commands and snapshots, e.g. "line". */
  id: string;
  name: string;
  /** One line for players: the unit's role and what it's good against. Shown in the HUD. */
  description?: string;
  /**
   * "point" is a capture point: a map object with no HP that units never attack or bump into.
   * It starts neutral and belongs to whoever captured it last.
   */
  kind: EntityKind;
  /** Collision and selection radius in pixels. */
  radius: number;
  hp: number;
  /** Gold cost to train. Buildings in the PoC are pre-placed and have no cost. */
  cost?: number;
  /** Seconds to train. */
  buildTime?: number;
  /** Movement speed in px/s. Present only on things that move. */
  speed?: number;
  /** How the client draws it. Presentation only; the simulation ignores it. Default "circle". */
  shape?: Shape;
  /** Armour tags that attack bonuses refer to, e.g. "light", "heavy", "structure". */
  tags?: string[];
  /** Flat damage reduction per hit received. A hit always deals at least 1 damage. */
  armor?: number;
  /**
   * Attack: damage per hit, seconds between hits, range in px from edge to edge, and optional
   * damage multipliers against targets with a tag (e.g. `{ heavy: 2 }`). Armour applies after bonuses.
   */
  attack?: { damage: number; interval: number; range: number; bonus?: Record<string, number> };
  /**
   * Distance in px (edge to edge) at which idle units notice enemies. Also how far this entity
   * sees through fog of war; entities with no sight give no vision.
   */
  sight?: number;
  /** Gold per second this entity gives its owner. */
  income?: number;
  /** Units only: research ids the owner must have finished before training this unit. */
  requires?: string[];
  /** Buildings only: research ids this building can research (one at a time per player). */
  researches?: string[];
  /** Unit ids this building can train, and how many can queue. */
  produces?: string[];
  queueMax?: number;
  /** Losing every entity with this flag loses the match. */
  isHeadquarters?: boolean;
  /** Points only: seconds for one unit to capture it (or neutralize an enemy's). Radius is the capture area. */
  captureTime?: number;
  /** Units only: how much this unit counts when capturing (default 1; Raiders 2). */
  captureWeight?: number;
}

export type EntityKind = "unit" | "building" | "point";

/**
 * One research (an upgrade bought at the HQ). Each level of an upgrade is its own research, so
 * "Weapons 2" requires "weapons_1". Effects add up across everything a player has researched.
 */
export interface ResearchData {
  id: string;
  name: string;
  /** One line for players, shown in the HUD. */
  description: string;
  /** Gold, paid when research starts. */
  cost: number;
  /** Seconds to research. */
  time: number;
  /** Research ids that must be finished first. */
  requires?: string[];
  /**
   * The previous level of the same upgrade (e.g. Weapons 2 follows "weapons_1"). The HUD shows
   * one button per upgrade, which moves on to the next level once the previous one is done.
   */
  follows?: string;
  effect: ResearchEffect;
}

export interface ResearchEffect {
  /** Extra damage dealt by all your units, as a fraction (0.15 = +15%). */
  damage?: number;
  /** Less damage taken by all your units, as a fraction (0.15 = 15% less). */
  armour?: number;
  /** Extra gold per second from each capture point you own. */
  pointIncome?: number;
}

/** A research after unit conversion. */
export interface Research {
  id: string;
  name: string;
  description: string;
  cost: number;
  ticks: number;
  requires: string[];
  follows: string | null;
  effect: Required<ResearchEffect>;
}

export type Shape = "circle" | "square" | "triangle" | "hexagon";

/** A definition after unit conversion, used by the simulation. */
export interface EntityDef {
  id: string;
  name: string;
  description: string;
  kind: EntityKind;
  radius: number;
  hp: number;
  cost: number;
  buildTicks: number;
  shape: Shape;
  tags: string[];
  armor: number;
  /** px per tick; 0 when the entity can't move. */
  speedPerTick: number;
  attack: { damage: number; intervalTicks: number; range: number; bonus: Record<string, number> } | null;
  sight: number;
  incomePerTick: number;
  produces: string[];
  queueMax: number;
  isHeadquarters: boolean;
  requires: string[];
  researches: string[];
  /** Ticks for one unit to capture this point; 0 for anything that isn't a point. */
  captureTicks: number;
  captureWeight: number;
}

export interface StartingEntity {
  type: string;
  x: number;
  y: number;
}

export interface MapData {
  width: number;
  height: number;
  /** Capture points, neutral at the start of a match. */
  points: StartingEntity[];
  /** Starting entities for each player slot, in slot order. */
  bases: { entities: StartingEntity[]; rally: { x: number; y: number } }[];
}

export interface EconomyData {
  startingGold: number;
  /** Max units (alive plus queued) per player. */
  unitCap: number;
  /** Total capture weight that counts on a point; more units than this don't capture faster. */
  captureWeightCap: number;
}

export interface GameData {
  defs: EntityDefData[];
  research: ResearchData[];
  map: MapData;
  economy: EconomyData;
}
