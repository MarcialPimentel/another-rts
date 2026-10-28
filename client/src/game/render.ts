import type { CompiledGame, Shape } from "../../../shared/data";
import type { ViewEntity, ViewState } from "../../../shared/view";
import type { Camera } from "./camera";
import { TICKS_PER_SECOND } from "../../../shared/sim/constants";
import { COLORS, teamColor } from "./colors";
import type { Effects } from "./effects";

export interface RenderOptions {
  localPlayer: number;
  /** Colour index per player, from the lobby. */
  colors: readonly number[];
  selection: ReadonlySet<number>;
  /** Selection box in screen pixels while dragging. */
  dragBox: { x0: number; y0: number; x1: number; y1: number } | null;
  /** Facing and hit flashes; shots and bursts are drawn by Effects itself. */
  effects: Effects;
  now: number;
}

const UNIT_DRAW_SCALE = 1.3;
/** Units never draw smaller than this radius in screen pixels, so shapes read when zoomed out. */
const MIN_UNIT_RADIUS = 7;

/** On-screen radius of a unit with collision radius `radius`. */
export function unitRadius(radius: number, scale: number): number {
  return Math.max(MIN_UNIT_RADIUS, radius * scale * UNIT_DRAW_SCALE);
}

/** True while an enemy is capturing (or neutralizing) a point `player` owns. */
export function pointUnderAttack(e: ViewEntity, player: number): boolean {
  return e.owner === player && !!e.capture && e.capture.by >= 0 && e.capture.by !== player && e.capture.progress > 0;
}

/** Draws the map and every entity as its shape (GDD Game layer: shapes first, flavour later). */
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  view: ViewState,
  camera: Camera,
  game: CompiledGame,
  opts: RenderOptions,
): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#0b0f0a";
  ctx.fillRect(0, 0, width, height);

  drawGround(ctx, camera, game);

  // Buildings first so units draw on top of them.
  const sorted = [...view.entities].sort(
    (a, b) => kindOrder(game, a) - kindOrder(game, b) || a.id - b.id,
  );

  for (const e of sorted) {
    if (opts.selection.has(e.id) && e.rally && e.owner === opts.localPlayer) {
      drawRally(ctx, camera, e);
    }
  }
  for (const e of sorted) drawEntity(ctx, camera, game, e, opts);

  if (opts.dragBox) {
    const { x0, y0, x1, y1 } = opts.dragBox;
    ctx.fillStyle = COLORS.boxFill;
    ctx.strokeStyle = COLORS.boxLine;
    ctx.lineWidth = 1;
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
}

/** Points lie on the ground under everything, then buildings, then units on top. */
function kindOrder(game: CompiledGame, e: ViewEntity): number {
  const kind = game.defs[e.type]?.kind;
  return kind === "point" ? -1 : kind === "building" ? 0 : 1;
}

function drawGround(ctx: CanvasRenderingContext2D, camera: Camera, game: CompiledGame): void {
  const a = camera.toScreen(0, 0);
  const b = camera.toScreen(game.map.width, game.map.height);
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(left, top, w, h);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 0; gx <= game.map.width; gx += 100) {
    const s = camera.toScreen(gx, 0);
    ctx.moveTo(Math.round(s.x) + 0.5, top);
    ctx.lineTo(Math.round(s.x) + 0.5, top + h);
  }
  for (let gy = 0; gy <= game.map.height; gy += 100) {
    const s = camera.toScreen(0, gy);
    ctx.moveTo(left, Math.round(s.y) + 0.5);
    ctx.lineTo(left + w, Math.round(s.y) + 0.5);
  }
  ctx.stroke();

  ctx.strokeStyle = COLORS.border;
  ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
}

function drawRally(ctx: CanvasRenderingContext2D, camera: Camera, e: ViewEntity): void {
  const from = camera.toScreen(e.x, e.y);
  const to = camera.toScreen(e.rally!.x, e.rally!.y);
  ctx.save();
  ctx.strokeStyle = COLORS.rally;
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Flag
  ctx.fillStyle = COLORS.rally;
  ctx.fillRect(to.x - 1, to.y - 16, 2, 16);
  ctx.beginPath();
  ctx.moveTo(to.x + 1, to.y - 16);
  ctx.lineTo(to.x + 11, to.y - 12);
  ctx.lineTo(to.x + 1, to.y - 8);
  ctx.fill();
  ctx.restore();
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  game: CompiledGame,
  e: ViewEntity,
  opts: RenderOptions,
): void {
  const def = game.defs[e.type];
  if (!def) return;
  if (def.kind === "point") {
    drawPoint(ctx, camera, def.radius, def.incomePerTick * TICKS_PER_SECOND, e, opts);
    return;
  }
  const p = camera.toScreen(e.x, e.y);
  // Units draw a little larger than their collision radius so shapes read at a glance.
  const r = def.kind === "unit" ? unitRadius(def.radius, camera.scale) : def.radius * camera.scale;
  const color = teamColor(e.owner, opts.colors);
  const selected = opts.selection.has(e.id);
  ctx.save();
  // Units fade in as they come into sight.
  if (def.kind === "unit") ctx.globalAlpha = opts.effects.alpha(e.id, opts.now);

  if (selected) {
    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + (def.kind === "unit" ? r * 0.3 : 0), r + 4, (r + 4) * (def.kind === "unit" ? 0.7 : 1), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (def.kind === "building") {
    const size = r * 1.6;
    ctx.fillStyle = color.dark;
    ctx.strokeStyle = color.fill;
    ctx.lineWidth = 3;
    roundRect(ctx, p.x - size / 2, p.y - size / 2, size, size, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `600 ${Math.max(11, 14 * camera.scale)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.name, p.x, p.y);
    if (e.queue.length > 0) {
      const w = size * 0.8;
      ctx.fillStyle = COLORS.hpBack;
      ctx.fillRect(p.x - w / 2, p.y + size / 2 - 12, w, 5);
      ctx.fillStyle = COLORS.rally;
      ctx.fillRect(p.x - w / 2, p.y + size / 2 - 12, w * e.progress, 5);
    }
  } else {
    // Face the target or the direction of travel, in screen space (the camera may be mirrored).
    const f = opts.effects.facing(e.id);
    const ahead = camera.toScreen(e.x + f.x, e.y + f.y);
    const angle = Math.atan2(ahead.y - p.y, ahead.x - p.x);
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = color.dark;
    ctx.lineWidth = 2;
    shapePath(ctx, def.shape, p.x, p.y, r, angle);
    ctx.fill();
    ctx.stroke();
    const flash = opts.effects.flash(e.id, opts.now);
    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.75 * flash;
      ctx.fillStyle = "#ffffff";
      shapePath(ctx, def.shape, p.x, p.y, r, angle);
      ctx.fill();
      ctx.restore();
    }
  }

  if (e.hp < def.hp) {
    const w = Math.max(20, r * 2);
    const y = p.y - (def.kind === "building" ? r * 0.8 + 10 : r + 8);
    const frac = Math.max(0, e.hp / def.hp);
    ctx.fillStyle = COLORS.hpBack;
    ctx.fillRect(p.x - w / 2, y, w, 4);
    ctx.fillStyle = frac > 0.6 ? COLORS.hpGood : frac > 0.3 ? COLORS.hpMid : COLORS.hpLow;
    ctx.fillRect(p.x - w / 2, y, w * frac, 4);
  }
  ctx.restore();
}

/**
 * A capture point: a tinted circle on the ground in its owner's colour (grey when neutral), a
 * diamond marker with its income, and a ring that fills in the capturing player's colour.
 */
function drawPoint(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  radius: number,
  goldPerSecond: number,
  e: ViewEntity,
  opts: RenderOptions,
): void {
  const p = camera.toScreen(e.x, e.y);
  const r = radius * camera.scale;
  const color = teamColor(e.owner, opts.colors).fill;
  ctx.save();

  // Neutral points: faint and dashed. Owned points: tinted with a solid ring.
  const neutral = e.owner < 0;
  ctx.globalAlpha = neutral ? 0.08 : 0.22;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = neutral ? 0.7 : 0.95;
  ctx.strokeStyle = color;
  ctx.lineWidth = neutral ? 2 : 3;
  if (neutral) ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const capture = e.capture;
  if (capture && capture.by >= 0 && capture.progress > 0) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = teamColor(capture.by, opts.colors).fill;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + capture.progress * Math.PI * 2);
    ctx.stroke();
  }

  const d = Math.max(7, 11 * camera.scale);
  ctx.globalAlpha = 1;
  ctx.fillStyle = e.owner < 0 ? "#1e293b" : color;
  ctx.strokeStyle = e.owner < 0 ? COLORS.neutral : "#f8fafc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - d);
  ctx.lineTo(p.x + d, p.y);
  ctx.lineTo(p.x, p.y + d);
  ctx.lineTo(p.x - d, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#facc15";
  ctx.font = `600 ${Math.max(10, 12 * camera.scale)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`+${goldPerSecond}`, p.x, p.y + d + 3);
  ctx.restore();
}

/**
 * Raid warnings, drawn above the fog so they stay bright: on each of your points the enemy is
 * taking, the enemy's capture ring plus a red ring pulsing outward.
 */
export function drawRaidWarnings(
  ctx: CanvasRenderingContext2D,
  view: ViewState,
  camera: Camera,
  game: CompiledGame,
  localPlayer: number,
  colors: readonly number[],
  now: number,
): void {
  ctx.save();
  for (const e of view.entities) {
    const def = game.defs[e.type];
    if (def?.kind !== "point" || !pointUnderAttack(e, localPlayer)) continue;
    const p = camera.toScreen(e.x, e.y);
    const r = def.radius * camera.scale;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = teamColor(e.capture!.by, colors).fill;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + e.capture!.progress * Math.PI * 2);
    ctx.stroke();
    const pulse = (now % 900) / 900;
    ctx.globalAlpha = 1 - pulse;
    ctx.strokeStyle = COLORS.attack;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 6 + pulse * 26 * camera.scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Outline for a unit shape of radius `r`, rotated to `angle` (radians, screen space). Shapes are
 * scaled so each looks about as big as a circle of that radius.
 */
export function shapePath(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  x: number,
  y: number,
  r: number,
  angle: number,
): void {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  const corners = shape === "triangle" ? 3 : shape === "square" ? 4 : 6;
  const size = shape === "triangle" ? r * 1.35 : shape === "square" ? r * 1.2 : r * 1.1;
  // Squares and hexagons sit flat (no rotation); triangles point where the unit faces.
  const base = shape === "triangle" ? angle : shape === "square" ? Math.PI / 4 : 0;
  for (let i = 0; i < corners; i++) {
    const a = base + (i / corners) * Math.PI * 2;
    const px = x + Math.cos(a) * size;
    const py = y + Math.sin(a) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
