# VEKTOR

A vertical-scrolling shooter in the style of the early nineties arcade, built in TypeScript with no runtime dependencies. Runs entirely in the browser. A sibling of [Snackman](https://github.com/tilman-schieber/snackman) and [Scales](https://github.com/tilman-schieber/scales): same font, same high score tables, but with real sprite art, drawn with [PixelLab](https://pixellab.ai).

**Play:** https://gh.tschieber.de/vektor/

Fly north. Stage 1 crosses the open sea, the beach, a jungle river and an enemy base, where a flying fortress waits. Stage 2 crosses the desert: dunes, the canyons of the mesas and a refinery, guarded by a crawler on tracks. Stage 3 goes north: the polar sea, the pack ice, a snowfield and a naval base, out to the anchorage where a battleship lies. Stage 4 is a ruined city at night: the outskirts, downtown, a river, a power plant and the boulevard, where a walking mech comes stomping. Stage 5 is the volcano: basalt fields round a lava lake, lava rivers, the ash plains and a fortress in the crater. Beat all five and it all starts again, faster. You have 3 ships, and one more at 200000 and at 500000 points.

Easy mode (MODE on the title screen) gives the ship a shield that takes the first hit and comes back 20 seconds later; every new ship starts with it up. Easy has its own high score tables (Left/Right on the score screen switches modes).

## Weapons and items

Carriers drop items when shot down. The weapon orb changes colour while it floats around: every orb powers up, and catching the other colour also switches weapon, keeping your level.

| Item | What it does |
| --- | --- |
| V (red) | Vulcan: a spread that widens with every level, up to 5 |
| L (blue) | Laser: a narrow beam that bends after the ship and goes through what it hits |
| M (green) | Homing missiles, on top of either weapon, up to 5; a full rack of five reloads faster |
| B (yellow) | One more bomb, up to 7 |
| Medal | Hidden in bunkers. Each is worth 500 more than the last, up to 10000; miss one and it is back to 500 |

A bomb clears every bullet on screen, hurts everything in sight and keeps you safe while it burns. Losing a ship costs half your weapon levels and half your missiles, rounded down but at least one each (so level 5 drops to 3, level 2 to 1), and you start the next ship with at least 3 bombs.

## The stages

Fighters dive, sweep and swoop in formation; gunships hover and fire spreads; tanks roll along the ground with turrets that follow you; bunkers sit in the jungle and the base. In the desert, interceptors come up from behind you, turn and fire; bombers lumber down the screen firing rings; artillery guns on the mesas swing round slowly and lob heavy shells, and tanks follow the canyon floor. In the arctic, destroyers sail the open water with two guns each, and drones fly in as a ring, circle, then break off one by one and dart at you. In the city, helicopters drop in and strafe, armoured trains with gun cars run down the railway, and turrets hide in hatches on the rooftops: they can only be hurt while open. On the volcano, armoured boats sail the lava rivers, magma turrets rise out of the lava to fire and sink back out of reach, and missile silos open up to launch slow homing rockets, which you can shoot down.

The fortress at the end of stage 1 has two cannon pods; the crawler at the end of stage 2 and the battleship at the end of stage 3 have four gun turrets each; the walker at the end of stage 4 has two shoulder cannons, and legs that send out a ring of shells every time a foot comes down; the crater fortress at the end of stage 5 sprays flame from its flanks, launches rockets from its racks, and once its dome splits open lobs lava bombs that burst into rings. When the guns are gone the core opens, and when the core is half gone it starts to spin.

Stage clear pays a no-miss bonus and 3000 for every bomb you didn't use.

## Controls

| Key | Action |
| --- | --- |
| Arrows / W A S D | Fly |
| Space / Z / J | Fire (hold) |
| X / Shift / K | Bomb |
| Enter / Esc | Start / pause |
| Backspace | Quit to menu (while paused) |
| M | Music on/off |
| H | High scores (title screen) |

On phones, drag anywhere on the screen to fly: the ship moves with your finger and fires while it is down. BOMB is below the screen.

## Art

Every sprite, the terrain tilesets and the logo were generated with PixelLab; [tools/ASSETS.md](tools/ASSETS.md) lists the tool, prompt and seed of each, so any of them can be made again. The ground is a grid of terrain levels at tile corners (sea, sand, jungle, concrete), drawn with Wang tiles that pick their picture from their four corners. Shadows, explosions' debris, bullets, lasers and the HUD are drawn in code. Music and sound are a small Web Audio synth.

High scores: the top 10, both worldwide and in your own browser (Up/Down switches between them on the score screen). World scores live in a small [Val Town](https://www.val.town/x/tilmanschieber/vektor-scores) val with a SQLite table; your own scores and settings stay in the browser's local storage, so they still work offline. Games finished while the server can't be reached wait in local storage and are sent the next time the score screen opens.

## Development

```sh
npm install
npm run dev
npm run build
```

In a dev build the console has helpers: `skipTo(distance)`, `boss()`, `god()`, `power(level, 'vulcan' | 'laser', missiles)`, and `sim(frames, actions)` to step the game by hand.
