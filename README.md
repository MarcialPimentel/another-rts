# RTS Template

A minimal two-player online RTS for the browser, built in Godot, meant to be copied as the starting point for future RTS games.

The proof-of-concept game is deliberately tiny (one Town Hall, one Barracks, one Soldier). What it proves is the hard part: two people in different places playing the same match in their browsers, with a server-authoritative simulation and responsive controls.

**Status:** design complete, code not started. Work is tracked in [milestones](../../milestones) M1 to M5.

## Read this first

- **[docs/GDD.md](docs/GDD.md)** is the game design document and the source of truth. It defines the architecture rules (marked MUST/SHOULD), the command and network protocols, the folder layout, and the milestones.
- **[CLAUDE.md](CLAUDE.md)** is the short version for AI coding sessions.

## How it works

- Clients send **commands** (move, attack, train…) over secure WebSockets.
- A headless Godot **server** validates them and runs the only real simulation at 20 ticks per second.
- The server sends **snapshots** of the world back; clients interpolate and draw them.
- Server and client are one Godot project with two exports, sharing the `sim/` and `data/` code.

## Starting a new game from this template

1. Copy this repo (GitHub "Use this template" or a fresh clone).
2. Keep every section of `docs/GDD.md` marked *Core*.
3. Rewrite the *Game layer* section: your units, buildings, map and win condition.
4. Replace the definitions in `data/`.
5. Record any change to a Core rule in the GDD's Decision log.

When starting an AI session on a new game, point it at this repo and `docs/GDD.md`.

## Stack

| Piece | Choice |
| --- | --- |
| Engine | Godot 4.7.2 (pinned in `.godot-version`) |
| Client | Godot web export, hosted on marz.gg |
| Server | Godot headless Linux export in Docker, hosted on Render (free tier) |
| Transport | `WebSocketMultiplayerPeer` over `wss://` |
| Tests | GUT, run headless in GitHub Actions |
