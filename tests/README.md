# tests/ — headless simulation tests (Core)

Each test builds a world, applies a scripted list of commands, runs a number of ticks, and asserts on the result. They run on every push in CI.

Examples to start with: `train` rejected without enough gold; 10 Soldiers beat 5; a Town Hall at 0 HP ends the match; commands for another player's units are ignored.
