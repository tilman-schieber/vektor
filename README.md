# VEKTOR

A vertical-scrolling shooter in the style of the early nineties arcade, built in TypeScript with no runtime dependencies. Runs entirely in the browser. A sibling of [Snackman](https://github.com/tilman-schieber/snackman) and [Scales](https://github.com/tilman-schieber/scales): same font, same high score tables, but with real sprite art, drawn with [PixelLab](https://pixellab.ai).

**Play:** https://gh.tschieber.de/vektor/

Fly north. Stage 1 crosses the open sea, the beach, a jungle river and an enemy base, where a flying fortress waits. Stage 2 crosses the desert: dunes, the canyons of the mesas and a refinery, guarded by a crawler on tracks. Stage 3 goes north: the polar sea, the pack ice, a snowfield and a naval base, out to the anchorage where a battleship lies. Stage 4 is a ruined city at night: the outskirts, downtown, a river, a power plant and the boulevard, where a walking mech comes stomping. Stage 5 is the volcano: basalt fields round a lava lake, lava rivers, the ash plains and a fortress in the crater. Stage 6 climbs into orbit: open space and nebulae, a field of drifting asteroids, the defence ring with its laser fences, and a station built into an asteroid, where the mothership waits. Beat all six and the ending rolls; then it all starts again, faster. You have 3 ships, and one more at 200000 and at 500000 points.

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

Fighters dive, sweep and swoop in formation; gunships hover and fire spreads; tanks roll along the ground with turrets that follow you; bunkers sit in the jungle and the base. In the desert, interceptors come up from behind you, turn and leave needles in the air: brass darts that hang for a moment, point at you, and then streak off where you were; bombers lumber down the screen firing rings; artillery guns on the mesas swing round slowly and lob heavy shells, and tanks follow the canyon floor. In the arctic, destroyers sail the open water with two guns each, and drones fly in as a ring, circle, then break off one by one and dart at you. In the city, helicopters drop in and strafe, armoured trains with gun cars run down the railway, and turrets hide in hatches on the rooftops: they can only be hurt while open. On the volcano, armoured boats sail the lava rivers, magma turrets rise out of the lava to fire and sink back out of reach, and missile silos open up to launch slow homing rockets, which you can shoot down. In orbit, asteroids split in two when shot, down to small ones; satellites in pairs turn slowly with a laser fence burning between them until one is down; mines creep after you and burst into a ring; stealth fighters come in cloaked and out of reach and only show themselves to fire; gravity drones drag your ship toward them; and hangars in the station hull open to launch raiders, which is when they can be hurt.

Halfway through every stage a mid-boss comes in with a caution card and a health bar, and gets away if it isn't shot down in time: a submarine that surfaces, fires and dives to come up somewhere else; a sandworm that fires nothing: its mound creeps after you before it bursts out and arcs over, its armoured body shielding the head; an icebreaker that throws frost off its bow and lobs ice bombs; an attack helicopter that sweeps its minigun across the screen in bursts and fires rocket salvos; a lava serpent whose segments you shoot away one by one before the head can be hurt; and a frigate behind a turning shield, which you can only shoot through its gap, the way it fires back.

The fortress at the end of stage 1 has two cannon pods and launches escort fighters off its rear deck; once open it drops rows of bombs that burst into crosses; the crawler at the end of stage 2 has four turrets and throws needles: curtains of them that all turn on you at once, rings that hang round its hull and burst outward, and once enraged a spiral that freezes in place before it flies, while it turns on its tracks to follow you; the battleship at the end of stage 3 has four gun turrets and fires frost shards that snake from side to side: a bow gun sends them after you in a slithering line, its beams fire them in broadsides, and once open it steams toward you behind a swaying curtain of them, then a turning snowflake; the walker at the end of stage 4 has two shoulder cannons, legs that send out a ring of shells every time a foot comes down, and a searchlight on its head: stay out of the light, or the cannons open up. Shoot its legs away and it sinks to its knees. Once open, its core aims a beam at you and fires it, swinging slowly after you, and in a rage it calls down mortars on markers around you; the crater fortress at the end of stage 5 sprays flame from its flanks, launches rockets from its racks, and once its dome splits open lobs lava bombs that burst into rings; the mothership at the end of stage 6 has four batteries, each with its own weapon, and launches raiders, then cuts with twin beams that close like scissors, and at the last charges an all-out beam: hurt its core enough while it charges to break it, or have a bomb ready. When the guns are gone the core opens, and when the core is half gone it starts to spin.

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

A gamepad works too: stick or d-pad to fly, A (or X) to fire, B (or Y) to bomb, Start to pause and Select to quit from the pause screen. On the title screen Y shows the high scores; when typing a name, Up/Down pick a letter, A enters it and B rubs one out.

On phones, drag anywhere on the screen to fly: the ship moves with your finger and fires while it is down. BOMB is below the screen.

## Art

Every sprite, the terrain tilesets and the logo were generated with PixelLab; [tools/ASSETS.md](tools/ASSETS.md) lists the tool, prompt and seed of each, so any of them can be made again. The ground is a grid of terrain levels at tile corners (sea, sand, jungle, concrete), drawn with Wang tiles that pick their picture from their four corners. Shadows, explosions' debris, bullets, lasers and the HUD are drawn in code. Music and sound are a small Web Audio synth; every stage has a tune of its own, written out note by note, that builds up as the stage goes on.

High scores: the top 10, both worldwide and in your own browser (Up/Down switches between them on the score screen). World scores live in a small [Val Town](https://www.val.town/x/tilmanschieber/vektor-scores) val with a SQLite table; your own scores and settings stay in the browser's local storage, so they still work offline. Games finished while the server can't be reached wait in local storage and are sent the next time the score screen opens.

## Development

```sh
npm install
npm run dev
npm run build
```

Add `?debug` to the URL (https://gh.tschieber.de/vektor/?debug) for debug mode, which works in the live build too. In play, 1-6 jump to a stage, N to the next one, B calls the boss, U gives full power (weapon 5, five missiles, seven bombs), I toggles invincibility and V switches weapon. Games in debug mode don't go into the high scores.

In a dev build the console has helpers: `skipTo(distance)`, `boss()`, `god()`, `power(level, 'vulcan' | 'laser', missiles)`, and `sim(frames, actions)` to step the game by hand.

For balance testing, `npm run playtest` has a bot play the game: it starts Vite, opens the dev build in headless Chromium (`puppeteer-core`; set `CHROMIUM` if the browser isn't `/usr/bin/chromium`) and steps the game from inside the page, a full campaign in a second or two. The bot dodges what it can see coming, goes for orbs and medals, sits under its targets and bombs when cornered; `--skill` (0..1, default 0.7) slows its reactions, narrows its attention and adds misjudgements and lapses. It prints per-stage tables (mean (min-max) over runs): deaths, what caused them (bullet kind and who fired it) and where (stage distance or boss phase), bombs, orbs and medals caught out of those dropped, weapon level and missiles at the start, at the boss and at the end, boss fight and phase times, bullet density and score; every run goes in full to `tools/playtest/out/`. Runs are reproducible by seed; `npm run playtest -- --help` lists the options.

```sh
npm run playtest -- --runs 20                                     # 20 campaigns from stage 1, seeds 1-20
npm run playtest -- --stages 4 --start-power 3,2 --runs 10        # stage 4 alone, starting at level 3 with 2 missiles
npm run playtest -- --god --start-power 3,2 --boss-only --runs 5  # boss fights at level 3 with 2 missiles; hits counted, not taken
npm run playtest -- --stages 2 --skill 0.4 --shots shots          # a weaker player, with a screenshot at every death
```
