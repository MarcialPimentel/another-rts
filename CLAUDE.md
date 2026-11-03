# Instructions for AI sessions

This repo is Another RTS: a short two-player browser RTS with shape-based armies, capture points and tech, in TypeScript (Node server, Canvas client), built from `MarcialPimentel/rts-template` v1.0 (the `upstream` remote). Template fixes (networking, lobby, server loop, tooling, deploys) go in rts-template first and are pulled in here; game content goes only here.

## Before doing anything

Read `docs/GDD.md` in full before any design or code decision. It is the source of truth. Check every change against its **design pillars** (Game layer section). If a request conflicts with the GDD, say so before acting.

## How Marz works

Marz (the owner) designs and playtests; he does not write the code. Give honest critique, including disagreement with his ideas, with reasons. He makes the final call.

## Workflow

- Work on a branch and open a pull request with playtest steps (what to try at https://marz.gg/games/rts/ once it ships).
- Marz says "merge #N"; merge only that PR. Never push to `main` directly.
- On this machine, run `gh` with `-R MarcialPimentel/another-rts`: without it, `gh` resolves to the `upstream` template repo.

## Non-negotiable rules (summary of the GDD's MUST rules)

- **Server-authoritative.** Only the server changes game state. Clients send commands and draw snapshots.
- **Commands as data.** Every player action is a command object: validated by the server, applied on the next tick. AI bots, replays, tests and the local sandbox use the same commands.
- **`shared/` is pure.** No DOM, no Node-only APIs, and no imports from `client/` or `server/`. It must run in both a browser and Node.
- **Fixed tick of 50 ms** (20 per second). Data files use seconds; convert to ticks at load.
- **Content lives in `shared/data/`**, not hard-coded in systems.
- **Server URL is one config value** (`VITE_SERVER_URL`). Never hard-code it.
- **Instant input feedback** on the client, and a "waking up the server" screen instead of a silent hang.
- **Toolchain pinned**: Node version in `.nvmrc`, packages in `package-lock.json`. Upgrades get their own pull request.

## Commands

- `npm ci` — install
- `npm run dev` — server on :8080 plus client dev server on :5173
- `npm test` — Vitest (simulation and server integration tests)
- `npm run typecheck` — TypeScript strict check
- `npm run build` — client to `client/dist`, server to `server/dist`

## How to work

- One pull request per milestone issue. Reference the issue number (`Closes #N`).
- Add or update tests in `tests/` for any simulation or protocol change. `npm test` and `npm run typecheck` must pass before merging.
- If a change affects anything the GDD describes, update `docs/GDD.md` in the same pull request.
- If a task seems to require breaking a MUST rule, stop and explain why instead of working around it.

## Where the docs are

See `docs/README.md` for the full list: `docs/GDD.md` (design, rules, Decision log, milestones/roadmap), `CHANGELOG.md`, `docs/playtest.md`, `docs/deploy.md`. Private hosting details never go in tracked files.

## Ship and build notes

_Read by the `ship`, `next-build` and `prod-run` skills, which keep no per-game notes of their own. Keep this section current when the deploy or build process changes._

### Shipping (merge, deploy, live check)

- **Default branch:** `main`. **Merge style:** squash.
- **Deploy:** two parts.
  - Client: `deploy-marz.yml` ("Deploy client to marz.gg") builds and uploads to marz.gg/games/rts over SSH. If it says the SiteGround secrets aren't set, the upload skipped: that's a failure to report.
  - Server: Render auto-deploys `another-rts-server` from `main` (not a GitHub workflow; takes a few minutes, longer if the free-tier server was asleep).
- **Live check:** both must report `<sha7>`:
  - Server: `curl -s -m 90 https://another-rts-server.onrender.com/healthz` → `{"ok":true,"build":"<sha7>",...}`. The first call may take up to a minute while it wakes. Retry every 30s for up to ~8 minutes while Render deploys.
  - Client: find the bundle in `curl -s https://marz.gg/games/rts/` (`assets/index-*.js`) and `grep -o <sha7>` in it.
  - If they don't match, players get the "please refresh" message: report which one is behind.
- **Playtest link:** https://marz.gg/games/rts/ (two browser tabs make a 2-player test).

### Planning and building the next build

- **Where the next build comes from:** GitHub milestones G1–G4 (G1 Combat foundation, G2 Capture points, G3 Tech, G4 Win and pacing) and their issues; `docs/GDD.md` (Game layer) is the source of truth.
- **Template rule:** fixes to the template core (networking, lobby, server loop, tooling, deploys) go to `rts-template` first and are pulled in here (`upstream` remote). Only game content is built directly here. If a build item is really a core fix, say so and propose doing it in rts-template.
- **Branch / PR:** one PR per milestone issue, branch `g<N>/<slug>`, `Closes #N`. Squash-merged.
- **Before the PR:** `npm run typecheck` and `npm test`, with tests in `tests/` for any simulation or protocol change. Two-tab playtest locally with `npm run dev` if possible.
- **Docs in the same PR:** `docs/GDD.md` (and its Decision log) for anything it describes.
