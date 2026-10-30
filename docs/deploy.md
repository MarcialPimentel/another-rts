# Another RTS — Deploy

_Current as of G4 · Camera and fog of war (2026-10-28)._

## How a merge reaches players

When a pull request is merged into `main`, three things happen on their own:

1. **CI** (`.github/workflows/ci.yml`) runs the typecheck, tests and builds.
2. **Client:** `.github/workflows/deploy-marz.yml` ("Deploy client to marz.gg") builds the web client and uploads it to the website host over SSH, at **https://marz.gg/games/rts/**. It skips with a notice if the hosting secrets aren't set; that counts as a failed deploy.
3. **Server:** Render redeploys the game server (`another-rts-server`) from `main` using `render.yaml`. This isn't a GitHub workflow and takes a few minutes. The free server sleeps after 15 minutes idle, so the first visit after that waits about a minute.

A backup copy of the client is also built on a Render static site (`another-rts-client`, from `render.yaml`). It is only a backup; players use marz.gg.

The page itself is never cached, so players get the new build on reload (`client/public/.htaccess`).

## Checking what's live

Both parts report the commit short hash they were built from, and they should match the latest merge:

- **Server:** open `https://another-rts-server.onrender.com/healthz`; it answers `{"ok":true,"build":"<hash>",...}` (may take a minute to wake).
- **Client:** the title screen at https://marz.gg/games/rts/ shows the build hash.

If they differ, players see a "please refresh" message instead of connecting; one of the two hasn't finished deploying yet.

## One-time setup (already done)

These are done for this game; they only need redoing if hosting changes.

1. **Website upload secrets.** In GitHub: the repo → Settings → Secrets and variables → Actions → New repository secret. The workflow needs `SITEGROUND_HOST`, `SITEGROUND_USER`, `SITEGROUND_SSH_KEY` and `SITEGROUND_PATH` (plus `SITEGROUND_KEY_PASSWORD` if the key has a password). Where to find each value is described at the top of `deploy-marz.yml`. Never put the values themselves in any file.
2. **Render.** In the Render dashboard: New → Blueprint, pick this repo; it creates `another-rts-server` and `another-rts-client` from `render.yaml`, both deploying from `main`.
3. **Server address.** The client finds the server through one setting, `VITE_SERVER_URL`. If the server ever moves, change that one value (in the workflow and `render.yaml`).

## Moving the server

The server is a plain Node process with `deploy/Dockerfile`, so it can run on another host (a small VPS, or a PC with a tunnel) by changing only the server address above.
