# Another RTS — Playtesting

_Current as of G4 · Camera and fog of war (2026-10-28)._

## Play the current build

1. Open **https://marz.gg/games/rts/**. If the server was asleep, a "Waking up the server" screen shows for up to a minute; wait, it retries on its own.
2. One player creates a room and shares the 4-letter code or invite link; the other joins with it.
3. In the lobby each player picks a colour and presses Ready. The match starts after a 3-second countdown.
4. After a match, "Back to lobby" lets the same pair play again.

**Testing alone:** open the link in two browser tabs (create in one, join in the other), or use **Sandbox** on the title screen to play both sides offline on one screen (`Tab` switches player).

**Which build am I on?** The title screen shows the build (commit short hash). If the page says "please refresh", reload it: the client and server are on different builds while a deploy finishes.

**Testing lag:** add `?lag=150` to the address to simulate 150 ms of round-trip latency.

## Controls

- Left-click selects; drag a box to select several units; `Shift` adds to the selection.
- Right-click ground to move, right-click an enemy to attack. `A` then left-click: attack-move. `S`: stop.
- Barracks selected: `Q`/`W`/`E`/`R` train Line, Raider, Ranged, Siege; right-click ground sets the rally point.
- HQ selected: `Q`/`W`/`E`/`R` research Tier 2, Weapons, Armour, Overclock.
- Camera: edge scroll, arrow keys or middle-mouse drag; mouse wheel or `+`/`-` zooms; `Space` centres on your HQ. Click or drag the minimap to move the view; right-click it to send units.

## What to look for

The current playtest question for each milestone is in the [GDD's Game milestones table](GDD.md#game-milestones). Right now (G5 · Win and pacing is next):

- Do the counters feel right? (Line beats Raider, Raider beats Ranged and Siege, Ranged beats Line.)
- Is the map worth fighting over, and is the army / economy / tech choice real?
- Does scouting matter with fog of war?
- How long does a match take, and how does it end? (Today only destroying the enemy HQ or a forfeit wins; victory points come in G5.)

## Reporting feedback

Tell Claude in a session for this game what you saw: what you did, what happened, what you expected, and the build hash from the title screen. Bugs and ideas become GitHub issues in [MarcialPimentel/another-rts](https://github.com/MarcialPimentel/another-rts/issues).
