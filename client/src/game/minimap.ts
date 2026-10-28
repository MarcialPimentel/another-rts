import type { CompiledGame } from "../../../shared/data";
import type { ViewState } from "../../../shared/view";
import type { Camera } from "./camera";
import { COLORS, teamColor } from "./colors";
import type { Input } from "./input";

/** Minimap size in CSS pixels; the map's 2.4:1 shape fits the bottom HUD bar. */
const WIDTH = 192;

/**
 * The whole map in the corner of the HUD: points, buildings and units in player colours, and
 * the camera's view as a box. Left-click or drag moves the camera; right-click orders selected
 * units there. It draws only what the view contains, so it will show fog of war for free.
 */
export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly height: number;
  private dragging = false;

  constructor(
    parent: HTMLElement,
    private readonly game: CompiledGame,
    private readonly camera: Camera,
    private readonly input: Input,
  ) {
    this.height = Math.round((WIDTH * game.map.height) / game.map.width);
    this.canvas = document.createElement("canvas");
    this.canvas.className = "minimap";
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(WIDTH * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${WIDTH}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    parent.append(this.canvas);

    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      if (e.button === 0) {
        this.dragging = true;
        this.lookAt(e);
      } else if (e.button === 2) {
        this.input.orderAt(this.toWorld(e));
      }
    });
    window.addEventListener("mousemove", this.onMove);
    window.addEventListener("mouseup", this.onUp);
  }

  dispose(): void {
    window.removeEventListener("mousemove", this.onMove);
    window.removeEventListener("mouseup", this.onUp);
  }

  private readonly onMove = (e: MouseEvent): void => {
    if (this.dragging) this.lookAt(e);
  };

  private readonly onUp = (e: MouseEvent): void => {
    if (e.button === 0) this.dragging = false;
  };

  /** Minimap pixel to world position (the minimap is mirrored with the camera). */
  private toWorld(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const k = this.game.map.width / WIDTH;
    const vx = Math.min(Math.max(e.clientX - rect.left, 0), WIDTH) * k;
    const y = Math.min(Math.max(e.clientY - rect.top, 0), this.height) * k;
    return { x: this.camera.viewX(vx), y };
  }

  private lookAt(e: MouseEvent): void {
    const w = this.toWorld(e);
    this.camera.lookAt(w.x, w.y);
  }

  draw(view: ViewState, colors: readonly number[]): void {
    const ctx = this.ctx;
    const k = WIDTH / this.game.map.width;
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, WIDTH, this.height);

    for (const e of view.entities) {
      const def = this.game.defs[e.type];
      if (!def) continue;
      const x = this.camera.viewX(e.x) * k;
      const y = e.y * k;
      const color = teamColor(e.owner, colors);
      if (def.kind === "point") {
        ctx.globalAlpha = e.owner < 0 ? 0.5 : 0.85;
        ctx.strokeStyle = color.fill;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(3, def.radius * k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (def.kind === "building") {
        const s = Math.max(5, def.radius * k * 1.6);
        ctx.fillStyle = color.fill;
        ctx.strokeStyle = color.dark;
        ctx.lineWidth = 1;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
        ctx.strokeRect(x - s / 2, y - s / 2, s, s);
      } else {
        ctx.fillStyle = color.fill;
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }

    // The camera's view.
    const v = this.camera.viewRect;
    ctx.strokeStyle = COLORS.selection;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.max(0.5, v.x * k + 0.5),
      Math.max(0.5, v.y * k + 0.5),
      Math.min(WIDTH - 1, v.w * k),
      Math.min(this.height - 1, v.h * k),
    );
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(0.5, 0.5, WIDTH - 1, this.height - 1);
  }
}
