import { playerColor } from "../../../shared/lobby";

/** Interface and map colours. Player colours come from the lobby (shared/lobby.ts). */
export const COLORS = {
  ground: "#24301f",
  grid: "rgba(255,255,255,0.035)",
  border: "rgba(255,255,255,0.18)",
  selection: "#f8fafc",
  hpGood: "#22c55e",
  hpMid: "#eab308",
  hpLow: "#ef4444",
  hpBack: "rgba(0,0,0,0.6)",
  move: "#22c55e",
  attack: "#ef4444",
  rally: "#facc15",
  boxFill: "rgba(148,197,255,0.12)",
  boxLine: "rgba(148,197,255,0.8)",
  /** Capture points nobody owns. */
  neutral: "#94a3b8",
};

/** GDD: each player keeps the colour they picked in the lobby, on both players' screens. */
export function teamColor(owner: number, colors: readonly number[]): { fill: string; dark: string } {
  if (owner < 0) return { fill: COLORS.neutral, dark: "#334155" };
  return playerColor(colors, owner);
}
