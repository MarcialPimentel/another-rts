# Another RTS

_Current as of G4 · Camera and fog of war (2026-10-28)._

A short two-player online RTS for the browser: shape-based armies, capture points and tech, where every coin goes to army, economy or tech. Matches aim for under 10 minutes.

## Status

- **Built:** four shape units with a counter loop (G1), capture points and point income (G2), tiers and upgrades (G3), zoomable camera, minimap and fog of war (G4).
- **Current milestone:** [G5 · Win and pacing](https://github.com/MarcialPimentel/another-rts/milestone/4): victory points, match timer and a balance pass.
- **Live build:** the commit short hash shown on the title screen. What changed in each milestone is in [CHANGELOG.md](CHANGELOG.md).

## Play it

**https://marz.gg/games/rts/** — create a room, then join with the code from a second browser (or a friend's). The first connection can take up to a minute while the free server wakes. How to playtest: [docs/playtest.md](docs/playtest.md).

## Running it locally

```
npm ci
npm run dev
```

Then open http://localhost:5173 in two browser tabs: create a room in one, join with the code in the other. Add `?sandbox` to the URL to play both sides offline on one screen.

## Docs

- **[docs/README.md](docs/README.md)** lists every doc and what it's for.
- **[docs/GDD.md](docs/GDD.md)** is the game design document and the source of truth: pillars, systems, architecture rules (MUST/SHOULD), protocols and the Decision log.
- **[CLAUDE.md](CLAUDE.md)** is the short version for AI coding sessions.

## How it works

- Clients send **commands** (move, attack, train, research…) over secure WebSockets.
- A Node **server** validates them and runs the only real simulation at 20 ticks per second.
- The server sends each player a **snapshot** of what they can see (fog of war); clients interpolate and draw it on a Canvas.
- The simulation, commands, protocol and game data live in `shared/`, imported by both client and server.

## Template updates

Built from [rts-template](https://github.com/MarcialPimentel/rts-template) `v1.0` with shared history. The `upstream` remote points at the template, so template fixes come in with `git pull upstream main`. Networking, lobby, server loop, tooling and deploy fixes belong in the template first; units, buildings, maps, art, balance and the game's name belong only here.

## Stack

| Piece | Choice |
| --- | --- |
| Language | TypeScript (strict), Node 22 |
| Client | Canvas 2D, bundled with Vite, published to marz.gg/games/rts (backup copy on a Render static site) |
| Server | Node with `ws` on a Render free web service (Dockerfile included for other hosts) |
| Tests | Vitest, run in GitHub Actions |
