/**
 * The client camera is plain maths (no canvas), so zoom, pan and the mirror are checked here.
 */
import { describe, expect, it } from "vitest";
import { Camera, MAX_SCALE, MIN_SCALE } from "../client/src/game/camera";
import { GAME } from "../shared/data";

const HUD_TOP = 40;
const HUD_BOTTOM = 96;

function camera(width = 1600, height = 900, flipped = false): Camera {
  const c = new Camera(GAME);
  c.flipped = flipped;
  c.resize(width, height, HUD_BOTTOM, HUD_TOP);
  return c;
}

describe("camera", () => {
  it("starts by fitting the map's height", () => {
    const c = camera(1600, 900);
    expect(c.scale).toBeCloseTo(Math.min(1.1, Math.max(0.75, (900 - 136) / (GAME.map.height + 40))));
  });

  for (const flipped of [false, true]) {
    it(`toWorld undoes toScreen${flipped ? " when mirrored" : ""}`, () => {
      const c = camera(1600, 900, flipped);
      c.zoomAt(1.3, 500, 400);
      c.panBy(120, 60);
      const s = c.toScreen(1500, 300);
      const w = c.toWorld(s.x, s.y);
      expect(w.x).toBeCloseTo(1500);
      expect(w.y).toBeCloseTo(300);
    });

    it(`zooming keeps the point under the cursor still${flipped ? " when mirrored" : ""}`, () => {
      const c = camera(1600, 900, flipped);
      c.lookAt(1200, 500);
      const before = c.toWorld(700, 450);
      c.zoomAt(1.25, 700, 450);
      expect(c.scale).toBeGreaterThan(0.8);
      const after = c.toWorld(700, 450);
      expect(after.x).toBeCloseTo(before.x);
      expect(after.y).toBeCloseTo(before.y);
    });
  }

  it("zoom stops at the limits", () => {
    const c = camera(1600, 900);
    for (let i = 0; i < 30; i++) c.zoomCentre(1.5);
    expect(c.scale).toBe(MAX_SCALE);
    for (let i = 0; i < 30; i++) c.zoomCentre(1 / 1.5);
    expect(c.scale).toBe(c.minScale);
    expect(c.scale).toBeGreaterThanOrEqual(MIN_SCALE);
  });

  it("zoomed all the way out, the whole map fits a large window", () => {
    const c = camera(2560, 1440);
    c.zoomCentre(0.01);
    const v = c.viewRect;
    expect(v.w).toBeGreaterThanOrEqual(GAME.map.width);
    expect(v.h).toBeGreaterThanOrEqual(GAME.map.height);
    // The map is centred, so its corners are on screen.
    const tl = c.toScreen(0, 0);
    const br = c.toScreen(GAME.map.width, GAME.map.height);
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(2560);
    expect(tl.y).toBeGreaterThanOrEqual(HUD_TOP);
    expect(br.y).toBeLessThanOrEqual(1440 - HUD_BOTTOM);
  });

  it("a small window never zooms out below the readability limit", () => {
    const c = camera(800, 600);
    c.zoomCentre(0.01);
    expect(c.scale).toBe(MIN_SCALE);
  });

  it("panning stays inside the map", () => {
    const c = camera(1200, 800);
    c.zoomCentre(1.5);
    c.panBy(-100000, -100000);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    c.panBy(100000, 100000);
    const v = c.viewRect;
    expect(c.x + v.w).toBeCloseTo(GAME.map.width);
    expect(c.y + v.h).toBeCloseTo(GAME.map.height);
  });

  it("pans the same on-screen distance at any zoom", () => {
    const c = camera(1600, 900);
    c.lookAt(1200, 500);
    const a = c.toScreen(1200, 500);
    c.panBy(100, 0);
    expect(c.toScreen(1200, 500).x).toBeCloseTo(a.x - 100);
  });

  it("keeps the zoom when the window is resized", () => {
    const c = camera(1600, 900);
    c.zoomCentre(1.4);
    const s = c.scale;
    c.resize(1700, 950, HUD_BOTTOM, HUD_TOP);
    expect(c.scale).toBeCloseTo(s);
  });
});
