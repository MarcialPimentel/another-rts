/**
 * GAME LAYER — Another RTS content: units, buildings, map and economy.
 * Values match the GDD's Game layer tables and are starting points for playtesting.
 *
 * Counter loop (checked by tests/balance.test.ts):
 *   Line ■ beats Raider ▲ (armour shrugs off small hits)
 *   Raider ▲ beats Ranged ● and Siege ⬢ (closes the gap fast)
 *   Ranged ● beats Line ■ (bonus vs heavy)
 *   Siege ⬢ beats buildings (bonus vs structure) from outside their reach
 */
import type { GameData } from "./types";

const MAP_WIDTH = 2400;
const MAP_HEIGHT = 1000;

/** Mirrors a left-side x coordinate to the right side of the map. */
const mirror = (x: number) => MAP_WIDTH - x;

export const GAME_DATA: GameData = {
  defs: [
    {
      id: "hq",
      name: "HQ",
      kind: "building",
      shape: "square",
      tags: ["structure"],
      radius: 60,
      hp: 2000,
      armor: 3,
      income: 5,
      isHeadquarters: true,
    },
    {
      id: "barracks",
      name: "Barracks",
      kind: "building",
      shape: "square",
      tags: ["structure"],
      radius: 45,
      hp: 1000,
      armor: 3,
      produces: ["line", "raider", "ranged", "siege"],
      queueMax: 5,
    },
    {
      id: "line",
      name: "Line",
      description: "Armoured melee front line. Beats Raiders; weak to Ranged.",
      kind: "unit",
      shape: "square",
      tags: ["heavy"],
      radius: 12,
      hp: 160,
      armor: 2,
      cost: 60,
      buildTime: 6,
      speed: 70,
      attack: { damage: 10, interval: 1.0, range: 20 },
      sight: 250,
    },
    {
      id: "raider",
      name: "Raider",
      description: "Fast, fragile skirmisher. Beats Ranged and Siege; weak to Line.",
      kind: "unit",
      shape: "triangle",
      tags: ["light"],
      radius: 9,
      hp: 75,
      armor: 0,
      cost: 50,
      buildTime: 4,
      speed: 140,
      attack: { damage: 7, interval: 0.6, range: 15 },
      sight: 280,
    },
    {
      id: "ranged",
      name: "Ranged",
      description: "Shoots from behind the line, triple damage to armoured units. Beats Line and Siege; weak to Raiders.",
      kind: "unit",
      shape: "circle",
      tags: ["light"],
      radius: 9,
      hp: 70,
      armor: 0,
      cost: 70,
      buildTime: 6,
      speed: 80,
      attack: { damage: 10, interval: 1.0, range: 140, bonus: { heavy: 3 } },
      sight: 280,
    },
    {
      id: "siege",
      name: "Siege",
      description: "Very long range, triple damage to buildings. Loses open fights, so escort it.",
      kind: "unit",
      shape: "hexagon",
      tags: ["heavy"],
      radius: 15,
      hp: 120,
      armor: 1,
      cost: 120,
      buildTime: 9,
      speed: 50,
      attack: { damage: 36, interval: 3.0, range: 260, bonus: { structure: 3 } },
      sight: 300,
    },
  ],
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    bases: [
      {
        entities: [
          { type: "hq", x: 200, y: 500 },
          { type: "barracks", x: 380, y: 330 },
        ],
        rally: { x: 480, y: 420 },
      },
      {
        entities: [
          { type: "hq", x: mirror(200), y: 500 },
          { type: "barracks", x: mirror(380), y: 330 },
        ],
        rally: { x: mirror(480), y: 420 },
      },
    ],
  },
  economy: {
    startingGold: 200,
    unitCap: 30,
  },
};
