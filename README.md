# Another RTS

A two-player online RTS for the browser, written in TypeScript. It's built from [rts-template](https://github.com/MarcialPimentel/rts-template) `v1.0`.

The game currently plays the template's proof-of-concept ruleset (one Town Hall, one Barracks, one Soldier). Its own units, economy and map come next, starting with a design session.

## Read this first

- **[docs/GDD.md](docs/GDD.md)** is the game design document and the source of truth. It defines the architecture rules (marked MUST/SHOULD), the command and network protocols, the folder layout and the game's content.
- **[CLAUDE.md](CLAUDE.md)** is the short version for AI coding sessions.

## How it works

- Clients send **commands** (move, attack, train…) over secure WebSockets.
- A Node **server** validates them and runs the only real simulation at 20 ticks per second.
- The server sends **snapshots** of the world back; clients interpolate and draw them on a Canvas.
- The simulation, commands, protocol and game data live in `shared/`, imported by both client and server.

## Running it locally

```
npm ci
npm run dev
```

Then open http://localhost:5173 in two browser tabs: create a room in one, join with the code in the other. Add `?sandbox` to the URL to play both sides offline on one screen.

## Template updates

This repo shares history with the template. The `upstream` remote points at `MarcialPimentel/rts-template`, so template fixes come in with:

```
git pull upstream main
```

Networking, lobby, server loop, tooling and deploy fixes belong in the template first. Units, buildings, abilities, maps, art, balance and the game's name belong only here.

## Stack

| Piece | Choice |
| --- | --- |
| Language | TypeScript (strict), Node 22 |
| Client | Canvas 2D, bundled with Vite, published to marz.gg/games/rts (mirror: Render static site `another-rts-client`) |
| Server | Node with `ws`, hosted as the Render free web service `another-rts-server` (Dockerfile included for other hosts) |
| Tests | Vitest, run in GitHub Actions |
