# Instructions for AI sessions

This repo is an RTS template: a minimal two-player browser RTS in Godot 4.7.2 that future RTS games are copied from. The owner reviews pull requests and playtests; he does not write the code himself.

## Before doing anything

Read `docs/GDD.md` in full. It is the source of truth. If a request conflicts with it, say so before acting.

## Non-negotiable rules (summary of the GDD's MUST rules)

- **Server-authoritative.** Only the server changes game state. Clients send commands and draw snapshots.
- **Commands as data.** Every player action is a command object: validated by the server, applied on the next tick. AI bots, replays and tests use the same commands.
- **`sim/` is pure.** No rendering, input, sound or UI nodes in `sim/`, and `sim/` never imports from `client/`. It must run headless.
- **Fixed tick of 50 ms** (20 per second). Data files use seconds; convert to ticks at load.
- **Content lives in `data/`** as resources, not hard-coded in scripts.
- **Server URL is one config value.** Never hard-code it.
- **Instant input feedback** on the client, and a "waking up the server" screen instead of a silent hang.
- **Godot version is pinned** in `.godot-version`. Do not upgrade without a dedicated pull request.

## How to work

- One pull request per milestone issue. Reference the issue number.
- Add or update headless tests in `tests/` for any simulation change.
- Use static typing in GDScript and follow the Godot style guide.
- If a change affects anything the GDD describes, update `docs/GDD.md` in the same pull request.
- If a task seems to require breaking a MUST rule, stop and explain why instead of working around it.
