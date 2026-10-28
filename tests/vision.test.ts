/**
 * Fog of war (GDD: Camera and fog of war, G4): each player's snapshot only carries what they
 * can see. These run the filter directly on simulation worlds.
 */
import { describe, expect, it } from "vitest";
import { GAME } from "../shared/data";
import { decodeSnapshot, encodeSnapshot } from "../shared/protocol";
import { step } from "../shared/sim/step";
import { canSee, PlayerVision, visionCircles, visionRadius } from "../shared/sim/vision";
import { createWorld, entityList, spawnEntity, type World } from "../shared/sim/world";
import { worldToView } from "../shared/view";

const MID_X = GAME.map.width / 2;
const ids = (w: World) => entityList(w).map((e) => e.id);
const find = (w: World, owner: number, type: string) => entityList(w).find((e) => e.owner === owner && e.type === type)!;
const bottomPoint = (w: World) => entityList(w).find((e) => e.type === "point" && e.x === MID_X && e.y > 500)!;

describe("fog of war", () => {
  it("hides enemy units outside your vision and shows them inside it", () => {
    const w = createWorld();
    const far = spawnEntity(w, 1, "raider", MID_X, 500);
    const v0 = new PlayerVision(0);
    expect(ids(v0.apply(w, GAME))).not.toContain(far.id);

    const scout = spawnEntity(w, 0, "raider", MID_X - 200, 500);
    expect(ids(v0.apply(w, GAME))).toContain(far.id);

    // Just out of reach: the edge of the enemy is past the scout's vision circle.
    scout.x = MID_X - visionRadius(GAME.defs.raider!) - GAME.defs.raider!.radius - 2;
    expect(ids(v0.apply(w, GAME))).not.toContain(far.id);
  });

  it("always shows your own entities, every building and every point", () => {
    const w = createWorld();
    const mine = spawnEntity(w, 0, "line", 100, 900);
    const seen = new PlayerVision(0).apply(w, GAME);
    expect(ids(seen)).toContain(mine.id);
    for (const e of entityList(w)) {
      if (GAME.defs[e.type]!.kind !== "unit") expect(ids(seen)).toContain(e.id);
    }
  });

  it("only updates an enemy building's HP while you can see it, and hides its production", () => {
    const w = createWorld();
    const barracks = find(w, 1, "barracks");
    const v0 = new PlayerVision(0);
    barracks.queue = ["line"];
    barracks.hp = 900;
    let seen = new Map(entityList(v0.apply(w, GAME)).map((e) => [e.id, e]));
    expect(seen.get(barracks.id)!.hp).toBe(GAME.defs.barracks!.hp); // never seen: full
    expect(seen.get(barracks.id)!.queue).toEqual([]);
    expect(seen.get(barracks.id)!.rally).toBeNull();

    const scout = spawnEntity(w, 0, "raider", barracks.x - 150, barracks.y);
    seen = new Map(entityList(v0.apply(w, GAME)).map((e) => [e.id, e]));
    expect(seen.get(barracks.id)!.hp).toBe(900);
    expect(seen.get(barracks.id)!.queue).toEqual([]);

    delete w.entities[scout.id];
    barracks.hp = 500;
    seen = new Map(entityList(v0.apply(w, GAME)).map((e) => [e.id, e]));
    expect(seen.get(barracks.id)!.hp).toBe(900); // last seen
  });

  it("shows capture progress only where you can see, or on your own points", () => {
    const w = createWorld();
    const point = bottomPoint(w);
    spawnEntity(w, 1, "line", point.x, point.y);
    for (let i = 0; i < 40; i++) step(w);
    expect(point.captureBy).toBe(1);

    const v0 = new PlayerVision(0);
    const hidden = v0.apply(w, GAME).entities[point.id]!;
    expect(hidden.captureBy).toBe(-1);
    expect(hidden.captureProgress).toBe(0);

    // Your own point being taken: you always see the progress, as a warning.
    point.owner = 0;
    point.captureProgress = 0;
    for (let i = 0; i < 40; i++) step(w);
    const warned = v0.apply(w, GAME).entities[point.id]!;
    expect(warned.captureBy).toBe(1);
    expect(warned.captureProgress).toBeGreaterThan(0);
  });

  it("hides the enemy's gold but not their research", () => {
    const w = createWorld();
    w.players[1]!.researched.push("tier2");
    const seen = new PlayerVision(0).apply(w, GAME);
    expect(seen.players[0]!.gold).toBe(w.players[0]!.gold);
    expect(seen.players[1]!.gold).toBe(0);
    expect(seen.players[1]!.researched).toEqual(["tier2"]);
  });

  it("reports deaths you could see, so clients can tell a death from leaving sight", () => {
    const w = createWorld();
    const near = spawnEntity(w, 1, "raider", 500, 500);
    const far = spawnEntity(w, 1, "raider", MID_X, 900);
    spawnEntity(w, 0, "line", 450, 500);
    near.hp = 0;
    far.hp = 0;
    step(w);
    expect(w.recentDeaths.map((d) => d.id).sort()).toEqual([near.id, far.id].sort());
    const view = worldToView(new PlayerVision(0).apply(w, GAME));
    expect(view.deaths).toContain(near.id);
    expect(view.deaths).not.toContain(far.id);
    // Deaths are forgotten after a second.
    for (let i = 0; i < 25; i++) step(w);
    expect(w.recentDeaths).toEqual([]);
  });

  it("reveals everything once the match has ended", () => {
    const w = createWorld();
    const far = spawnEntity(w, 1, "raider", MID_X, 500);
    w.status = "ended";
    expect(ids(new PlayerVision(0).apply(w, GAME))).toContain(far.id);
  });

  it("never changes the real world, and survives the snapshot codec", () => {
    const w = createWorld();
    find(w, 1, "barracks").queue = ["line"];
    const before = JSON.stringify(w);
    const seen = new PlayerVision(0).apply(w, GAME);
    expect(JSON.stringify(w)).toBe(before);
    const decoded = decodeSnapshot(encodeSnapshot(seen, GAME), GAME.typeIds, GAME.researchIds);
    expect(decoded.entities.find((e) => e.id === find(w, 1, "barracks").id)!.queue).toEqual([]);
    expect(decoded.deaths).toEqual([]);
  });

  it("vision circles come from your units and buildings", () => {
    const w = createWorld();
    const circles = visionCircles(entityList(w), 0, GAME);
    expect(circles).toHaveLength(2); // HQ and Barracks
    expect(canSee(circles, find(w, 0, "hq").x + 300, find(w, 0, "hq").y)).toBe(true);
    expect(canSee(circles, MID_X, 500)).toBe(false);
  });
});
