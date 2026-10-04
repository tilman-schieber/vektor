# VEKTOR

A vertical-scrolling shooter in the style of the early nineties arcade, built in TypeScript with no runtime dependencies. Runs entirely in the browser. A sibling of [Snackman](https://github.com/tilman-schieber/snackman) and [Scales](https://github.com/tilman-schieber/scales): same font, same high score tables, but with real sprite art, drawn with [PixelLab](https://pixellab.ai).

**Play:** https://gh.tschieber.de/vektor/

Fly north. Stage 1 crosses the open sea, the beach, a jungle river and an enemy base, where a flying fortress waits. Stage 2 crosses the desert: dunes, the canyons of the mesas and a refinery, guarded by a crawler on tracks. Beat both and it all starts again, faster. You have 3 ships, and one more at 200000 and at 500000 points.

## Weapons and items

Carriers drop items when shot down. The weapon orb changes colour while it floats around: catch your own colour to power up, the other one to switch.

| Item | What it does |
| --- | --- |
| V (red) | Vulcan: a spread that widens with every level, up to 5 |
| L (blue) | Laser: a narrow beam that bends after the ship and goes through what it hits |
| M (green) | Homing missiles, on top of either weapon, up to 4 |
| B (yellow) | One more bomb, up to 7 |
| Medal | Hidden in bunkers. Each is worth 500 more than the last, up to 10000; miss one and it is back to 500 |

A bomb clears every bullet on screen, hurts everything in sight and keeps you safe while it burns. Losing a ship drops your power-ups for you to catch again, and you start the next one with 3 bombs.

## The stages

Fighters dive, sweep and swoop in formation; gunships hover and fire spreads; tanks roll along the ground with turrets that follow you; bunkers sit in the jungle and the base. In the desert, interceptors come up from behind you, turn and fire; bombers lumber down the screen firing rings; artillery guns on the mesas swing round slowly and lob heavy shells, and tanks follow the canyon floor.

The fortress at the end of stage 1 has two cannon pods; the crawler at the end of stage 2 has four gun turrets. When the guns are gone the core opens, and when the core is half gone it starts to spin.

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
