import type { CompiledGame, EntityKind, Shape } from "../../../shared/data";
import type { ViewState } from "../../../shared/view";
import type { Camera } from "./camera";
import { teamColor } from "./colors";
import { shapePath, unitRadius } from "./render";

/** Melee hits draw a slash; ranged a fast tracer; anything longer-ranged a lobbed shell. */
const MELEE_RANGE = 30;
const TRACER_RANGE = 200;
const SLASH_MS = 140;
const TRACER_MS = 120;
const SHELL_MS = 420;
const IMPACT_MS = 220;
const FLASH_MS = 110;
const BURST_MS = 380;
/** Units fade in when they come into sight and out when they leave it (fog of war). */
const FADE_IN_MS = 250;
const FADE_OUT_MS = 350;

interface Track {
  x: number;
  y: number;
  hp: number;
  owner: number;
  radius: number;
  kind: EntityKind;
  shape: Shape;
  /** When it first appeared (for the fade-in); -Infinity for anything there from the start. */
  appearAt: number;
  lastAttackTick: number;
  /** Unit vector the entity faces (world space). */
  fx: number;
  fy: number;
  flashUntil: number;
}

interface Shot {
  kind: "slash" | "tracer" | "shell";
  owner: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
}

/** A unit that left your sight, fading out where it was last seen. */
interface Ghost {
  x: number;
  y: number;
  owner: number;
  radius: number;
  shape: Shape;
  fx: number;
  fy: number;
  start: number;
}

interface Burst {
  x: number;
  y: number;
  owner: number;
  radius: number;
  start: number;
}

/**
 * Presentation-only combat feedback built from successive views: which way units face, shots
 * (from each attacker's target and last-hit tick in the snapshot), hit flashes when HP drops,
 * a burst where an entity dies, and fades as units enter or leave your sight (an entity that
 * vanishes without being in the snapshot's death list left your sight). Never affects the simulation.
 */
export class Effects {
  private tracks = new Map<number, Track>();
  private shots: Shot[] = [];
  private bursts: Burst[] = [];
  private ghosts: Ghost[] = [];
  private lastTick = -1;

  observe(view: ViewState, game: CompiledGame, now: number): void {
    // A new match (rematch, or the sandbox restarting) reuses ids: start fresh.
    if (view.tick < this.lastTick) this.clear();
    // Whatever is there in the first view was there from the start: no fade-in.
    const first = this.lastTick < 0;
    this.lastTick = view.tick;
    const died = new Set(view.deaths);

    const byId = new Map(view.entities.map((e) => [e.id, e]));
    const alive = new Set<number>();
    for (const e of view.entities) {
      alive.add(e.id);
      const def = game.defs[e.type];
      if (!def) continue;
      let t = this.tracks.get(e.id);
      if (!t) {
        const fx = e.owner % 2 === 0 ? 1 : -1;
        t = {
          x: e.x,
          y: e.y,
          hp: e.hp,
          owner: e.owner,
          radius: def.radius,
          kind: def.kind,
          shape: def.shape,
          appearAt: first ? -Infinity : now,
          lastAttackTick: e.lastAttackTick,
          fx,
          fy: 0,
          flashUntil: 0,
        };
        this.tracks.set(e.id, t);
        continue;
      }

      const target = e.target !== null ? byId.get(e.target) : undefined;
      const dx = target ? target.x - e.x : e.x - t.x;
      const dy = target ? target.y - e.y : e.y - t.y;
      const len = Math.hypot(dx, dy);
      if (len > (target ? 0.01 : 0.3)) {
        t.fx = dx / len;
        t.fy = dy / len;
      }

      if (e.hp < t.hp) t.flashUntil = now + FLASH_MS;

      if (e.lastAttackTick > t.lastAttackTick && target && def.attack) {
        const range = def.attack.range;
        this.shots.push({
          kind: range <= MELEE_RANGE ? "slash" : range <= TRACER_RANGE ? "tracer" : "shell",
          owner: e.owner,
          fromX: e.x + t.fx * def.radius,
          fromY: e.y + t.fy * def.radius,
          toX: target.x,
          toY: target.y,
          start: now,
        });
      }

      t.x = e.x;
      t.y = e.y;
      t.hp = e.hp;
      t.lastAttackTick = e.lastAttackTick;
    }

    for (const [id, t] of this.tracks) {
      if (alive.has(id)) continue;
      if (t.kind === "unit" && !died.has(id)) {
        this.ghosts.push({ x: t.x, y: t.y, owner: t.owner, radius: t.radius, shape: t.shape, fx: t.fx, fy: t.fy, start: now });
      } else {
        this.bursts.push({ x: t.x, y: t.y, owner: t.owner, radius: t.radius, start: now });
      }
      this.tracks.delete(id);
    }
  }

  /** Counts of live effects, for automated browser checks. */
  stats(): { shots: Record<Shot["kind"], number>; bursts: number; ghosts: number } {
    const shots = { slash: 0, tracer: 0, shell: 0 };
    for (const s of this.shots) shots[s.kind]++;
    return { shots, bursts: this.bursts.length, ghosts: this.ghosts.length };
  }

  /** Opacity of an entity: fades in over a moment after it comes into sight. */
  alpha(id: number, now: number): number {
    const t = this.tracks.get(id);
    return t ? Math.min(1, Math.max(0, (now - t.appearAt) / FADE_IN_MS)) : 1;
  }

  /** Facing of an entity as a world-space unit vector. */
  facing(id: number): { x: number; y: number } {
    const t = this.tracks.get(id);
    return t ? { x: t.fx, y: t.fy } : { x: 1, y: 0 };
  }

  /** 1 right after a hit, fading to 0. */
  flash(id: number, now: number): number {
    const t = this.tracks.get(id);
    return t && now < t.flashUntil ? (t.flashUntil - now) / FLASH_MS : 0;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, colors: readonly number[], now: number): void {
    this.shots = this.shots.filter((s) => now - s.start < duration(s.kind) + (s.kind === "shell" ? IMPACT_MS : 0));
    this.bursts = this.bursts.filter((b) => now - b.start < BURST_MS);
    this.ghosts = this.ghosts.filter((g) => now - g.start < FADE_OUT_MS);

    ctx.save();
    for (const g of this.ghosts) {
      const p = camera.toScreen(g.x, g.y);
      const ahead = camera.toScreen(g.x + g.fx, g.y + g.fy);
      const color = teamColor(g.owner, colors);
      ctx.globalAlpha = 1 - (now - g.start) / FADE_OUT_MS;
      ctx.fillStyle = color.fill;
      ctx.strokeStyle = color.dark;
      ctx.lineWidth = 2;
      shapePath(ctx, g.shape, p.x, p.y, unitRadius(g.radius, camera.scale), Math.atan2(ahead.y - p.y, ahead.x - p.x));
      ctx.fill();
      ctx.stroke();
    }
    ctx.lineCap = "round";
    for (const s of this.shots) {
      const color = teamColor(s.owner, colors).fill;
      const t = (now - s.start) / duration(s.kind);
      const from = camera.toScreen(s.fromX, s.fromY);
      const to = camera.toScreen(s.toX, s.toY);
      if (s.kind === "slash") {
        // Short arc across the target, facing back toward the attacker.
        const angle = Math.atan2(from.y - to.y, from.x - to.x);
        const r = 10 * camera.scale;
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(to.x, to.y, r, angle - 0.9 + t * 0.6, angle + 0.9 + t * 0.6);
        ctx.stroke();
      } else if (s.kind === "tracer") {
        // A bright streak travelling from shooter to target.
        const head = Math.min(1, t);
        const tail = Math.max(0, head - 0.45);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        line(ctx, lerp(from, to, tail), lerp(from, to, head));
        ctx.strokeStyle = "#f8fafc";
        ctx.lineWidth = 1.2;
        line(ctx, lerp(from, to, tail), lerp(from, to, head));
      } else if (t < 1) {
        // Siege shell: a ball on an arc.
        const p = lerp(from, to, t);
        const lift = Math.sin(t * Math.PI) * Math.min(80, Math.hypot(to.x - from.x, to.y - from.y) * 0.25);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#f8fafc";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y - lift, 4.5 * camera.scale + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Impact ring where the shell lands.
        const k = (now - s.start - SHELL_MS) / IMPACT_MS;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = "#fde68a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(to.x, to.y, (8 + k * 22) * camera.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const b of this.bursts) {
      const k = (now - b.start) / BURST_MS;
      const p = camera.toScreen(b.x, b.y);
      const color = teamColor(b.owner, colors).fill;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      const r = b.radius * camera.scale;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (1 + k * 1.6), 0, Math.PI * 2);
      ctx.stroke();
      // Shards flying outward.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + b.x * 0.01;
        const d = r * (0.6 + k * 2.2);
        ctx.fillRect(p.x + Math.cos(a) * d - 2, p.y + Math.sin(a) * d - 2, 4, 4);
      }
    }
    ctx.restore();
  }

  private clear(): void {
    this.tracks.clear();
    this.shots = [];
    this.bursts = [];
    this.ghosts = [];
  }
}

function duration(kind: Shot["kind"]): number {
  return kind === "slash" ? SLASH_MS : kind === "tracer" ? TRACER_MS : SHELL_MS;
}

function lerp(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function line(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
