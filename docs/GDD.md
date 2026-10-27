# Another RTS — Game Design Document

Last updated 2026-10-27 · Owner: Marz

> This file is the source of truth for Another RTS. If it disagrees with any other copy (chat drafts, docs elsewhere), this file wins.

**Another RTS** is built from `MarcialPimentel/rts-template` v1.0 (the `upstream` remote). The Core sections below come from the template unchanged. The Game layer section describes this game: a short, shape-based RTS about trading off economy, army and tech.

## How to use this template

This is the reference design for every RTS built from this repo: a minimal two-player browser RTS that proves online multiplayer, plus the rules any future RTS must keep. The proof-of-concept game (one Town Hall, one Barracks, one Soldier) is deliberately small; the architecture is the product.

The document has two layers:

- **Template core** (sections marked *Core*): architecture, simulation, commands, networking, project layout, deployment and testing. Future games reuse these unchanged. Changing a Core rule is a deliberate decision recorded in the Decision log.
- **Game layer** (sections marked *Game layer*): content, stats, map and win condition. Every new game replaces this layer.

**Starting a new game from this template:** copy the repo, keep every Core section, rewrite the Game layer section, and add the new game's decisions to the Decision log.

### Rules for AI sessions

Any AI session working on this repo or a game built from it must:

1. Read this document before proposing designs or writing code.
2. Treat **MUST** rules as invariants. If a task seems to require breaking one, stop and raise it instead of working around it.
3. Treat **SHOULD** rules as strong defaults that can be changed with a stated reason.
4. Keep each pull request to one milestone issue, and keep game content in data files rather than code.
5. Update this document in the same pull request when a change affects anything it describes.

## Proof of concept scope *(Core)*

The PoC is done when two people on different networks, each in a browser, can play a full match from lobby to victory screen with responsive controls and both seeing the same result.

**Status (2026-10-27):** done. Two full matches were played on the live build between different networks, including the 150 ms latency check.

**Definition of done:**

- [x] Player 1 creates a room and gets a short room code; Player 2 joins with it.
- [x] Both players issue commands and see each other's units act on them.
- [x] Clicks are acknowledged instantly on screen, even at 150 ms round-trip latency.
- [x] Combat resolves identically for both players.
- [x] Destroying the enemy Town Hall ends the match with a win/lose screen for each player.
- [x] A player who disconnects for more than 30 seconds forfeits.
- [x] The client shows a clear message while the server wakes from sleep.

**Out of scope for the PoC:** workers and harvesting, building placement, fog of war, more than two players, matchmaking, accounts, reconnection to a match in progress, client-side movement prediction, sound beyond click feedback, and art beyond simple shapes.

## Architecture invariants *(Core)*

The server owns the only real game; clients send commands and draw what the server tells them. Every rule below is a **MUST**.

1. **Server-authoritative.** The game server runs the one true simulation. Clients never change game state directly, and the server never trusts a client's claim about state.
2. **Commands as data.** Every player action is a command: a small data object sent to the server, validated, and applied on the next tick. Input handling, AI opponents, replays and tests all produce the same commands.
3. **Simulation separate from presentation.** Simulation code has no nodes for sprites, sound, input or UI, and never reads from them. Presentation reads simulation state and draws it. The simulation must run headless.
4. **Fixed tick.** The simulation advances in fixed steps of 50 ms (20 ticks per second), independent of frame rate. All durations and speeds in data files are in seconds and converted to ticks at load.
5. **One codebase, two targets.** Server and client are one TypeScript repo sharing `shared/` (simulation, commands, protocol, data). The server is a Node process; the client is a browser bundle. Neither duplicates game rules.
6. **Data-driven content.** Units, buildings and costs are defined in `shared/data/`, not inside systems. Adding a unit type requires no simulation code change unless it needs a new ability.
7. **Portable server.** The server is a plain Node process with a Dockerfile, so hosting can move between providers without code changes.
8. **Toolchain pinned.** The Node version is in `.nvmrc` and package versions are locked in `package-lock.json`. Upgrades happen in their own pull request.

```mermaid
flowchart LR
    subgraph Client["Browser client (Canvas)"]
        Input["Input<br/>clicks to commands, instant markers"]
        Pres["Presentation<br/>interpolates snapshots, draws world"]
    end
    subgraph Server["Game server (Node)"]
        Val["Validate commands<br/>ownership, cost, cap; else dropped"]
        Sim["Simulation, 20 ticks/s<br/>income, production, combat, win"]
        Snap["Snapshot<br/>full state sent to both players"]
    end
    Input -- "commands over wss" --> Val
    Val --> Sim --> Snap
    Snap -- "snapshots, 20 per second" --> Pres
    Shared[("Shared by both: shared/ (sim, commands, protocol, data)")]
```

The client never changes the world itself: its clicks become commands, and what it draws comes only from server snapshots.

## Simulation model *(Core)*

The simulation is a plain state object advanced one tick at a time by a fixed sequence of systems.

**World state** holds the tick number, each player's resources and status, and a map of entities keyed by integer ID. It is plain JSON-serializable data, so it can be sent as a snapshot as is. The server assigns IDs and never reuses them within a match.

**Entities** have an ID, an owner, a type ID pointing at its definition, a position, current HP, and optional components: `mover` (target, speed), `attacker` (target, cooldown), `producer` (queue, progress) and `income` (amount per second). Systems act on whichever components an entity has.

**Definitions** are typed data objects in `shared/data/`, one per unit or building type, holding cost, HP, speed, damage, range, attack interval, build time and which components it gets. A game's whole roster lives here.

**Tick order** (SHOULD stay stable, since order affects outcomes):

1. Apply queued commands, in arrival order, after validation.
2. Income: add resources.
3. Production: advance queues; spawn finished units at the building's rally point.
4. Targeting: idle and attack-moving units acquire the nearest enemy in sight range.
5. Movement: move toward targets; apply simple separation so units don't stack.
6. Combat: units in range with a ready cooldown deal damage.
7. Deaths: remove entities at 0 HP and clear references to them.
8. Win check: a player with no Town Hall loses.

**Movement** in the PoC is straight-line with separation on an open map. Pathfinding is an extension point, added behind the movement system without changing commands.

**Randomness**, if ever needed, MUST come from a seeded generator owned by the simulation, so tests and replays are reproducible.

## Command protocol *(Core)*

Six commands cover the PoC; every one is validated by the server and silently dropped if invalid.

Each command carries `type`, a client-side sequence number `seq` (so the client can match acknowledgments), and its arguments. The server stamps the sending player's ID itself; a `player_id` sent by a client is ignored.

| Command | Arguments | Server validation |
| --- | --- | --- |
| `move` | unit IDs, target position | Units exist, belong to sender, can move; position clamped to map |
| `attack` | unit IDs, target entity ID | Units belong to sender; target exists and is an enemy |
| `attack_move` | unit IDs, target position | As `move`; units engage enemies met on the way |
| `stop` | unit IDs | Units belong to sender |
| `train` | building ID, unit type ID | Building belongs to sender and can produce that type; sender can afford it; queue not full; unit cap not reached |
| `set_rally` | building ID, position | Building belongs to sender and is a producer |

Rules:

- Commands MUST describe intent, never results. `move` says where to go, not where a unit now is.
- Unit ID lists SHOULD be capped (64 per command) to bound message size.
- New commands are added by defining the schema here, a validator, and an apply function. Nothing else in the network layer changes.

## Network protocol *(Core)*

Clients talk to the server over secure WebSockets; commands go up, full-state snapshots come down 20 times a second.

**Transport.** The browser's native `WebSocket` on the client and the `ws` library on the server, over `wss://` (browsers cannot use UDP, and an HTTPS page requires secure sockets). TLS is terminated by the host. Messages are JSON, typed in `shared/protocol.ts`. Messages SHOULD go through a thin `NetProtocol` layer so the transport or encoding can be swapped (for example to WebRTC or binary) without touching game code.

**Rooms.** One server process hosts many rooms. Each room has its own simulation, a 4-letter code (letters only, no I, L or O), and exactly two player slots. Lifecycle: `waiting` (the lobby) → `countdown` (3 seconds) → `playing` → back to `waiting`. In the lobby each player picks a colour (not one the other player holds) and presses Ready; the countdown starts when both players are present and ready, and unreadying or leaving cancels it. After a match the room returns to the lobby with Ready cleared, so the same pair can play again. Empty rooms are deleted after 60 seconds.

**Messages** (exact types in `shared/protocol.ts`):

| Direction | Message | Purpose |
| --- | --- | --- |
| Client → server | `create_room` | Make a room, receive its code |
| Client → server | `join_room` | Join by code |
| Client → server | `command` | One command with the client's `seq` (see Command protocol) |
| Client → server | `ping` | Latency measurement |
| Client → server | `set_color` | Lobby: pick a colour (index into `PLAYER_COLORS` in `shared/lobby.ts`) |
| Client → server | `set_ready` | Lobby: ready or unready |
| Client → server | `leave` | Leave the room (mid-match, this forfeits immediately) |
| Server → client | `hello` | Sent on connect with the server's build number |
| Server → client | `room` | Lobby status: code, phase, your slot, who's connected, colours, who's ready, countdown |
| Server → client | `error` | Unknown room, full room, or malformed message |
| Server → client | `match_start` | Your player slot, both players' colours, and the entity type list for decoding snapshots |
| Server → client | `snapshot` | Tick number, your last applied `seq`, full entity and resource state, match result |
| Server → client | `match_end` | Winner and reason |
| Server → client | `opponent_disconnected` | The opponent dropped; time until they forfeit |
| Server → client | `pong` | Latency reply |
| Server → client | `room_closed` | The room was cleaned up |

**Snapshots.** The PoC sends the full state every tick (20 Hz), encoded compactly: each entity is a short array of rounded numbers, so a 60-unit battle is under 3 KB, and WebSocket compression shrinks it further. This matters on free hosting with a monthly bandwidth allowance. Delta compression is an extension point for when unit counts grow.

**Interpolation.** Clients render about 100 ms behind the newest snapshot and interpolate positions between the two snapshots around that time. This hides jitter at the cost of a small, constant delay.

**Disconnects.** A player whose socket closes during a match has 30 seconds before forfeiting; the opponent sees a countdown banner. A player who leaves on purpose forfeits immediately. Reconnecting into that window is out of scope for the PoC, so in practice a disconnect is a loss.

## Client presentation and UX *(Core)*

The client must feel instant even though nothing happens until the server confirms it: acknowledge every input the moment it is made.

**Controls (standard RTS conventions, SHOULD keep):**

- Left-click selects a unit or building; drag selects a box of own units; Shift adds to selection.
- Right-click on ground: `move`. Right-click on an enemy: `attack`. `A` then left-click: `attack_move`. `S`: `stop`.
- With a Barracks selected: a Train button (and hotkey `Q`) sends `train`; right-click on ground sends `set_rally`.
- Camera pans with edge scrolling and arrow keys; the PoC map fits about two screens wide.

**Instant feedback (MUST).** On any command, immediately show a marker at the click point (green for move, red for attack) and play a short click sound, before the server responds. Training shows the queued unit at once, greyed out until the snapshot confirms it.

**HUD:** gold, unit count against cap, the selected entity's HP and production queue, ping in milliseconds, and the room code while waiting.

**Readability:** each player keeps the colour they picked in the lobby on every entity they own, on both players' screens, so both players agree on who is who. HP bars show above damaged entities. The local player's base is always shown on the left of the map for orientation (player 2's view is mirrored).

**Lobby:** after creating or joining a room, players see the room code and invite link, both player slots with their colour and Ready state, a colour picker, and a Ready button. The countdown shows in the lobby. After a match, "Back to lobby" returns there for another round.

**Sandbox** (`?sandbox`): the same game screen driven by a local copy of the simulation, with Tab switching between players. Useful for testing rules and content without a server.

**Server wake screen (MUST).** If the server does not answer within 2 seconds, show "Waking up the server, this can take up to a minute" with a progress indicator, and keep retrying. Never show a silent hang or a raw connection error during a cold start.

## Game layer: Another RTS *(Game layer)*

Two commanders fight over a small map with shape-based armies. Every coin goes to **army** (win fights now), **economy** (earn more later) or **tech** (make every later unit better), and that three-way choice is the game. Matches last under 10 minutes.

**Design pillars:**

1. **Economy vs army vs tech.** One currency (gold) funds all three, so every purchase is a trade-off you can read. A second resource is only added if tech needs its own pressure.
2. **Shapes first, flavour later.** Units are geometric shapes with clear silhouettes. The theme gets painted on once the systems play well; until then readability beats looks.
3. **Systematic and modular.** Each mechanic is one system (or one data field) with its own tests and its own place in the tick order, added one milestone at a time. New units should be data, not code.
4. **Short matches.** Target 6–9 minutes, hard ceiling 10. Prefer mechanics that force a result (map control, victory points) over ones that reward turtling.

**Status:** the template's PoC ruleset is being replaced milestone by milestone (see Game milestones). Sections below mark what is **built** and what is **planned**.

### Army: four shapes and a counter loop *(G1)*

Both players share one roster, trained at the Barracks. Counters come from two data fields, not special code: **armour** (flat reduction per hit, minimum 1 damage) and **bonus damage against tags** (`light`, `heavy`, `structure`). Fast, weak hits lose to armour; big hits ignore it.

| Shape | Unit | Role | Strong vs | Weak vs |
| --- | --- | --- | --- | --- |
| ■ Square | Line | Armoured melee front line | Raiders (armour shrugs off their small hits) | Ranged (bonus vs heavy) |
| ▲ Triangle | Raider | Fast, fragile skirmisher; captures points faster (G2) | Ranged, Siege (closes the gap fast) | Line |
| ● Circle | Ranged | Damage from behind the line | Line | Raiders |
| ⬢ Hexagon | Siege | Very long range, slow, big hits | Buildings (bonus vs structure), slow groups | Raiders |

Stats live in `shared/data/game.ts` and are tuned there; the table in that file is the current truth. Starting values:

| Entity | Tags | Cost | HP | Armour | Build (s) | Speed (px/s) | Damage / interval (s) / range (px) | Bonus |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HQ | structure | — | 2000 | 3 | — | — | — | Gives 5 gold/s; losing it loses the match |
| Barracks | structure | — | 1000 | 3 | — | — | — | Trains all four units; queue of 5 |
| Line | heavy | 60 | 160 | 2 | 6 | 70 | 10 / 1.0 / 20 | — |
| Raider | light | 50 | 75 | 0 | 4 | 140 | 7 / 0.6 / 15 | — |
| Ranged | light | 70 | 70 | 0 | 6 | 80 | 10 / 1.0 / 140 | ×2 vs heavy |
| Siege | heavy | 120 | 120 | 1 | 9 | 50 | 36 / 3.0 / 260 | ×3 vs structure |

The counter loop is checked by equal-gold battle tests in `tests/balance.test.ts`; a stat change that breaks the loop fails CI.

**Combat feedback (G1):** each unit draws as its shape in its owner's colour. Attacks show as a slash for melee and a tracer for ranged and siege, hit units flash, and dying units burst. Snapshots carry each attacker's target and how long ago it last fired so both players see the same shots.

### Economy: capture points *(planned, G2)*

Each HQ gives a small trickle; most income comes from **capture points** held on the map. This makes map control the main fight and needs no pathfinding.

- **Map:** 5 points. One safe point near each base, two contested side points, and a centre point worth more.
- **Capturing:** units standing on a point with no enemy units nearby take it over about 8 seconds (faster with more units, capped; Raiders count double). An enemy-owned point must be made neutral first. Contested points pause.
- **Income (starting values):** HQ 3 gold/s, side and safe points +2 gold/s, centre +3 gold/s.
- **Economy investment (G3):** *Overclock*, researched at the HQ, adds income per owned point. Strong when you hold the map, wasted when you don't.

### Tech: tiers and upgrades *(planned, G3)*

- **Tier 2** is an upgrade at the HQ (~200 gold, ~30 s). Tier 1 trains Line and Raider; Tier 2 unlocks Ranged and Siege. Unit definitions get a `requires` field.
- **Research** at the HQ: Weapons +1 (damage), Armour +1, and Overclock. Each is a `research` command, a research queue, and per-player upgrade levels that the combat and income systems read.
- **No building placement yet.** Tech lives in the pre-placed buildings.

Until G3 lands, all four units are trainable from the start so the counters can be playtested.

### Win condition and pacing *(planned, G4)*

- **Victory points:** each owned capture point earns victory points every second; the first player to the target wins. Destroying the enemy HQ also wins at once. Opponent disconnect for 30 seconds still forfeits.
- **Target pacing:** 0:00–1:30 take your safe point and race Raiders to the side points; 1:30–4:00 choose between Tier 2, Overclock and more army; 4:00–8:00 fight over the centre and push with Siege.

Until G4, the only win is destroying the enemy HQ (or a forfeit).

### Map and economy (from G1)

**Map:** 2400 × 1000 px, flat and open, mirrored left to right. Each HQ sits 200 px from its edge. **Economy:** starting gold 200, HQ income 5 gold/s, unit cap 30 units per player (alive plus queued), no upkeep.

### Game milestones

Each milestone ends in something to playtest, tracked on GitHub as a milestone with one issue per task.

| Milestone | Scope | Playtest question |
| --- | --- | --- |
| G1 · Combat foundation | Armour and tag bonuses, the four units as data, shape rendering, attack and hit effects, train hotkeys Q/W/E/R | Do the counters feel right and read clearly? |
| G2 · Capture points | Point entity, capture system, point income, 5-point map, point status in the HUD | Is the map worth fighting over? |
| G3 · Tech | `research` command, tiers, `requires` on units, Weapons/Armour upgrades, Overclock | Is the army/economy/tech choice real? |
| G4 · Win and pacing | Victory points, match timer, balance pass | Do matches end in 6–9 minutes? |

These numbers are starting points for playtesting, not balanced values. They live in `shared/data/` and are tuned there.

## Project structure *(Core)*

The folder layout enforces the architecture: `shared/` may never import from `client/` or `server/`, and only `shared/data/` changes when a new game swaps its content.

```
another-rts/
  docs/GDD.md              this document
  package.json             one package; scripts for dev, build, test
  .nvmrc                   pinned Node version
  render.yaml              Render Blueprint (server + client)
  shared/                  imported by both client and server; no DOM, no Node APIs
    sim/
      world.ts             world state, entities, tick loop
      systems/             income, production, targeting, movement, combat, deaths, win check
      commands/            one module per command: validate and apply
    data/                  game layer: unit and building definitions, map, economy constants
    protocol.ts            message types, validation and the snapshot codec
    view.ts                drawable view of the world (from the sim or a snapshot)
  server/src/              Node entry point, NetProtocol (ws), room manager, room loop
  client/src/
    game/                  game screen: Canvas rendering, camera, input, HUD, feedback,
                           and the Session interface (local sandbox or online)
    net/                   NetProtocol (browser WebSocket), online session, snapshot buffer
    screens/               online flow: connect and wake screen, lobby, rematch
  tests/                   Vitest: simulation tests and server integration tests
  deploy/Dockerfile        portable server container (Render runs Node natively)
  .github/workflows/       typecheck, test and build on every push
```

Rules: `shared/` must run in both a browser and Node, so it uses no DOM or Node-only APIs. TypeScript runs in strict mode everywhere.

## Deployment *(Core; hosts are Game layer choices)*

Both pieces deploy from `render.yaml` on every push to `main`: the client as a free static site that never sleeps, the server as a free Node web service reached at a `wss://` address set in one config value.

| Piece | PoC host | Notes |
| --- | --- | --- |
| Web client | marz.gg/games/rts (SiteGround), published by `.github/workflows/deploy-marz.yml` on every push | Static files, so it loads instantly even while the server sleeps. Needs the four `SITEGROUND_*` repository secrets; skips until they're set |
| Web client (mirror) | Render static site (`another-rts-client`) | Same build; handy if marz.gg is down |
| Game server | Render free web service (`another-rts-server`) | Sleeps after 15 minutes idle; waking takes about a minute |
| Fallback server | Own PC plus a free tunnel, or a ~$5/month VPS | `deploy/Dockerfile`; only the server URL changes |

Rules:

- The server URL MUST be a single config value (`VITE_SERVER_URL` at client build time), never hard-coded in game code.
- Every build shows a build number (commit short hash) on the title screen, and the server reports its build number on connect. A client and server on different builds show a "please refresh" message instead of connecting.
- The server answers `GET /healthz` for Render's health check.

## Testing *(Core)*

Game rules are proven by headless tests that feed commands into the simulation and check the outcome, so AI-written changes are verified without manual play.

- **Simulation tests (MUST, run on every push):** build a world, apply a scripted list of commands, run N ticks, assert on state. Examples: a `train` with too little gold is rejected; 10 Soldiers beat 5; a Town Hall at 0 HP ends the match; commands for another player's units are ignored.
- **Server integration tests (MUST, run on every push once networking exists):** start the real server, connect two scripted clients, create and join a room, play commands through to a result, and check both clients received the same snapshots.
- **Two-client local test (each networking PR):** run the server and two browser tabs on one machine, play a match, and confirm both screens agree.
- **Latency test (before calling the PoC done):** play with 150 ms of added latency and confirm controls still feel responsive. Add `?lag=150` to the game URL to simulate it (half on send, half on receive). Measured 2026-10-25: markers, sound and pending trains appear within one frame; units start moving on screen about 255 ms after a click (150 ms round trip + 100 ms interpolation delay + up to one tick).
- **Online playtest (milestone gate):** two people on different networks complete a match against the deployed server.

Tests use Vitest and run in GitHub Actions on every push and pull request.

## Milestones *(Core)*

Five milestones, each ending in something you can play or see, tracked on GitHub as one milestone with issues per task.

```mermaid
flowchart TD
    M1["M1 · Foundation<br/>Repo, GDD, TypeScript project with the shared/client/server split, CI, client and server live on Render with a build number"]
    M2["M2 · Local sandbox<br/>Full ruleset offline, both players driven from one screen through commands, simulation tests in CI"]
    M3["M3 · Networking<br/>Headless server, WebSocket rooms with codes, snapshots and interpolation, two clients on one machine"]
    M4["M4 · Online<br/>Server live on Render with a Dockerfile for portability, wake screen, client and server build-number check"]
    M5["M5 · Hardening<br/>Ping display, disconnect forfeit, rematch button, 150 ms latency test"]
    Done(["Template ready to copy for the next RTS"])
    M1 -- "Gate: the client loads on Render with the right build number" --> M2
    M2 -- "Gate: a full match plays to a victory screen locally" --> M3
    M3 -- "Gate: both screens agree through a full match" --> M4
    M4 -- "Gate: two people on different networks finish a match" --> M5
    M5 -- "Gate: every Definition of done item is checked" --> Done
```

M2 is the one to protect: once the game works locally through commands, adding the network in M3 is a contained change instead of a rewrite.

## Extension points *(Core)*

Future games grow the template through these planned seams, none of which change the architecture invariants.

| Feature | Where it plugs in | Notes |
| --- | --- | --- |
| New unit or building | A definition in `data/` | No code unless it needs a new ability |
| New ability (heal, ranged, build) | A new component plus a system in the tick order | Document its place in the tick order |
| Workers and harvesting | `gather` command, resource nodes, carry component | Needs pathfinding first |
| Building placement | `build` command with server-side footprint validation | Client shows a ghost preview |
| Pathfinding | Inside the movement system (a grid A* or flow field) | Commands unchanged |
| Fog of war | Server filters each player's snapshot to what they can see | Only possible because the server is authoritative |
| AI opponent | A server-side bot that emits commands into a room | Same validation as a human |
| Replays | Record match seed plus the command log; replay through the simulation | Requires the seeded-randomness rule |
| Larger battles | Delta-compressed snapshots, lower snapshot rate | Inside `net/` only |
| Reconnection | Rejoin token; server sends a full snapshot on rejoin | Fits the existing 30-second window |
| More than two players | Room slot count and team assignment | Win check becomes "last team standing" |
| Deterministic lockstep | Swap state sync for command broadcast | Only if unit counts reach thousands; requires fixed-point math |

## Decision log and open questions

Record every change to a Core rule here, newest first, with the reason.

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-10-27 | Game design: one currency split between economy, army and tech; capture-point income; four shared shape units with an armour/bonus-damage counter loop; tiers and research; victory points; matches under 10 minutes. Built in four milestones (G1–G4) | Design session with the owner. Shapes keep art cost at zero while the systems are proven; capture points avoid pathfinding; victory points stop turtling and keep matches short |
| 2026-10-27 | Another RTS created from rts-template v1.0 with shared history (`upstream` remote). It takes over the marz.gg/games/rts page and the SiteGround secrets; its own Render services are `another-rts-server` and `another-rts-client`, and the template's live deploys are retired | The template isn't played on its own, so the game reuses its page and settings. Only one repo deploys to each place, so template pushes can't overwrite the game |
| 2026-10-25 | Client also published to marz.gg/games/rts from GitHub Actions over SSH; asset paths are relative so one build works at a root or in a subfolder | Wanted the game on the owner's own domain; the server stays on Render because shared hosting can't run it |
| 2026-10-25 | Ready-up lobby with colour choice; players keep their own colour on both screens (was: local player always blue, opponent red); rooms return to the lobby after a match instead of a separate rematch step | Playtest feedback: seeing your own colour swapped on the other screen was confusing, and a lobby before the match was wanted |
| 2026-10-25 | Leaving mid-match forfeits immediately; only dropped connections get the 30 s grace period | Nobody should wait 30 s for a player who chose to leave |
| 2026-10-25 | Compact snapshot encoding plus WebSocket compression | Render's free tier has a small monthly bandwidth allowance |
| 2026-10-25 | Client hosted as a Render static site instead of marz.gg | Loads instantly while the server wakes; deploys from the repo with no manual upload |
| 2026-10-25 | Switched from Godot 4.7.2 to TypeScript (Node server, Canvas client, Vite, Vitest) | One language shared by client and server, small fast-loading client, and the whole game can be built and tested headlessly by AI sessions. Architecture rules are engine-agnostic, so a later port is a code rewrite, not a redesign |
| 2026-10-25 | Godot 4.7.2 pinned | Latest stable release at project start (superseded the same day) |
| 2026-10-25 | Repo `MarcialPimentel/rts-template`; this file is the canonical GDD | One source of truth that AI sessions can be pointed at |
| 2026-10-25 | Barracks pre-placed in the PoC | Building placement is its own UX problem; listed as an extension point |
| 2026-10-25 | Server hosted on Render free tier, with a Dockerfile for portability | Free for under 5 playtesters; a later move to a ~$5 VPS is a config change |
| 2026-10-25 | Server-authoritative state sync over deterministic lockstep | Floating-point determinism across machines isn't guaranteed; desync bugs are hard to debug in AI-written code |
| 2026-10-25 | WebSockets over WebRTC | Browsers cannot use UDP; WebRTC needs a signaling server and has NAT issues |
| 2026-10-25 | No workers in the PoC; passive income | Harvesting adds pathing and AI work without testing networking |

**Open questions:**

- [ ] Render's free-tier limits are current as of October 2026 and change often; recheck before deploying (M4).
