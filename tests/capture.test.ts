/**
 * Capture points (GDD: Economy, G2): neutral at the start, captured by standing on them, kept
 * after leaving, paused while contested, and paying gold on top of the HQ.
 */
import { describe, expect, it } from "vitest";
import { GAME } from "../shared/data";
import { decodeSnapshot, encodeSnapshot } from "../shared/protocol";
import { applyCommand } from "../shared/sim/commands";
import { step } from "../shared/sim/step";
import { createWorld, entityList, NEUTRAL, spawnEntity, type Entity, type World } from "../shared/sim/world";

const run = (w: World, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(w);
};
/** The bottom side point: away from both bases, so nothing else wanders in. */
const sidePoint = (w: World): Entity =>
  entityList(w).find((e) => e.type === "point" && e.x === GAME.map.width / 2 && e.y > GAME.map.height / 2)!;
const place = (w: World, owner: number, type: string, at: Entity, n = 1) =>
  Array.from({ length: n }, () => spawnEntity(w, owner, type, at.x, at.y));

const CAPTURE = 160; // 8 s for one unit

describe("capture points", () => {
  it("start neutral", () => {
    const w = createWorld();
    const points = entityList(w).filter((e) => GAME.defs[e.type]!.kind === "point");
    expect(points).toHaveLength(5);
    for (const p of points) expect(p.owner).toBe(NEUTRAL);
  });

  it("one unit captures a neutral point in 8 seconds", () => {
    const w = createWorld();
    const p = sidePoint(w);
    place(w, 0, "line", p);
    run(w, CAPTURE - 1);
    expect(p.owner).toBe(NEUTRAL);
    expect(p.captureBy).toBe(0);
    run(w, 1);
    expect(p.owner).toBe(0);
  });

  it("more units capture faster, up to a weight of 3", () => {
    for (const [n, ticks] of [
      [3, Math.ceil(CAPTURE / 3)],
      [6, Math.ceil(CAPTURE / 3)],
    ] as const) {
      const w = createWorld();
      const p = sidePoint(w);
      place(w, 0, "line", p, n);
      run(w, ticks - 1);
      expect(p.owner, `${n} units`).toBe(NEUTRAL);
      run(w, 1);
      expect(p.owner, `${n} units`).toBe(0);
    }
  });

  it("Raiders count double", () => {
    const w = createWorld();
    const p = sidePoint(w);
    place(w, 0, "raider", p);
    run(w, CAPTURE / 2);
    expect(p.owner).toBe(0);
  });

  it("stays captured after the units leave", () => {
    const w = createWorld();
    const p = sidePoint(w);
    const [u] = place(w, 0, "raider", p);
    run(w, CAPTURE / 2);
    applyCommand(w, 0, { type: "move", units: [u!.id], x: 600, y: 500 });
    run(w, 200);
    expect(p.owner).toBe(0);
  });

  it("pauses while both players have units on it", () => {
    const w = createWorld();
    const p = sidePoint(w);
    const [a] = place(w, 0, "line", p);
    run(w, 50);
    const before = p.captureProgress;
    const [b] = place(w, 1, "line", p);
    run(w, 10);
    expect(a!.hp).toBeGreaterThan(0);
    expect(b!.hp).toBeGreaterThan(0);
    expect(p.captureProgress).toBe(before);
    expect(p.owner).toBe(NEUTRAL);
  });

  it("an enemy point is made neutral first, then captured", () => {
    const w = createWorld();
    const p = sidePoint(w);
    p.owner = 1;
    place(w, 0, "line", p);
    run(w, CAPTURE);
    expect(p.owner).toBe(NEUTRAL);
    run(w, CAPTURE);
    expect(p.owner).toBe(0);
  });

  it("unfinished progress drains away when nobody is on the point", () => {
    const w = createWorld();
    const p = sidePoint(w);
    const [u] = place(w, 0, "line", p);
    run(w, 40);
    delete w.entities[u!.id];
    run(w, 41);
    expect(p.captureProgress).toBe(0);
    expect(p.captureBy).toBe(NEUTRAL);
  });

  it("the owner standing on their point wipes out an enemy's partial capture", () => {
    const w = createWorld();
    const p = sidePoint(w);
    p.owner = 1;
    p.captureBy = 0;
    p.captureProgress = 90;
    place(w, 1, "line", p, 3);
    run(w, 30);
    expect(p.captureProgress).toBe(0);
    expect(p.owner).toBe(1);
  });

  it("pays its owner on top of the HQ: +2 gold/s, centre +3", () => {
    const w = createWorld();
    const side = sidePoint(w);
    const centre = entityList(w).find((e) => e.type === "centre_point")!;
    side.owner = 0;
    centre.owner = 0;
    const before = [w.players[0]!.gold, w.players[1]!.gold];
    run(w, 20);
    expect(w.players[0]!.gold - before[0]!).toBeCloseTo(5 + 2 + 3);
    expect(w.players[1]!.gold - before[1]!).toBeCloseTo(5);
  });

  it("can't be attacked: attack commands are dropped and idle units ignore enemy points", () => {
    const w = createWorld();
    const p = sidePoint(w);
    p.owner = 1;
    const [u] = place(w, 0, "line", p);
    u!.x -= 100;
    expect(applyCommand(w, 0, { type: "attack", units: [u!.id], target: p.id })).toBe(false);
    step(w);
    expect(u!.target).toBeNull();
    expect(p.hp).toBe(GAME.defs["point"]!.hp);
  });

  it("sends ownership and capture progress in snapshots", () => {
    const w = createWorld();
    const p = sidePoint(w);
    place(w, 0, "line", p);
    run(w, 40);
    const v = decodeSnapshot(JSON.parse(JSON.stringify(encodeSnapshot(w, GAME))), GAME.typeIds, GAME.researchIds);
    const seen = v.entities.find((e) => e.id === p.id)!;
    expect(seen.owner).toBe(NEUTRAL);
    expect(seen.capture).toEqual({ by: 0, progress: 0.25 });
    expect(v.entities.find((e) => e.type === "hq")!.capture).toBeNull();
  });
});
