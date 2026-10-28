import { perSecondToPerTick } from "../constants";
import type { System } from "../step";
import { techModifiers } from "../tech";

/** Adds each income entity's gold per tick to its owner. Owned capture points add Overclock. */
export const income: System = (world, game) => {
  const bonus = world.players.map((p) => perSecondToPerTick(techModifiers(p, game).pointIncome));
  for (const e of Object.values(world.entities)) {
    const def = game.defs[e.type]!;
    if (def.incomePerTick <= 0) continue;
    const owner = world.players[e.owner];
    if (!owner || owner.defeated) continue;
    owner.gold += def.incomePerTick + (def.kind === "point" ? bonus[owner.id]! : 0);
  }
};
