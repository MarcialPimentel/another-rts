/**
 * Tech (GDD: Tech, G3): research at the HQ, Tier 2 unlocks, Weapons/Armour ±15% per level,
 * and Overclock. Also checks the counter loop still holds when both sides are upgraded.
 */
import { describe, expect, it } from "vitest";
import { GAME } from "../shared/data";
import { decodeSnapshot, encodeSnapshot } from "../shared/protocol";
import { applyCommand, parseCommand } from "../shared/sim/commands";
import { hitDamage } from "../shared/sim/damage";
import { step } from "../shared/sim/step";
import { techModifiers } from "../shared/sim/tech";
import { createWorld, entityList, type World } from "../shared/sim/world";
import { battle } from "./helpers/battle";

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(w);
};
const hqOf = (w: World, p: number) => entityList(w).find((e) => e.owner === p && e.type === "hq")!;
const barracksOf = (w: World, p: number) =>
  entityList(w).find((e) => e.owner === p && e.type === "barracks")!;
const research = (w: World, p: number, id: string, building = hqOf(w, p).id) =>
  applyCommand(w, p, { type: "research", building, research: id });

describe("Tier 2 unlocks", () => {
  it("Line, Raider and Ranged train from the start; Siege needs Tier 2", () => {
    const w = createWorld();
    w.players[0]!.gold = 10_000;
    const b = barracksOf(w, 0).id;
    for (const unit of ["line", "raider", "ranged"]) {
      expect(applyCommand(w, 0, { type: "train", building: b, unit }), unit).toBe(true);
    }
    expect(applyCommand(w, 0, { type: "train", building: b, unit: "siege" })).toBe(false);
  });

  it("Tier 2 costs 250 gold, takes 30 seconds, then Siege can be trained", () => {
    const w = createWorld();
    w.players[0]!.gold = 300;
    expect(research(w, 0, "tier2")).toBe(true);
    expect(w.players[0]!.gold).toBe(50);
    run(w, 30 * 20 - 1);
    expect(w.players[0]!.researched).toEqual([]);
    run(w, 1);
    expect(w.players[0]!.researched).toEqual(["tier2"]);
    expect(w.players[0]!.researching).toBeNull();
    w.players[0]!.gold = 500;
    expect(applyCommand(w, 0, { type: "train", building: barracksOf(w, 0).id, unit: "siege" })).toBe(true);
  });
});

describe("research rules", () => {
  it("one research at a time", () => {
    const w = createWorld();
    w.players[0]!.gold = 10_000;
    expect(research(w, 0, "weapons_1")).toBe(true);
    expect(research(w, 0, "armour_1")).toBe(false);
  });

  it("level 2 upgrades and Overclock need their requirements", () => {
    const w = createWorld();
    w.players[0]!.gold = 10_000;
    expect(research(w, 0, "weapons_2")).toBe(false);
    expect(research(w, 0, "overclock")).toBe(false);
    w.players[0]!.researched = ["weapons_1"];
    expect(research(w, 0, "weapons_2")).toBe(false); // still needs Tier 2
    w.players[0]!.researched = ["weapons_1", "tier2"];
    expect(research(w, 0, "weapons_2")).toBe(true);
  });

  it("can't research twice, without gold, at the Barracks or at the enemy HQ", () => {
    const w = createWorld();
    w.players[0]!.researched = ["weapons_1"];
    w.players[0]!.gold = 10_000;
    expect(research(w, 0, "weapons_1")).toBe(false);
    expect(research(w, 0, "armour_1", barracksOf(w, 0).id)).toBe(false);
    expect(research(w, 0, "armour_1", hqOf(w, 1).id)).toBe(false);
    w.players[0]!.gold = 100;
    expect(research(w, 0, "armour_1")).toBe(false);
  });

  it("parses research commands from the network", () => {
    expect(parseCommand({ type: "research", building: 3, research: "tier2", x: 1 })).toEqual({
      type: "research",
      building: 3,
      research: "tier2",
    });
    expect(parseCommand({ type: "research", building: 3 })).toBeNull();
    expect(parseCommand({ type: "research", building: 0, research: "tier2" })).toBeNull();
  });
});

describe("upgrade effects", () => {
  const line = GAME.defs["line"]!;
  const tech = (...ids: string[]) => techModifiers({ researched: ids }, GAME);

  it("Weapons adds 15% damage per level before armour", () => {
    expect(hitDamage(line, line, tech("weapons_1"))).toBeCloseTo(10 * 1.15 - 2);
    expect(hitDamage(line, line, tech("weapons_1", "weapons_2"))).toBeCloseTo(10 * 1.3 - 2);
  });

  it("Armour takes 15% off damage per level, after flat armour", () => {
    expect(hitDamage(line, line, undefined, tech("armour_1"))).toBeCloseTo((10 - 2) * 0.85);
    expect(hitDamage(line, line, undefined, tech("armour_1", "armour_2"))).toBeCloseTo((10 - 2) * 0.7);
  });

  it("Overclock adds 1 gold/s per owned point, not to the HQ", () => {
    const w = createWorld();
    const points = entityList(w).filter((e) => e.type === "point").slice(0, 2);
    for (const p of points) p.owner = 0;
    w.players[0]!.researched = ["tier2", "overclock"];
    const before = w.players[0]!.gold;
    run(w, 20);
    expect(w.players[0]!.gold - before).toBeCloseTo(5 + 2 * (2 + 1));
  });

  it("an upgraded army beats the same army without upgrades", () => {
    const r = battle("line", "line", 600, GAME, [["weapons_1", "armour_1"], []]);
    expect(r.share[0]).toBeGreaterThan(0.3);
    expect(r.share[1]).toBe(0);
  });

  it("the counter loop still holds when both sides are fully upgraded", () => {
    const full = ["tier2", "weapons_1", "weapons_2", "armour_1", "armour_2"];
    for (const [winner, loser] of [
      ["line", "raider"],
      ["raider", "ranged"],
      ["ranged", "line"],
    ] as const) {
      const r = battle(winner, loser, 600, GAME, [full, full]);
      expect(r.share[0], `${winner} vs ${loser}`).toBeGreaterThan(0);
      expect(r.share[1], `${winner} vs ${loser}`).toBe(0);
    }
  });
});

describe("snapshots", () => {
  it("send each player's finished research and the one in progress", () => {
    const w = createWorld();
    w.players[1]!.researched = ["tier2"];
    w.players[0]!.gold = 1000;
    research(w, 0, "weapons_1");
    run(w, 100); // 5 of 20 seconds
    const v = decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot(w, GAME))), GAME.typeIds, GAME.researchIds);
    expect(v.players[0]!.researched).toEqual([]);
    expect(v.players[0]!.researching).toEqual({ id: "weapons_1", progress: 0.25 });
    expect(v.players[1]!.researched).toEqual(["tier2"]);
    expect(v.players[1]!.researching).toBeNull();
  });
});

describe("HQ research buttons", () => {
  const hq = GAME.defs["hq"]!;
  it("show one button per upgrade, moving to level 2 once level 1 is done", async () => {
    const { researchSlots } = await import("../client/src/game/research_slots");
    expect(researchSlots(hq, [], GAME)).toEqual(["tier2", "weapons_1", "armour_1", "overclock"]);
    expect(researchSlots(hq, ["weapons_1"], GAME)).toEqual(["tier2", "weapons_2", "armour_1", "overclock"]);
    expect(researchSlots(hq, ["weapons_1", "weapons_2"], GAME)[1]).toBe("weapons_2");
  });
});
