import { perSecondToPerTick, secondsToTicks } from "../sim/constants";
import { GAME_DATA } from "./game";
import type { EntityDef, EntityDefData, GameData, Research, ResearchData } from "./types";

export type {
  EntityDef,
  EntityDefData,
  EntityKind,
  GameData,
  MapData,
  EconomyData,
  Research,
  ResearchData,
  ResearchEffect,
  Shape,
} from "./types";

/** Converts designer-facing definitions (seconds, per-second rates) into tick-based ones. */
export function compileDef(d: EntityDefData): EntityDef {
  return {
    id: d.id,
    name: d.name,
    description: d.description ?? "",
    kind: d.kind,
    radius: d.radius,
    hp: d.hp,
    shape: d.shape ?? "circle",
    tags: d.tags ?? [],
    armor: d.armor ?? 0,
    cost: d.cost ?? 0,
    buildTicks: d.buildTime !== undefined ? secondsToTicks(d.buildTime) : 0,
    speedPerTick: d.speed !== undefined ? perSecondToPerTick(d.speed) : 0,
    attack: d.attack
      ? {
          damage: d.attack.damage,
          intervalTicks: secondsToTicks(d.attack.interval),
          range: d.attack.range,
          bonus: d.attack.bonus ?? {},
        }
      : null,
    sight: d.sight ?? 0,
    incomePerTick: d.income !== undefined ? perSecondToPerTick(d.income) : 0,
    produces: d.produces ?? [],
    queueMax: d.queueMax ?? 0,
    isHeadquarters: d.isHeadquarters ?? false,
    requires: d.requires ?? [],
    researches: d.researches ?? [],
    captureTicks: d.kind === "point" ? secondsToTicks(d.captureTime ?? 8) : 0,
    captureWeight: d.kind === "unit" ? (d.captureWeight ?? 1) : 0,
  };
}

export function compileResearch(r: ResearchData): Research {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    cost: r.cost,
    ticks: secondsToTicks(r.time),
    requires: r.requires ?? [],
    follows: r.follows ?? null,
    effect: {
      damage: r.effect.damage ?? 0,
      armour: r.effect.armour ?? 0,
      pointIncome: r.effect.pointIncome ?? 0,
    },
  };
}

/** The compiled game the simulation runs: definitions by id plus map and economy. */
export interface CompiledGame {
  defs: Record<string, EntityDef>;
  research: Record<string, Research>;
  /** Research ids in a stable order, used to encode research compactly in snapshots. */
  researchIds: string[];
  /** Definition ids in a stable order, used to encode types compactly in snapshots. */
  typeIds: string[];
  map: GameData["map"];
  economy: GameData["economy"];
}

export function compileGame(data: GameData): CompiledGame {
  const defs: Record<string, EntityDef> = {};
  for (const d of data.defs) {
    if (defs[d.id]) throw new Error(`Duplicate definition id "${d.id}"`);
    defs[d.id] = compileDef(d);
  }
  for (const d of Object.values(defs)) {
    for (const p of d.produces) {
      if (!defs[p]) throw new Error(`"${d.id}" produces unknown type "${p}"`);
    }
  }
  const research: Record<string, Research> = {};
  for (const r of data.research) {
    if (research[r.id]) throw new Error(`Duplicate research id "${r.id}"`);
    research[r.id] = compileResearch(r);
  }
  const knownResearch = (id: string, by: string) => {
    if (!research[id]) throw new Error(`"${by}" refers to unknown research "${id}"`);
  };
  for (const r of Object.values(research)) {
    for (const q of r.requires) knownResearch(q, r.id);
    if (r.follows) knownResearch(r.follows, r.id);
  }
  for (const d of Object.values(defs)) {
    for (const q of d.requires) knownResearch(q, d.id);
    for (const q of d.researches) knownResearch(q, d.id);
  }
  for (const p of data.map.points) {
    if (defs[p.type]?.kind !== "point") throw new Error(`Map point uses "${p.type}", which isn't a point`);
  }
  return {
    defs,
    research,
    researchIds: data.research.map((r) => r.id),
    typeIds: data.defs.map((d) => d.id),
    map: data.map,
    economy: data.economy,
  };
}

/** The game this build plays. */
export const GAME: CompiledGame = compileGame(GAME_DATA);
