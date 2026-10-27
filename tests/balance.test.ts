/**
 * The counter loop from the GDD's Game layer, checked with equal-gold battles at three army sizes.
 * A stat change in shared/data/game.ts that breaks a counter fails here.
 */
import { describe, expect, it } from "vitest";
import { hitDamage } from "../shared/sim/damage";
import { GAME } from "../shared/data";
import { battle, secondsToKillHq } from "./helpers/battle";

const BUDGETS = [300, 600, 1200];

/** [winner, loser]: the winner should clearly beat the loser for the same gold. */
const COUNTERS: [string, string][] = [
  ["line", "raider"],
  ["raider", "ranged"],
  ["raider", "siege"],
  ["ranged", "line"],
  ["ranged", "siege"],
  ["line", "siege"],
];

describe("damage rule", () => {
  const d = (a: string, t: string) => hitDamage(GAME.defs[a]!, GAME.defs[t]!);
  it("subtracts armour after the tag bonus, never below 1", () => {
    expect(d("line", "line")).toBe(8); // 10 - 2 armour
    expect(d("ranged", "line")).toBe(28); // 10 × 3 vs heavy - 2
    expect(d("ranged", "raider")).toBe(10); // no bonus vs light
    expect(d("siege", "hq")).toBe(105); // 36 × 3 vs structure - 3
    expect(d("raider", "hq")).toBe(4); // 7 - 3
  });
  it("deals at least 1 damage", () => {
    const weak = { ...GAME.defs["raider"]!, attack: { ...GAME.defs["raider"]!.attack!, damage: 1 } };
    expect(hitDamage(weak, GAME.defs["hq"]!)).toBe(1);
  });
});

describe("counter loop (equal gold)", () => {
  for (const [winner, loser] of COUNTERS) {
    for (const budget of BUDGETS) {
      it(`${winner} beats ${loser} with ${budget} gold each`, () => {
        // Run both sides of the map so spawn position can't decide it.
        for (const [a, b, wi] of [
          [winner, loser, 0],
          [loser, winner, 1],
        ] as const) {
          const r = battle(a, b, budget);
          expect(r.share[wi]).toBeGreaterThanOrEqual(0.25);
          expect(r.share[1 - wi]).toBe(0);
        }
      });
    }
  }
});

describe("siege role", () => {
  it("kills an HQ at least 1.5× as fast as any other unit for the same gold, despite walking slower", () => {
    const siege = secondsToKillHq("siege");
    for (const other of ["line", "raider", "ranged"]) {
      expect(secondsToKillHq(other)).toBeGreaterThanOrEqual(siege * 1.5);
    }
  });
});
