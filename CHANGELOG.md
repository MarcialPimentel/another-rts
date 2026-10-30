# Another RTS — Changelog

_Current as of G4 · Camera and fog of war (2026-10-28)._

What changed for players, newest first. The game has no version numbers yet, so entries are grouped by milestone. Every build shows its commit short hash on the title screen.

## G4 · Camera and fog of war — 2026-10-28

- Zoom in and out with the mouse wheel or `+`/`-`, pan with edge scrolling, arrow keys or middle-mouse drag; `Space` centres on your HQ ([#16](https://github.com/MarcialPimentel/another-rts/pull/16)).
- A minimap in the bottom-right shows the whole map; click or drag it to move the camera, right-click it to send units ([#16](https://github.com/MarcialPimentel/another-rts/pull/16)).
- Fog of war: you only see enemy units near your own units and buildings. Outside your vision the map is dimmed; the server never sends what you can't see ([#17](https://github.com/MarcialPimentel/another-rts/pull/17)).
- You get a warning (pulsing ring, minimap pulse, top-bar message) when the enemy is taking one of your points ([#17](https://github.com/MarcialPimentel/another-rts/pull/17)).

## G3 · Tech — 2026-10-28

- Research at the HQ: Tier 2, Weapons 1–2, Armour 1–2 and Overclock, each bought with gold ([#13](https://github.com/MarcialPimentel/another-rts/pull/13)).
- Siege now needs Tier 2; Line, Raider and Ranged are available from the start ([#13](https://github.com/MarcialPimentel/another-rts/pull/13)).
- Both players' tech shows in the top bar ([#13](https://github.com/MarcialPimentel/another-rts/pull/13)).

## G2 · Capture points — 2026-10-28

- Five capture points on the map (one safe point per side, two side points, the centre) that pay gold every second on top of the HQ's income ([#12](https://github.com/MarcialPimentel/another-rts/pull/12)).
- Stand on a point to capture it; enemy points must be neutralised first, and contested points pause. Raiders capture twice as fast ([#12](https://github.com/MarcialPimentel/another-rts/pull/12)).
- The HUD shows gold per second and points held by each side ([#12](https://github.com/MarcialPimentel/another-rts/pull/12)).

## G1 · Combat foundation — 2026-10-27

- The game's own design is written into the GDD: pillars, units, economy, tech and milestones ([#8](https://github.com/MarcialPimentel/another-rts/pull/8)).
- Four shape units replace the template's Soldier: Line (square), Raider (triangle), Ranged (circle) and Siege (hexagon), with armour and bonus damage making a counter loop ([#9](https://github.com/MarcialPimentel/another-rts/pull/9)).
- Units draw as their shapes in your colour, with slashes, tracers, hit flashes and death bursts; train units with `Q`/`W`/`E`/`R` ([#10](https://github.com/MarcialPimentel/another-rts/pull/10)).

## Start from the template — 2026-10-27

- Another RTS created from rts-template v1.0: online two-player rooms with codes, a ready-up lobby with colours, a wake-up screen while the server starts, and the template's one-unit proof-of-concept game ([#1](https://github.com/MarcialPimentel/another-rts/pull/1)).
- The game takes over marz.gg/games/rts; pages no longer get stuck on an old build after a deploy ([#11](https://github.com/MarcialPimentel/another-rts/pull/11)).
