/**
 * Client combat effects are built from successive views. These check the logic (no canvas):
 * a new hit spawns the right kind of shot, HP loss flashes, and a vanished entity bursts.
 */
import { describe, expect, it } from "vitest";
import { Effects } from "../client/src/game/effects";
import { GAME } from "../shared/data";
import { applyCommand } from "../shared/sim/commands";
import { step } from "../shared/sim/step";
import { createWorld, spawnEntity, type World } from "../shared/sim/world";
import { worldToView } from "../shared/view";

/** Steps the world and feeds every tick's view to the effects, 50 ms apart. */
function play(w: World, fx: Effects, ticks: number, start = 0) {
  let now = start;
  for (let i = 0; i < ticks; i++) {
    step(w);
    now += 50;
    fx.observe(worldToView(w), GAME, now);
  }
  return now;
}

function duel(attacker: string) {
  const w = createWorld();
  const a = spawnEntity(w, 0, attacker, 1000, 500);
  const b = spawnEntity(w, 1, "hq", 1000 + 60 + GAME.defs[attacker]!.radius + 5, 500);
  applyCommand(w, 0, { type: "attack", units: [a.id], target: b.id });
  const fx = new Effects();
  fx.observe(worldToView(w), GAME, 0);
  return { w, a, b, fx };
}

describe("combat effects", () => {
  it("draws melee hits as slashes, ranged as tracers and siege as shells", () => {
    for (const [type, kind] of [
      ["line", "slash"],
      ["ranged", "tracer"],
      ["siege", "shell"],
    ] as const) {
      const { w, fx } = duel(type);
      let seen = 0;
      let now = 0;
      for (let i = 0; i < 10; i++) {
        now = play(w, fx, 1, now);
        seen = Math.max(seen, fx.stats().shots[kind]);
      }
      expect(seen, type).toBeGreaterThan(0);
    }
  });

  it("flashes an entity when it loses HP, then fades", () => {
    const { w, b, fx } = duel("line");
    let now = 0;
    let flashed = false;
    for (let i = 0; i < 5 && !flashed; i++) {
      now = play(w, fx, 1, now);
      flashed = fx.flash(b.id, now) > 0;
    }
    expect(flashed).toBe(true);
    expect(fx.flash(b.id, now + 500)).toBe(0);
  });

  it("bursts where a unit dies", () => {
    const w = createWorld();
    const u = spawnEntity(w, 0, "raider", 1000, 500);
    const fx = new Effects();
    fx.observe(worldToView(w), GAME, 0);
    u.hp = 0;
    step(w);
    fx.observe(worldToView(w), GAME, 50);
    expect(fx.stats().bursts).toBe(1);
    expect(fx.stats().ghosts).toBe(0);
  });

  it("fades out, without a burst, a unit that left sight (fog of war)", () => {
    const w = createWorld();
    const u = spawnEntity(w, 1, "raider", 1000, 500);
    const fx = new Effects();
    fx.observe(worldToView(w), GAME, 0);
    delete w.entities[u.id]; // gone from the snapshot, but not in the death list
    fx.observe(worldToView(w), GAME, 50);
    expect(fx.stats().bursts).toBe(0);
    expect(fx.stats().ghosts).toBe(1);
  });

  it("fades in units that appear after the first view", () => {
    const w = createWorld();
    const fx = new Effects();
    fx.observe(worldToView(w), GAME, 0);
    const u = spawnEntity(w, 1, "raider", 1000, 500);
    fx.observe(worldToView(w), GAME, 100);
    expect(fx.alpha(u.id, 100)).toBe(0);
    expect(fx.alpha(u.id, 1000)).toBe(1);
  });

  it("faces the unit toward its target", () => {
    const { w, a, fx } = duel("ranged");
    play(w, fx, 2);
    expect(fx.facing(a.id).x).toBeGreaterThan(0.99);
  });
});
