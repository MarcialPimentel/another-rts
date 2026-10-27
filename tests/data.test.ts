import { describe, expect, it } from "vitest";
import { GAME, compileGame } from "../shared/data";
import { GAME_DATA } from "../shared/data/game";

describe("game data", () => {
  it("converts seconds and per-second rates to ticks", () => {
    const line = GAME.defs["line"]!;
    expect(line.buildTicks).toBe(120); // 6 s
    expect(line.speedPerTick).toBeCloseTo(3.5); // 70 px/s
    expect(line.attack?.intervalTicks).toBe(20); // 1 s
    expect(GAME.defs["raider"]!.attack?.intervalTicks).toBe(12); // 0.6 s
    expect(GAME.defs["hq"]!.incomePerTick).toBeCloseTo(0.25); // 5 gold/s
  });

  it("matches the GDD's Game layer stats", () => {
    expect(GAME.defs["hq"]!.hp).toBe(2000);
    expect(GAME.defs["barracks"]!.hp).toBe(1000);
    expect(GAME.defs["barracks"]!.queueMax).toBe(5);
    expect(GAME.defs["barracks"]!.produces).toEqual(["line", "raider", "ranged", "siege"]);
    const costs = ["line", "raider", "ranged", "siege"].map((id) => GAME.defs[id]!.cost);
    expect(costs).toEqual([60, 50, 70, 120]);
    expect(GAME.defs["ranged"]!.attack?.bonus).toEqual({ heavy: 3 });
    expect(GAME.defs["siege"]!.attack?.bonus).toEqual({ structure: 3 });
    expect(GAME.economy).toEqual({ startingGold: 200, unitCap: 30 });
  });

  it("gives both players a headquarters on a mirrored map", () => {
    expect(GAME.map.bases).toHaveLength(2);
    const [a, b] = GAME.map.bases;
    expect(a!.entities.length).toBe(b!.entities.length);
    a!.entities.forEach((e, i) => {
      expect(b!.entities[i]!.x).toBe(GAME.map.width - e.x);
      expect(b!.entities[i]!.y).toBe(e.y);
    });
    expect(a!.entities.some((e) => GAME.defs[e.type]?.isHeadquarters)).toBe(true);
  });

  it("rejects a building that produces an unknown type", () => {
    const bad = structuredClone(GAME_DATA);
    bad.defs[1]!.produces = ["dragon"];
    expect(() => compileGame(bad)).toThrow(/unknown type/);
  });
});
