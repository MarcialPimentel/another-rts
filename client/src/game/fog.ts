import type { VisionCircle } from "../../../shared/sim/vision";

/** How much of the colour fog removes (0 = none, 1 = greyscale). */
const DESATURATE = 0.75;
/** How dark fog is: the scene is multiplied by mid-grey at this strength (about 40% darker). */
const DARKEN = 0.8;

/**
 * Fog of war look (GDD: Camera and fog of war): outside your vision the map is dimmed and
 * desaturated, with soft edges, and nothing is fully hidden. It's painted on a small mask
 * canvas (scaled up, which softens it further) and laid over the scene twice: once to drain
 * colour, once to darken. What's hidden was already left out of the snapshot by the server;
 * this only shows where your sight ends.
 */
export class FogLayer {
  private readonly mask: HTMLCanvasElement;
  private readonly mctx: CanvasRenderingContext2D;

  /** `resolution` is mask pixels per screen pixel (lower is cheaper and softer). */
  constructor(private readonly resolution: number) {
    this.mask = document.createElement("canvas");
    this.mctx = this.mask.getContext("2d")!;
  }

  /**
   * Draws fog over `ctx` (an area `width` × `height` in its current units) everywhere outside
   * the circles, which are already in those units. `feather` is the soft edge width.
   */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, circles: readonly VisionCircle[], feather: number): void {
    const k = this.resolution;
    const w = Math.max(1, Math.ceil(width * k));
    const h = Math.max(1, Math.ceil(height * k));
    if (this.mask.width !== w || this.mask.height !== h) {
      this.mask.width = w;
      this.mask.height = h;
    }
    const m = this.mctx;
    m.globalCompositeOperation = "source-over";
    m.clearRect(0, 0, w, h);
    m.fillStyle = "#808080";
    m.fillRect(0, 0, w, h);

    // Cut a soft-edged hole for each vision circle.
    m.globalCompositeOperation = "destination-out";
    for (const c of circles) {
      const r = c.r * k;
      if (r <= 0) continue;
      const x = c.x * k;
      const y = c.y * k;
      const inner = Math.max(0, r - feather * k);
      const g = m.createRadialGradient(x, y, inner, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      m.fillStyle = g;
      m.beginPath();
      m.arc(x, y, r, 0, Math.PI * 2);
      m.fill();
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = DESATURATE;
    ctx.globalCompositeOperation = "saturation";
    ctx.drawImage(this.mask, 0, 0, width, height);
    ctx.globalAlpha = DARKEN;
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(this.mask, 0, 0, width, height);
    ctx.restore();
  }
}
