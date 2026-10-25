# sim/ — pure simulation (Core)

The one true game rules, run by the server every 50 ms tick.

- `world_state.gd`: tick number, players' resources and status, entities keyed by integer ID.
- `systems/`: one script per system, run in the GDD's tick order (income, production, targeting, movement, combat, deaths, win check).
- `commands/`: one script per command with its schema, validator and apply function.

MUST: no rendering, input, sound or UI nodes here, and no imports from `client/`. Everything here must run headless and be testable from `tests/`.
