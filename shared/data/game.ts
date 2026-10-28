/**
 * GAME LAYER — Another RTS content: units, buildings, map and economy.
 * Values match the GDD's Game layer tables and are starting points for playtesting.
 *
 * Counter loop (checked by tests/balance.test.ts):
 *   Line ■ beats Raider ▲ (armour shrugs off small hits)
 *   Raider ▲ beats Ranged ● and Siege ⬢ (closes the gap fast)
 *   Ranged ● beats Line ■ (bonus vs heavy)
 *   Siege ⬢ beats buildings (bonus vs structure) from outside their reach
 *
 * Economy: the HQ pays 5 gold/s; capture points pay on top (+2 each, centre +3).
 *
 * Tech (researched at the HQ, one at a time): Tier 2 unlocks Siege, the second level of Weapons
 * and Armour, and Overclock. Weapons and Armour are ±15% per level for every unit.
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
      researches: ["tier2", "weapons_1", "armour_1", "overclock", "weapons_2", "armour_2"],
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
      captureWeight: 2,
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
      requires: ["tier2"],
    },
    {
      id: "point",
      name: "Capture point",
      description: "Stand on it with no enemies nearby to capture it. Pays its owner gold every second.",
      kind: "point",
      radius: 60,
      hp: 1,
      income: 2,
      captureTime: 8,
    },
    {
      id: "centre_point",
      name: "Centre point",
      description: "The most valuable point on the map.",
      kind: "point",
      radius: 70,
      hp: 1,
      income: 3,
      captureTime: 8,
    },
  ],
  research: [
    {
      id: "tier2",
      name: "Tier 2",
      description: "Unlocks Siege, level 2 upgrades and Overclock.",
      cost: 250,
      time: 30,
      effect: {},
    },
    {
      id: "weapons_1",
      name: "Weapons 1",
      description: "All your units deal 15% more damage.",
      cost: 150,
      time: 20,
      effect: { damage: 0.15 },
    },
    {
      id: "armour_1",
      name: "Armour 1",
      description: "All your units take 15% less damage.",
      cost: 150,
      time: 20,
      effect: { armour: 0.15 },
    },
    {
      id: "weapons_2",
      name: "Weapons 2",
      description: "Another 15% more damage (30% in total).",
      cost: 250,
      time: 25,
      requires: ["weapons_1", "tier2"],
      follows: "weapons_1",
      effect: { damage: 0.15 },
    },
    {
      id: "armour_2",
      name: "Armour 2",
      description: "Another 15% less damage taken (30% in total).",
      cost: 250,
      time: 25,
      requires: ["armour_1", "tier2"],
      follows: "armour_1",
      effect: { armour: 0.15 },
    },
    {
      id: "overclock",
      name: "Overclock",
      description: "Each capture point you own pays +1 gold per second.",
      cost: 150,
      time: 25,
      requires: ["tier2"],
      effect: { pointIncome: 1 },
    },
  ],
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    // One safe point near each base, two contested side points and the centre point.
    points: [
      { type: "point", x: 620, y: 720 },
      { type: "point", x: mirror(620), y: 720 },
      { type: "point", x: MAP_WIDTH / 2, y: 160 },
      { type: "point", x: MAP_WIDTH / 2, y: MAP_HEIGHT - 160 },
      { type: "centre_point", x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    ],
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
    captureWeightCap: 3,
  },
};
