# deploy/ — build and hosting (Core)

- `Dockerfile`: packages the headless server export. Any Docker host can run it; the PoC uses Render's free tier.
- `export_presets.cfg`: the web export (client, single-threaded) and the Linux headless export (server).

The web export is uploaded to marz.gg under `public_html/games/<game-name>/`. The server URL is set in one config value.
