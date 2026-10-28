import type { CompiledGame, Shape } from "../../../shared/data";
import type { ViewState } from "../../../shared/view";
import { canTrain, hasResearched, techModifiers } from "../../../shared/sim/tech";
import type { ViewPlayer } from "../../../shared/view";
import { TRAIN_KEYS, type Input } from "./input";
import { pointUnderAttack } from "./render";
import { researchSlots } from "./research_slots";
import type { Session } from "./session";

/**
 * DOM overlay: top bar (gold, unit count, status line) and a bottom panel describing the
 * selection with its action buttons. Buttons send the same commands as the hotkeys.
 */
export class Hud {
  readonly top: HTMLDivElement;
  readonly bottom: HTMLDivElement;
  private readonly gold: HTMLSpanElement;
  private readonly units: HTMLSpanElement;
  private readonly points: HTMLSpanElement;
  private readonly tech: HTMLSpanElement;
  private readonly status: HTMLSpanElement;
  private readonly panel: HTMLDivElement;
  private lastPanel = "";

  constructor(
    root: HTMLElement,
    private readonly game: CompiledGame,
    private readonly session: Session,
    private readonly input: Input,
  ) {
    this.top = el("div", "hud-top");
    this.gold = el("span", "hud-gold");
    this.units = el("span", "hud-units");
    this.points = el("span", "hud-points");
    this.tech = el("span", "hud-tech");
    this.status = el("span", "hud-status");
    const build = el("span", "hud-build");
    build.textContent = `build ${__BUILD_ID__}`;
    this.top.append(this.gold, this.units, this.points, this.tech, this.status, build);

    this.bottom = el("div", "hud-bottom");
    this.panel = el("div", "hud-panel");
    this.bottom.append(this.panel);
    this.bottom.addEventListener("click", (e) => this.onClick(e));
    root.append(this.top, this.bottom);
  }

  update(view: ViewState): void {
    const me = view.players[this.session.localPlayer];
    const mine = view.entities.filter((e) => e.owner === this.session.localPlayer);
    // Income shown per second: the HQ plus every point you own (with Overclock).
    const overclock = techModifiers(me, this.game).pointIncome;
    const income = mine.reduce((sum, e) => {
      const def = this.game.defs[e.type];
      if (!def || def.incomePerTick <= 0) return sum;
      return sum + def.incomePerTick * 20 + (def.kind === "point" ? overclock : 0);
    }, 0);
    this.gold.textContent = `Gold ${me ? me.gold : 0} (+${Math.round(income)}/s)`;
    const allPoints = view.entities.filter((e) => this.game.defs[e.type]?.kind === "point");
    const owned = allPoints.filter((e) => e.owner === this.session.localPlayer).length;
    const theirs = allPoints.filter((e) => e.owner >= 0 && e.owner !== this.session.localPlayer).length;
    const raided = allPoints.some((e) => pointUnderAttack(e, this.session.localPlayer));
    this.points.textContent = `Points ${owned} · enemy ${theirs} · of ${allPoints.length}${raided ? " · ⚠ a point is under attack" : ""}`;
    this.points.classList.toggle("alert", raided);
    const unitCount =
      mine.filter((e) => this.game.defs[e.type]?.kind === "unit").length +
      mine.reduce((n, e) => n + e.queue.length, 0);
    this.units.textContent = `Units ${unitCount}/${this.game.economy.unitCap}`;
    // Both players' tech is public, so you can see what the enemy is building towards.
    const enemy = view.players.find((p) => p.id !== this.session.localPlayer);
    this.tech.textContent = `Tech ${me ? this.techSummary(me) : "-"} · enemy ${enemy ? this.techSummary(enemy) : "-"}`;
    this.status.textContent = this.session.status();
    this.renderPanel(view);
  }

  private renderPanel(view: ViewState): void {
    const selected = this.input.selectedEntities();
    let html: string;
    if (selected.length === 0) {
      html = `<div class="hint">Drag to select units · Right-click to move or attack · A = attack-move · S = stop · Select the Barracks to train (Q/W/E/R) or the HQ to research · Stand on ◆ points to capture them for gold · Wheel to zoom · Middle-drag, arrows or screen edge to scroll · Space = your HQ · Click the minimap to jump</div>`;
    } else if (selected.length === 1 && this.game.defs[selected[0]!.type]?.kind === "building") {
      const b = selected[0]!;
      const def = this.game.defs[b.type]!;
      const own = b.owner === this.session.localPlayer;
      const rows = [`<div class="title">${def.name}</div>`, `<div>HP ${Math.ceil(b.hp)} / ${def.hp}</div>`];
      if (def.produces.length && own) {
        const pending = this.session.pendingTrains(b.id);
        const slots: string[] = [];
        for (let i = 0; i < def.queueMax; i++) {
          const queued = b.queue[i];
          if (queued) {
            const pct = i === 0 ? Math.round(b.progress * 100) : 0;
            const glyph = SHAPE_GLYPH[this.game.defs[queued]?.shape ?? "circle"];
            slots.push(`<span class="slot filled">${glyph}<i style="width:${pct}%"></i></span>`);
          } else if (i < b.queue.length + pending) {
            slots.push(`<span class="slot pending"></span>`);
          } else {
            slots.push(`<span class="slot"></span>`);
          }
        }
        const gold = view.players[this.session.localPlayer]?.gold ?? 0;
        const full = b.queue.length + pending >= def.queueMax;
        rows.push(`<div class="queue" title="Right-click the ground to set the rally point">${slots.join("")}</div>`);
        const me = view.players[this.session.localPlayer];
        const buttons = def.produces.map((id, i) => {
          const unit = this.game.defs[id]!;
          const key = (TRAIN_KEYS[i] ?? "").toUpperCase();
          const unlocked = me ? canTrain(me, unit) : false;
          const disabled = gold < unit.cost || full || !key || !unlocked ? "disabled" : "";
          const needs = unlocked ? "" : ` · needs ${this.researchNames(unit.requires)}`;
          const tip = `${unit.name}: ${unit.description} (HP ${unit.hp}, ${unit.cost} gold)${needs}`;
          const small = unlocked ? `${unit.cost}g · ${key}` : `needs ${this.researchNames(unit.requires)}`;
          return `<button class="train" data-action="train" data-index="${i}" title="${tip}" ${disabled}><b>${SHAPE_GLYPH[unit.shape]}</b> ${unit.name} <small>${small}</small></button>`;
        });
        rows.push(`<div class="train-row">${buttons.join("")}</div>`);
      } else if (def.researches.length && own) {
        const me = view.players[this.session.localPlayer];
        rows.push(this.researchRow(researchSlots(def, me?.researched ?? [], this.game), me));
      } else if (def.incomePerTick > 0) {
        rows.push(`<div class="hint">+${Math.round(def.incomePerTick * 20)} gold per second</div>`);
      }
      html = rows.join("");
    } else {
      const counts = new Map<string, number>();
      let hp = 0;
      let maxHp = 0;
      for (const e of selected) {
        const def = this.game.defs[e.type]!;
        counts.set(def.name, (counts.get(def.name) ?? 0) + 1);
        hp += e.hp;
        maxHp += def.hp;
      }
      const names = [...counts].map(([n, c]) => `${c} × ${n}`).join(", ");
      const own = selected.some((e) => e.owner === this.session.localPlayer);
      html = `<div class="title">${names}</div><div>HP ${Math.ceil(hp)} / ${maxHp}</div>`;
      if (own) {
        const armed = this.input.attackMoveArmed ? " armed" : "";
        html += `<button data-action="attack-move" class="${armed}">Attack-move (A)</button><button data-action="stop">Stop (S)</button>`;
      }
    }
    if (html !== this.lastPanel) {
      this.panel.innerHTML = html;
      this.lastPanel = html;
    }
  }

  /** Research buttons at the HQ: done, in progress, locked, or ready to buy. */
  private researchRow(ids: string[], me: ViewPlayer | undefined): string {
    const gold = me?.gold ?? 0;
    const buttons = ids.map((id, i) => {
      const r = this.game.research[id]!;
      const key = (TRAIN_KEYS[i] ?? "").toUpperCase();
      const done = me?.researched.includes(id) ?? false;
      const current = me?.researching?.id === id ? me.researching : null;
      const unlocked = me ? hasResearched(me, r.requires) : false;
      let small: string;
      if (done) small = "done";
      else if (current) small = `${Math.round(current.progress * 100)}%`;
      else if (!unlocked)
        small = `needs ${this.researchNames(r.requires.filter((q) => !me?.researched.includes(q)))}`;
      else small = `${r.cost}g · ${key}`;
      const busy = me?.researching != null;
      const disabled = done || current || busy || !unlocked || gold < r.cost || !key ? "disabled" : "";
      const cls = done ? "train done" : current ? "train active" : "train";
      const tip = `${r.name}: ${r.description} (${r.cost} gold, ${Math.round(r.ticks / 20)} s)`;
      return `<button class="${cls}" data-action="research" data-index="${i}" title="${tip}" ${disabled}>${r.name} <small>${small}</small></button>`;
    });
    return `<div class="train-row">${buttons.join("")}</div>`;
  }

  private researchNames(ids: readonly string[]): string {
    return ids.map((id) => this.game.research[id]?.name ?? id).join(" + ");
  }

  /** Short tech summary, e.g. "T2 W1 A0 OC". */
  private techSummary(p: ViewPlayer): string {
    const levels = (key: "damage" | "armour") =>
      p.researched.filter((id) => (this.game.research[id]?.effect[key] ?? 0) > 0).length;
    const tier = p.researched.includes("tier2") ? 2 : 1;
    const oc = p.researched.some((id) => (this.game.research[id]?.effect.pointIncome ?? 0) > 0) ? " OC" : "";
    return `T${tier} W${levels("damage")} A${levels("armour")}${oc}`;
  }

  private onClick(e: MouseEvent): void {
    const button = (e.target as HTMLElement).closest("button");
    if (!button) return;
    switch (button.dataset.action) {
      case "train":
        this.input.train(Number(button.dataset.index ?? 0));
        break;
      case "research":
        this.input.research(Number(button.dataset.index ?? 0));
        break;
      case "stop":
        this.input.stop();
        break;
      case "attack-move":
        this.input.armAttackMove();
        break;
    }
  }
}

/** Text stand-ins for each unit shape, used in HUD buttons and queue slots. */
const SHAPE_GLYPH: Record<Shape, string> = {
  square: "■",
  triangle: "▲",
  circle: "●",
  hexagon: "⬢",
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
