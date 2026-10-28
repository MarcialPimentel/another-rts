import type { CompiledGame } from "../../../shared/data";

/** Screen pixels per second the camera pans with arrow keys or edge scrolling, at any zoom. */
const PAN_SPEED = 1100;
const EDGE = 18;
/** Never zoom out further than this, so the unit shapes stay readable and clickable. */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 1.6;
/** Default zoom fits the map's height in the window, within these limits. */
const DEFAULT_MIN = 0.75;
const DEFAULT_MAX = 1.1;

/**
 * Maps world coordinates to the screen, pans and zooms over the map. When `flipped`, the map is
 * mirrored so the local player's base is on the left (GDD: the local player is always on the left).
 *
 * `x` and `y` are the top-left of the view in "view space": world space after the mirror.
 */
export class Camera {
  x = 0;
  y = 0;
  scale = 1;
  flipped = false;
  private offsetX = 0;
  private offsetY = 0;
  private screenWidth = 0;
  private usableHeight = 0;
  private top = 0;
  private bottom = 0;
  private sized = false;

  constructor(private readonly game: CompiledGame) {}

  resize(width: number, height: number, hudBottom: number, hudTop: number): void {
    this.screenWidth = width;
    this.usableHeight = Math.max(1, height - hudBottom - hudTop);
    this.top = hudTop;
    this.bottom = height - hudBottom;
    if (!this.sized) {
      // First layout: fit the map's height, as before zoom existed.
      this.scale = Math.min(DEFAULT_MAX, Math.max(DEFAULT_MIN, this.usableHeight / (this.game.map.height + 40)));
      this.sized = true;
    }
    this.scale = this.clampScale(this.scale);
    this.layout();
  }

  /** Zoomed all the way out: the whole map fits the window, but never below MIN_SCALE. */
  get minScale(): number {
    const fit = Math.min(this.screenWidth / this.game.map.width, this.usableHeight / this.game.map.height);
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
  }

  /** The visible part of the map, in view space. */
  get viewRect(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.screenWidth / this.scale, h: this.usableHeight / this.scale };
  }

  /** World x after the mirror, if any. Mirroring is its own inverse. */
  viewX(wx: number): number {
    return this.flipped ? this.game.map.width - wx : wx;
  }

  toScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (this.viewX(wx) - this.x) * this.scale + this.offsetX,
      y: (wy - this.y) * this.scale + this.offsetY,
    };
  }

  toWorld(sx: number, sy: number): { x: number; y: number } {
    const vx = (sx - this.offsetX) / this.scale + this.x;
    return {
      x: this.viewX(vx),
      y: (sy - this.offsetY) / this.scale + this.y,
    };
  }

  /** Pans by keyboard direction and by the mouse resting at a screen edge. */
  update(
    dt: number,
    keys: { x: number; y: number },
    mouse: { x: number; y: number } | null,
    screenWidth: number,
  ): void {
    let dx = keys.x;
    let dy = keys.y;
    if (mouse) {
      if (mouse.x <= EDGE) dx = -1;
      else if (mouse.x >= screenWidth - EDGE) dx = 1;
      // Vertical edges are thin bands just inside the HUD bars (or the very top of the window),
      // so using the HUD buttons doesn't scroll the map.
      if (mouse.y <= EDGE || (mouse.y >= this.top && mouse.y <= this.top + EDGE)) dy = -1;
      else if (mouse.y >= this.bottom - EDGE && mouse.y <= this.bottom) dy = 1;
    }
    if (dx !== 0 || dy !== 0) this.panBy(dx * PAN_SPEED * dt, dy * PAN_SPEED * dt);
  }

  /** Moves the view by a distance in screen pixels (positive = the view moves right/down). */
  panBy(sx: number, sy: number): void {
    this.x += sx / this.scale;
    this.y += sy / this.scale;
    this.layout();
  }

  /** Zooms by `factor` (>1 zooms in) keeping the world point under screen position (sx, sy) still. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.toWorld(sx, sy);
    const next = this.clampScale(this.scale * factor);
    if (next === this.scale) return;
    this.scale = next;
    this.layout();
    // Shift so the same world point is back under the cursor.
    const after = this.toWorld(sx, sy);
    this.x += this.viewX(before.x) - this.viewX(after.x);
    this.y += before.y - after.y;
    this.layout();
  }

  /** Zooms around the middle of the map area (keyboard zoom). */
  zoomCentre(factor: number): void {
    this.zoomAt(factor, this.screenWidth / 2, this.top + this.usableHeight / 2);
  }

  /** Centres the view on a world position. */
  lookAt(wx: number, wy: number): void {
    const { w, h } = this.viewRect;
    this.x = this.viewX(wx) - w / 2;
    this.y = wy - h / 2;
    this.layout();
  }

  private clampScale(s: number): number {
    return Math.min(MAX_SCALE, Math.max(this.minScale, s));
  }

  /** Clamps the view to the map and centres the map when it is smaller than the window. */
  private layout(): void {
    const { w, h } = this.viewRect;
    const mapW = this.game.map.width;
    const mapH = this.game.map.height;
    this.x = Math.min(Math.max(this.x, 0), Math.max(0, mapW - w));
    this.y = Math.min(Math.max(this.y, 0), Math.max(0, mapH - h));
    this.offsetX = mapW < w ? ((w - mapW) * this.scale) / 2 : 0;
    this.offsetY = this.top + (mapH < h ? ((h - mapH) * this.scale) / 2 : 0);
  }
}
