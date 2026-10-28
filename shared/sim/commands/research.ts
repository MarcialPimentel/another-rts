import { hasResearched } from "../tech";
import type { CommandHandler } from "./types";

/**
 * Start a research at a building that offers it (the HQ). Gold is paid when it starts.
 * Dropped if the player is already researching something, already has it, lacks a
 * requirement, or can't afford it.
 */
export const research: CommandHandler<"research"> = {
  validate(world, player, cmd, game) {
    const building = world.entities[cmd.building];
    if (!building || building.owner !== player) return null;
    if (!game.defs[building.type]!.researches.includes(cmd.research)) return null;
    const r = game.research[cmd.research];
    const state = world.players[player];
    if (!r || !state) return null;
    if (state.researching !== null || state.researched.includes(r.id)) return null;
    if (!hasResearched(state, r.requires) || state.gold < r.cost) return null;
    return { type: "research", building: cmd.building, research: cmd.research };
  },
  apply(world, player, cmd, game) {
    const state = world.players[player]!;
    state.gold -= game.research[cmd.research]!.cost;
    state.researching = cmd.research;
    state.researchProgress = 0;
  },
};
