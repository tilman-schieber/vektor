# Vektor asset log

All art was generated with PixelLab (MCP) and saved under `src/assets/`. Common style: top-down / high top-down view, single-color black outline, medium shading, transparent background.
Generations spent in this pass: about 254 (balance went from 1494 to 1240). The first 3 player seeds and the first 3 tilesets had already been charged before that.

Post-processing (no smooth scaling anywhere):
- `clean.py`: removes small stray pixel clusters that bleed in from neighbouring cells of the 1-direction review grid, then re-centers the sprite on its canvas. Some sprites were also flipped vertically (mirror only) so that they face south.
- Player bank frames: drawn by hand with a pixel transform, described below.

## Ships

| path | tool | prompt | seed | size | id | notes |
|---|---|---|---|---|---|---|
| ships/player.png | create_image_pixflux | "top-down view of a sleek red and silver arcade fighter jet, nose pointing up, swept wings, cockpit canopy, twin engines, symmetrical, shmup player ship" (north, high top-down, black outline, medium shading) | 404 | 32x32 | job 8f4eb80a-6556-49d2-964d-c2a22ee767db | Picked from 7 seeds (101/202/303/404/505/606/707). Also used as the style reference for the enemies. |
| ships/player_l.png | derived from player.png | n/a | n/a | 32x32 | n/a | edit_image (jobs 6420bb8e…, bf27e940…) and a pixflux img2img attempt (f5e41770…) all failed to produce a visible roll. Made instead with a nearest-neighbour column decimation: the left wing is squeezed by about 1/3 and darkened 30%, the right wing is brightened 15%, and the result is re-centered. |
| ships/player_r.png | derived | n/a | n/a | 32x32 | n/a | Horizontal mirror of player_l.png. |

## Enemies

| path | tool | prompt | seed | size | id | notes |
|---|---|---|---|---|---|---|
| enemies/fighter.png | create_1_direction_object (64-candidate grid, style ref = player at 24px) | grid: "hostile military vehicle seen from directly above, facing down…"; item: "small fast enemy fighter jet, nose pointing down, olive grey with orange stripes, swept wings" | n/a | 24x24 | review 912a2ac0…, frame 6 → object d84810f9-aa28-4fbe-937c-c3e42de74777 | The model drew it nose-up, so it was flipped vertically. Cleaned and re-centered. |
| enemies/tank.png | same grid | "tank hull without turret seen from directly above, olive green, two tracks, empty round turret ring…" | n/a | 24x24 | frame 7 → 20e55139-fd6c-491f-94bf-bfd3d35388bc | Has a dark turret ring at the center (pixel 12,12 after re-centering). |
| enemies/wreck.png | same grid | "scorched black crater with burnt metal wreckage debris and embers, ground decal" | n/a | 24x24 | frame 2 → 25fd21ee-6fa5-4081-91d8-5fa0352fbfcb | |
| enemies/carrier.png | create_1_direction_object (64-grid, style ref = player 32px) | item: "chunky quad-rotor cargo drone … glowing payload" | n/a | 32x32 | review 1c6c0862…, frame 40 → new object | Dark-blue quad drone with a bright yellow glowing pod. |
| enemies/bunker.png | same grid | "concrete bunker gun emplacement seen from directly above, square concrete base with round armored dome turret, grey with orange hazard stripes" | n/a | 32x32 | frame 1 → new object | |
| enemies/gunship.png | create_1_direction_object (16-grid at 48px, style ref = player padded to 48) | "heavy enemy gunship bomber … twin forward guns, olive grey and dark blue armor with orange yellow accents" | n/a | 48x48 | review 5752f18b…, frame 14 → 20670846-91b8-41c7-9a60-c2bb265cdef1 | Flipped vertically so the twin guns point down. The right wingtip may be clipped by 1px. An alternative (frame 7, object 1628ad49…) is kept in PixelLab. |
| enemies/tank_turret.png | drawn by hand (python) | n/a | n/a | 16x16 | n/a | The PixelLab tries (16px object grid 5ba8d33a…, pixflux c41952b6… and dc909ff9…) were muddy, had no outline, or were off-center. Drawn instead with the tank's own palette: a round olive dome centered at (7.5,7.5), barrel pointing down to y=15, black outline, and an orange hatch pixel. Pivot is at the canvas center. |

## Boss

| path | tool | prompt | seed | size | id | notes |
|---|---|---|---|---|---|---|
| boss/boss.png | create_image_pixflux | "top-down view of a giant armored flying battleship fortress boss, facing down, symmetrical, two large cannon pods on left and right sides, central closed armored hatch in the middle, dark grey and olive steel plates with orange and yellow warning accents, arcade shmup boss" (south, high top-down, highly detailed) | 33 | 128x96 | job c45a96e8-afa1-4075-bcf5-52aa27465a2a | Picked from seeds 11/22/33/44. |
| boss/boss_open.png | inpaint_image on boss.png, mask x51 y34 w26 h26 | "the central armored hatch panels slid open to both sides, revealing a round glowing red and orange reactor core with bright yellow-white center…" | n/a | 128x96 | job fefb03cd-ac4f-4c98-8fa5-5cf9577e4dad | Every pixel outside the mask is identical to boss.png. Reactor core center ≈ (64,47). |

## Items (64-candidate grid at 16px, review c1ded2a4…)

| path | prompt (item) | grid frame | object id |
|---|---|---|---|
| items/orb_v.png | "glowing red power-up orb sphere" | 12 | 891cda93-e954-4e89-9397-91fee5124f9a |
| items/orb_l.png | "glowing blue power-up orb sphere" | 13 | 11d1f19c-2761-4773-8669-b0fdcdaaba45 |
| items/orb_m.png | "glowing green power-up orb sphere" | 14 | 6844ecdb-40d3-4e5b-8ce6-1f34d22fc8af |
| items/orb_b.png | "glowing yellow power-up orb sphere" | 15 | 4097a341-526a-433c-af7c-36268f2303bd |
| items/medal.png | "gold medal star coin, shiny" | 22 | 722b00b4-9acd-4289-b274-2afceacc17ef |

The orbs carry no letters. Each one sits in the 12x12 box from (2,2) to (14,14).

## FX

| path | tool | notes |
|---|---|---|
| fx/explosion_small_0..8.png (9 frames, 32x32) | create_1_direction_object (fireball grid c1cef60a…) + animate_object v3 | Frame 0 is frame 0 of the animation "small spark rapidly expands…" on object db159398-ea6f-40a7-bd3b-973ed30a60e5 (a tiny ignition ball). Frames 1-8 are frames 0,2,3,4,5,6,7,8 of the animation "round fireball explosion bursts outward … breaks into dark grey smoke puffs … fade away" on object b994999c-9bba-4eef-b9d6-3f31cbe770a4. Sequence: ignition, full fireball, collapse, smoke. |
| fx/explosion_big_0..8.png (9 frames, 64x64) | create_1_direction_object (64px grid 0f06cea3…) + animate_object v3 on object ce5e4d4d-d796-4cc7-90d6-02411d17b486 | "the fireball bursts outward into a huge explosion with flame tongues, then … dark grey smoke clouds that … dissipate". Starts at a full fireball and has no tiny ignition frame. |

## UI

| path | tool | prompt | seed | size | id |
|---|---|---|---|---|---|
| ui/logo.png | create_image_pixflux (text_guidance 12, black outline) | 'pixel art game title logo text "VEKTOR" in big bold chrome metal letters with red outline accents, arcade shmup title, centered, legible letters V E K T O R' | 2 | 192x48 | job c0de1204-cd3a-4f79-9941-15b0b2486758 |

The logo is fully legible: chrome letters with red. Other candidates were seed 1 (66ed49de…) and seed 3 (687c67cc…).

## Tilesets (create_topdown_tileset, 16px, high top-down, standard mode)

| file | tileset id | lower → upper | transition | notes |
|---|---|---|---|---|
| tiles/ocean_beach.png/.json/_example.png | cf3ebec0-bfce-41a5-9917-5d18687a979e | deep blue ocean water with small waves → sandy beach | white surf foam, size 0.25 | original |
| tiles/beach_jungle.png/.json/_example.png | 49d2bf6b-4820-4d36-bdfd-635d715356fb | sandy beach → dense green jungle canopy | "grass with scattered shrubs and bushes, irregular organic edge", size 0.5, shape_style **round** | Replaces b132abd7-140c-4606-ad4a-7a751f480e52, which had hard square edges. |
| tiles/jungle_base.png/.json/_example.png | c16305e7-251d-48b3-9ab9-b3dcf9d0d6da | dense green jungle canopy → grey concrete military base floor | "dirt and rubble edge with scattered bushes, irregular", size 0.5, shape_style **round** | Replaces fb3c7058-afda-4c6d-983a-238dd601a755. |

Base tile ids used for chaining. The neighbouring sheets share these tiles, so the seams match:
- ocean (lower of ocean_beach): `a92d35a1-9392-4c3a-9667-60e259855256`
- sand (upper of ocean_beach, lower of beach_jungle): `39a3f2c2-a2c3-4a4d-a3f6-75e62f758c6d`
- jungle (upper of beach_jungle, lower of jungle_base): `bf5b57be-a5e1-4443-9cdb-66c9582a4343`
- concrete (upper of jungle_base): `aa640f92-580e-44a0-8164-0cf4c0351abf`

Rejected tileset attempts:
- 86de053c… (beach_jungle at 0.5 without a shape style): still blocky.
- 17680684… (pro mode, raggedness 0.7): visible seams between tiles.
- 0110d2eb… (jungle → light concrete with yellow hazard edge, upper base 592b9dde-bb99-43bc-9daf-f7026ce586c2): reads clearly as a base, but the edges are hard and square.

The new beach_jungle jungle tile differs from jungle_base's jungle tile by at most 13 per channel, which is not visible.

### Metadata JSON format

The top-level keys are `id`, `name`, `lower_description`, `upper_description`, `transition_description`, `tile_size`, `transition_size`, `view`, `style_settings`, `generation_parameters`, `base_tile_ids` (`lower`/`upper`), `tileset_data`, `metadata`, `created_at`, `format` (`"tileset15"`), `layout`, `pattern_system` and `tileset_image`.

`tileset_data` holds `tiles[16]`, `tile_size`, `total_tiles`, `terrain_types` (`["lower","upper"]`), `spritesheet_grid` (`{cols:4, rows:4}`) and `spritesheet_layout`.

Each tile looks like this:

```json
{"id":"13","name":"wang_13",
 "corners":{"NE":"upper","NW":"upper","SE":"upper","SW":"lower"},
 "pattern_4x4":{"row_0":[255,255,255,255],"row_1":[255,1,1,255],"row_2":[255,0,1,255],"row_3":[255,255,255,255]},
 "original_position":{"col":2,"row":4},
 "bounding_box":{"x":0,"y":0,"width":16,"height":16}}
```

- `corners` gives the terrain at each of the tile's four corners (NW, NE, SW, SE) as the string `"lower"` or `"upper"`.
- `pattern_4x4` encodes the same information as numbers: the center 2x2 is `[NW,NE]` / `[SW,SE]`, with 0 = lower, 1 = upper and 255 = wildcard.
- The tile's position in the sheet is `bounding_box` (pixel rect). Do not use `name` (`wang_N`) or `original_position` for slicing.
- The all-lower and all-upper tiles have the base tile UUID as their `id`.

---

# Stage 2 (desert / refinery)

Generations spent: 97 (balance went from 1240 to 1143). Palette: sand, ochre and khaki military colours with orange and red accents. Sprites were cleaned with the same stray-cluster removal and re-centering as stage 1. Flips are mirror-only, with no resampling.

## Tilesets (create_topdown_tileset, 16px, high top-down, medium shading, standard mode, shape_style round, transition 0.5)

| file | tileset id | lower → upper | transition | notes |
|---|---|---|---|---|
| tiles/desert_rock.png/.json/_example.png | a5400aa1-5378-4408-ba9c-b560a2061755 | "orange desert sand dunes with wind ripples" → "dark brown rocky mesa plateau, cracked stone" | "crumbling rock cliff edge with scattered pebbles, irregular organic edge" | Rock is the raised terrain, with cliff faces dropping to the sand. |
| tiles/rock_metal.png/.json/_example.png | 9d4f05ad-3201-4d79-86cf-0a29917b7300 | rock (lower_base_tile_id d0bc8769…) → "industrial refinery floor of grey steel plates with rust patches, rivets, metal pipes and yellow black hazard stripes" | "concrete curb and gravel edge, irregular organic boundary", text_guidance 12 | Metal is raised, with a concrete curb. Replaces 8547dda9-0cc0-48b1-9921-2e018225f069 (prompt "industrial refinery floor, rusty metal plates, pipes and yellow hazard stripes"), whose upper terrain came out as plain tan dirt. |

Base tile ids:
- sand: `e4b0dbe0-e4b2-45c7-86a0-1b8e6c69c0f2`
- rock (upper of desert_rock, lower of rock_metal): `d0bc8769-4dc7-484d-a5fe-00380c0da27e`. The all-rock tile in the two sheets differs by at most 3 per channel.
- refinery metal: `e460620f-5720-4477-ace8-c3dddc7fc5ce`

The JSON format is the same as stage 1: `format` `"tileset15"`, 16 tiles in a 4x4 grid, with `corners` and `bounding_box` on each tile.

## Enemies

| path | tool | prompt | size | id | notes |
|---|---|---|---|---|---|
| enemies/interceptor.png | create_1_direction_object (64-grid at 24px, style ref = enemies/fighter.png) | grid: "hostile desert military aircraft seen from directly above, nose facing down, sand khaki desert camouflage with orange and red accents…"; frame 25 is from the generic grid prompt | 24x24 | review 6514a4fc…, frame 25 → 418eea01-cf2a-4509-a910-a575bdad1083 | Drawn nose-up, so it was flipped vertically. Swept wings with orange and red wing edges. |
| enemies/bomber.png | create_1_direction_object (16-grid at 64px, style ref = gunship padded to 64) | "big slow four-engine heavy bomber airplane seen from directly above, nose pointing down, wide straight wings with four propeller engines, sand and khaki desert camouflage with orange and red markings…" | 64x64 | review 2fd61f2e…, frame 2 → ef962f44-6d1e-4fc0-b8a2-fab00b28aa93 | Already faces down, so it was not flipped. The bbox is 62x50. |
| enemies/artillery.png | create_1_direction_object (64-grid at 32px, style refs = bunker + player) | item: "octagonal concrete artillery emplacement from above with a round metal turntable ring in the center, no barrel, tan and orange" | 32x32 | review f71f7c26…, frame 7 → 5cf71534-eb2e-441e-9219-58daf6fc2a26 | The turntable ring centre is about (15.5,15). The grid's sandbag-ring candidates (frames 4-6) were deleted with the review. |
| enemies/artillery_barrel.png | drawn by hand (PIL) | n/a | 32x32 | n/a | A round khaki cap with radius 6 at the canvas centre (15.5,15.5), and a 6px-wide barrel with a reinforcing band and a muzzle brake running down to y=31. The sprite is symmetric about x=15.5. Pivot = canvas centre. |

## Boss

| path | tool | prompt | seed | size | id | notes |
|---|---|---|---|---|---|---|
| boss/boss2.png | create_image_pixflux img2img (init = hand-drawn composition sketch of hull, tracks, 4 domes, hatch and cannon; init_image_strength 60) | "top-down view of a giant armored desert land battleship crawler boss on wide tank tracks, facing down, four round armored gun turret domes with short cannons, central armored hatch over the main cannon, sand ochre khaki camo armor plates, panel lines, rivets, vents, orange and red hazard stripes, highly detailed, symmetrical, arcade shmup boss" (south, high top-down, black outline, medium shading) | 203 | 128x96 | job 758d1741-f372-4cfb-b785-6f07a237d5ec | Pure text-to-image (seeds 11-88) gave tanks without four domes. The other img2img tries were strengths 45, 60, 80, 150 and 220. Turret dome centres: (36,30) (91,30) (36,68) (91,68). The hatch box is x48-80, y34-62, and the main cannon points down to y≈83. |
| boss/boss2_open.png | inpaint_image on boss2.png, mask x47 y33 w35 h31 | "the central armored hatch doors slid open to both sides, revealing a round glowing reactor core inside, bright yellow-white hot center surrounded by orange and red glowing energy rings, dark metal frame around the open pit, top-down view" | 7 | 128x96 | job d4c64510-4453-4429-aa0c-1af81e938890 | Every pixel outside the mask is identical to boss2.png. Reactor core centre ≈ (64,47). |

---

# Stage 3 (arctic / naval base)

Generations spent: 58 for the first pass (balance went from 1141 to 1083), plus 2 tilesets for the water_ice redo. Palette: navy and dark-grey naval steel, white and ice-blue, with red and orange accents. Flips are mirror-only, with no resampling (none were needed this time). Layout sketches were drawn with PIL in the session scratchpad; they are not kept in the repo.

## Tilesets (create_topdown_tileset, 16px, high top-down, medium shading, standard mode, shape_style round, transition 0.5)

| file | tileset id | lower → upper | transition | notes |
|---|---|---|---|---|
| tiles/water_ice.png/.json/_example.png | 42576309-bc5f-49b2-be96-9b8eb3dc9442 | "deep dark blue cold ocean water with small waves, scattered tiny white wave crests" → "cracked white-blue pack ice, flat ice floe with cracks" (upper_base_tile_id d858232f…) | "ice edge with slush and small floating ice chunks, irregular organic edge" | Ice is raised, with ice-blue cliff faces. The sea has small wave ripples like ocean_beach, but darker and colder. This replaces 53605363-57b4-4600-ae3f-4ba5ef7b95d4, whose sea (base 4c924acb…) had vertical streaks that looked like wooden planks in game. Also rejected: cf7e7935-341c-41e0-b5e1-007670daed74 ("dark navy arctic sea water with small scattered wave ripples and faint white wave crests, no stripes", sea base 7c8662ea…), which came out almost black. |
| tiles/ice_snow.png/.json/_example.png | d277acae-c368-4147-89d9-76a6def6b128 | ice (lower_base_tile_id d858232f…) → "fresh white snowfield with soft snow drifts" | "wind-blown snow over ice, soft irregular organic edge" | Snow is raised, with a dark blue-grey bank edge. |
| tiles/snow_base.png/.json/_example.png | c371313f-9ef8-4cd9-adeb-359752ed8a0f | snow (lower_base_tile_id 5a40b805…) → "dark grey concrete naval base apron with painted yellow and white lines, concrete slabs" | "plowed snow banks along a concrete edge, irregular organic boundary", text_guidance 10 | Concrete is raised, with slab joints. The painted lines came out only as faint yellow specks. |

Base tile ids:
- arctic sea: `014948f4-2ae3-4fa9-bf01-e69159341073`. The old striped sea `4c924acb…` is no longer used.
- pack ice (upper of water_ice, lower of ice_snow): `d858232f-480e-4280-9066-c4e4f41c6149`. The all-ice tile in water_ice (v2) differs from the one in ice_snow by at most 12 per channel, which is not visible (stage 1 accepted 13).
- snow (upper of ice_snow, lower of snow_base): `5a40b805-3905-4c66-a330-7d70e2c67003`. It differs by at most 2 per channel.
- naval concrete: `510d4279-0d72-4153-9f00-20fddbeb6150`

The JSON is the full metadata endpoint response, in the same `tileset15` format as stages 1 and 2. The `_example.png` files are the 64x64 previews that get_topdown_tileset returns.

## Enemies

| path | tool | prompt | size | id | notes |
|---|---|---|---|---|---|
| enemies/destroyer.png | create_image_pixflux img2img (init = PIL sketch of the hull with 2 turret domes, a white bridge and red stripes; init_image_strength 150, seed 332) | "top-down view of a naval destroyer warship seen from directly above, bow pointing down, narrow navy grey steel hull, two round gun turret mounts on the centre line with no barrels, white bridge superstructure in the middle, red stripe accents, white wake at the stern, symmetrical, arcade shmup enemy" (south, high top-down, black outline, medium shading) | 32x64 | job b307d712-d388-4584-acd7-9bd7f3a6159c | Bow at the bottom. Turret mount centres: **(15.5,17.5)** and **(15.5,45.5)**, both 8px domes without barrels. The generated stern wake (rows 0-2) read as a glyph, so it was replaced by a hand-drawn white and ice-blue foam fringe. Rejected: text-only seed 314, and img2img on a plainer sketch (seeds 311-313, strengths 60/100), which were muddy and had no clear turrets. |
| enemies/drone.png | create_1_direction_object (64-grid at 16px, no style ref, 6 item descriptions) | "small round hostile spinning drone seen from directly above, dark navy grey steel body, four small rotors, glowing red light in the middle…" | 16x16 | review c9ed3961…, frame 56 → 8dbcd024-ef52-4b7e-bf8e-bb8d528be470 | A navy disc with a red centre light and four white and grey rotor arms in an X. The bbox is 14x14 from (1,1). Chosen because the white rotors read on both the dark sea and the ice. Many navy-only candidates disappeared on the sea tile. |

## Boss

| path | tool | prompt | seed | size | id | notes |
|---|---|---|---|---|---|---|
| boss/boss3.png | create_image_pixflux img2img (init = PIL sketch at 112x176: slim hull 58px wide with ogive bow, plating lines, rivet belt, 8 AA mounts, snow patches, stern hazard stripe, bridge block with orange-ringed hatch, 4 shaded 21px turret domes; init_image_strength 120, seed 403) | same prompt as the 96x128 version, but "long slim armoured" hull (south, high top-down, black outline, medium shading, highly detailed, no_background) | 403 | **112x176** | job ac5f4b28-ecd6-45ad-ae23-3efa34edfa28 | **Redo (bigger) of the stubby 96x128 boss.** Hull bbox x27-85, y4-173 (stern top, bow tip y≈173). Turret mount centres, all on the centre line, domes 21px across with 5px clear between pairs: **(55.5,23.5) (55.5,50.5)** aft, **(55.5,118.5) (55.5,145.5)** forward. Bridge block x39-72, y67-99 (side panels reach x36-75 at y78-89); hatch ring x46-65, y75-91, centred (55.5,83). The generated hatch interior was a dark maroon grate that looked like a core already, so it was recoloured in PIL to closed steel doors with a centre seam. Candidates: seeds 401 (strength 150) and 404 (180) came out with a transparent deck; 402 (150) was clean but flat; 405 (120) and 406 (130) were plainer. Total 6 generations + ~20 for the inpaint. |
| boss/boss3_open.png | inpaint_image on boss3.png, mask x46 y74 w20 h19 | "the central armored hatch doors slid open to both sides, revealing a round glowing reactor core inside, bright yellow-white hot center surrounded by orange and red glowing energy rings, dark metal frame around the open pit, top-down view" | 7 | 112x176 | job 5ea3c836-4edf-4953-9bf9-246466ad4611 | The inpaint result changed pixels outside the mask (deck went partly white), so only the mask box was pasted back onto boss3.png and given a 1px black rim. RGB diff vs boss3.png is confined to x46-65, y74-92. Reactor core centre ≈ **(55.5,83.5)**. The old 96x128 pair is not kept in the repo. |

### Desert sand recolour (no generations)

`tiles/desert_rock.png` and `_example.png`: the sand came out orange-red. Every pixel with HSV value > 0.45, saturation > 0.4 and hue < 35° (the sand and its cliff faces) was remapped to hue 37°, saturation × 0.68, value × 0.98 + 0.03 with PIL. The rock tiles are untouched, so they still match `rock_metal`. Originals were backed up before the change.

## Stage 3 decor (ground props for the concrete naval base)

Generations spent: 20 (one 64-candidate grid). Flat ground props that the game scatters on the `snow_base` concrete (all-upper tile at x0 y48). They have no shadows. All are 32x32 RGBA with no partial alpha. Each was re-centred by an integer shift, without resampling.

Grid: create_1_direction_object, review 331dc825… (now dismissed), style ref = enemies/bunker.png (32px). Description: "flat ground prop on a military naval base seen from directly above, top-down, dark grey concrete, navy grey military colours, red orange yellow accents, light snow dusting on top surfaces, black outline". 64 item descriptions, 8 per prop (frames 0-7 containers, 8-15 fuel tanks, 16-23 helipad, 24-31 radar, 32-39 crates, 40-47 hangar, 48-55 jet, 56-63 truck). Tag `arctic_decor`.

| path | grid frame | object id | notes |
|---|---|---|---|
| decor/arctic_containers.png | 3 | c095669f-9602-4fef-9b0d-0f09b1ad732c | Three containers (red, blue and orange) side by side, with snow on the roofs. |
| decor/arctic_fueltanks.png | 14 | 640937b2-8b34-4828-afea-dcee14d6eb2f | One large light-grey tank roof with two hatches. Every grid candidate was a single tank. |
| decor/arctic_helipad.png | 16 | 15ada004-0714-4006-8282-333151ac09db | A solid dark pad with a white H, a yellow ring and corner marks. Frame 21 had a transparent interior, so it worked as a decal, but it was weaker. |
| decor/arctic_radar.png | 24 | a1fe2c7b-3127-4ab4-8ee4-091444ac6e11 | A white dish on a small grey base, in a slightly 3/4 view. |
| decor/arctic_crates.png | 39 | df34d77c-cd5c-41ea-bf5f-b96e42896293 | Brown and olive crates with snow patches. |
| decor/arctic_hangar.png | 40 | e6856256-1df7-49ba-960b-2ec41da8581c | A ribbed Quonset roof with orange trim and the door at the bottom, in a 3/4 view. |
| decor/arctic_jet.png | 52 | b3ca7dc0-453f-44ef-b522-796290cda7cf | A grey jet. It was drawn nose-up, so it was flipped vertically and now points nose down. |
| decor/arctic_truck.png | 62 | 82d1655e-061f-4818-9a03-72eaa8ee5b1e | A navy truck with a canvas bed, facing left. It is a side/3/4 view (the wheels are visible), as all truck candidates were. |

Lesson: the grid's 8-per-prop repetition gives very consistent candidates, so one grid was enough. The trucks, hangars and radars all came out in 3/4 view rather than a true top-down view, which matches the bunker style ref.

---

# Stage 4 (night city: downtown, river, power plant)

Generations spent: 73 (balance went from 1035 to 962). Palette: deep navy and black, dark gunmetal military grey with red lights, warm yellow windows, and cyan/magenta neon. Layout sketches and previews were made with PIL in the session scratchpad and are not kept in the repo. All sprites are RGBA with no partial alpha. Flips are mirror-only, and the trains were stretched only by duplicating whole rows.

## Tilesets (create_topdown_tileset, 16px, high top-down, single color outline, medium shading, medium detail, standard mode)

| file | tileset id | lower → upper | transition | notes |
|---|---|---|---|---|
| tiles/river_street.png/.json/_example.png | 934263d0-62bb-484a-9b2f-e95a2f44ada3 | "dark river water at night with yellow light reflections" (lower_base e38055ac…) → "very dark charcoal black asphalt road at night, almost black, with thin faded white lane markings" | "dark grey concrete embankment wall", round, 0.5, text_guidance 12 | The asphalt came out dark navy and plain: no lane markings are visible. Replaces 549dd405-83bf-430e-bfe5-4693cb054f5b ("dark asphalt city street at night with faint lane markings"), whose street was light daytime grey. With shape_style, the tool's "enhance" step rewrites the prompts and tends to brighten "dark" terrain. |
| tiles/street_roof.png/.json/_example.png | 794783f5-bcd1-4c2f-b1e4-451bc4a73dbf | asphalt (lower_base 7a4e651c…) → "dark flat city rooftops at night with lit skylights and glowing yellow windows" (upper_base a872ce34…) | "tall building wall facade with rows of bright glowing yellow lit windows below a concrete parapet", **square**, 0.25, text_guidance 10 | Dark brick-pattern roofs inside a grey parapet, with yellow window rows on the facade edges. The all-roof tile has no skylights (the decor provides them). Rejected: 399a343d… (light asphalt) and 59e6ef77… (same chain, but "building edge with concrete parapet" gave almost no windows). |
| tiles/roof_plant.png/.json/_example.png | 3e77fdab-c931-4cd8-a99e-2aaa9589eb53 | roof (lower_base a872ce34…) → "power plant floor, dark metal grating with glowing cyan power cables" | "steel retaining wall with yellow hazard stripes", **square**, 0.25 | Blue-teal grating with orange and yellow hazard-dot edges and cyan glowing ports along the bottom edges. The cyan cables on the all-plant tile are faint. |

Base tile ids (the all-X tile in neighbouring sheets is pixel-identical, max diff 0):
- river water: `e38055ac-d1de-45ac-ad9e-9df44a213c38`
- night asphalt: `7a4e651c-6abc-4f0f-bbbe-aa36f51e1a2d`. The old grey asphalt `f77b1ee7…` is not used.
- rooftop: `a872ce34-8279-427b-8a67-82eba02451ea`
- power-plant grating: `e149ccfb-db21-42a0-a085-c39c38b7a830`

## Enemies (one 64-candidate create_1_direction_object grid at 32px, style ref = enemies/carrier.png, review 01b3f78e…, now dismissed; tag `city_enemies`)

Grid description: "hostile military vehicle seen from directly above, facing down, dark gunmetal grey armor with glowing red lights, night city, black outline, medium shading". It used 24 heli items, 16 closed hatches, 8 open hatches, 4 rail cars and 4 locomotives.

| path | source | size | notes |
|---|---|---|---|
| enemies/heli.png | frame 16 ("helicopter gunship fuselage from directly above without rotor, cockpit at the bottom, tail at the top…") | 32x32 | Already nose-down (glass canopy at the bottom). The detached tail fin was joined to the body with a hand-drawn 4px boom. A 6px dark rotor hub was hand-drawn at the canvas centre, **(15.5,15.5)** (pixels 13-18). There are no rotor blades. Frame 18 is an alternative. |
| enemies/train_engine.png | frame 54 | 24x40 | Front (red lights and yellow headlights) at the bottom. Stretched from 18x32 by duplicating rows 17 (x4) and 23 (x3). Sprite occupies x3-20, y1-39. |
| enemies/train_car.png | frame 49 | 24x40 | Stretched from 18x31 (rows 5 and 24 x4). The generated black hole was repainted to plain hull, and a hand-drawn round turret mount ring (no barrel) was added at **(11.5,19.5)**: ellipse x5-18, y13-26. There are panel seams at y8/y31 and red corner lights. |
| enemies/popup_closed.png | frame 34 (iris hatch) | 24x24 | Cropped from (4,4) and given a 1px black outline. Hatch centre (11.5,11.5). |
| enemies/popup_open.png | drawn by hand (PIL) on popup_closed | 24x24 | The outer rim is identical to the closed hatch. Inside r<7.7 it has a dark pit edge, a red/orange glow ring, and a shaded gunmetal turret mount (r 4) with a dark socket and an orange centre pixel at (11.5,11.5). There is no barrel. The generated open-hatch candidates (frames 41-47) did not match any closed design. |

## Boss

| path | tool | prompt | seed | size | id | notes |
|---|---|---|---|---|---|---|
| boss/boss4.png | create_image_pixflux img2img (init = PIL sketch: torso, 2 shoulder pods with round mounts, cockpit hatch, hips, legs and feet; **init_image_strength 60**, detailed shading, highly detailed) | "top-down view of a giant bipedal walking mech boss seen from directly above, facing down, wide armored torso with a round closed cockpit hatch in the middle, two big round shoulder cannon pods on left and right, two armored legs with round hip joints and big feet below, dark gunmetal grey armor plates, panel lines, rivets, vents, red and orange accent lights, symmetrical, arcade shmup boss" | 404 | 128x128 | job c53bcdf5-c82c-43e7-ab91-89d690c96a8b | Post-processing: the left half was mirrored onto the right (axis x=63.5) because the legs had different accents. Two 17px round armoured hip joints were hand-drawn, and the whole sprite was shifted up 10px, giving bbox x7-120, y16-116. Coordinates: **cannon mounts (21.5,42) and (105.5,42)**, **hip joints (42,76) and (85,76)**, **cockpit/core (63.5,47-48.5)**. Strengths 100-180 (seeds 401-403) only traced the flat sketch, and 40 (seed 405) lost the layout. Strength 70 (seed 406) and 55 (seed 407) were also tried. |
| boss/boss4_open.png | inpaint_image on the raw pixflux output (job URL), mask x55 y49 w18 h18 | "the round cockpit hatch slid open, revealing a round glowing reactor core inside, bright yellow-white hot center surrounded by orange and red glowing energy rings, dark metal frame around the open pit, top-down view" | 7 | 128x128 | job 4b756bf2-eeda-4f52-b155-7b9f5806815b | Only the 18x18 mask box was pasted onto boss4.png at (55,39), which accounts for the 10px shift. The RGB difference from boss4.png is confined to x55-72, y39-56. Reactor core centre **(63.5,48.5)**. The core is a slightly squarish glow. |

## Decor (rooftop props, 32x32; one 64-grid create_1_direction_object at size 32, no style ref, review 34d33b83…, now dismissed; tag `city_decor`)

Grid description: "flat rooftop prop on a dark city building roof at night, seen from directly above, top-down, dark navy and gunmetal grey, warm yellow lights and cyan magenta neon accents, black outline, medium shading, no shadow". There were 8 items per prop. Each prop was re-centred by an integer shift.

| path | frame | notes |
|---|---|---|
| decor/city_ac.png | 0 | Four AC units with fans. |
| decor/city_watertower.png | 12 | A brown wooden tower in a slight 3/4 view, brightened 30% in PIL because it disappeared on the roof tile. |
| decor/city_helipad.png | 17 | A dark pad with a white H, a yellow ring and corner lights. |
| decor/city_antenna.png | 24 | A lattice mast with a red light. The guy wires are separate 1-5px fragments, kept on purpose. This is the weakest read. |
| decor/city_neon.png | 33 | A cyan cocktail-glass neon sign with a magenta accent. |
| decor/city_skylight.png | 43 | A four-pane skylight with warm yellow light. |
| decor/city_dishes.png | 48 | Two white dishes on a grey platform. |
| decor/city_garden.png | 56 | Planters with a small greenhouse. |

Lessons: (1) With an img2img layout sketch, strength ~60 is the sweet spot for adding real detail while keeping the layout. Above ~100 the output only traces a flat sketch. (2) Inpaint accepts `image_url` = the pixflux job's download URL, which avoids pasting large base64. When post-processing changes the image, inpaint the raw output and paste only the mask box back with the same offset. (3) The 1-direction grid accepts mixed item types in one 64-grid, which gave the heli, hatch, rail car and locomotive candidates for 20 generations. Rail cars come out at about 18x31, so non-square sprites need row stretching.

---

# Stage 5 (volcano: lava river, ash plain, crater fortress)

Generations spent: 70 (balance went from 962 to 892). Palette: black and dark-grey basalt, ash grey, molten orange and yellow lava, dark red-black fortress metal, and dark iron enemies with orange glow accents. Layout sketches and previews were made with PIL in the session scratchpad and are not kept in the repo. All sprites are RGBA with no partial alpha. Re-centring uses integer shifts only, and the boat was stretched only by duplicating whole rows.

## Tilesets (create_topdown_tileset, 16px, high top-down, single color outline, medium shading, medium detail, standard mode)

| file | tileset id | lower → upper | transition | notes |
|---|---|---|---|---|
| tiles/lava_basalt.png/.json/_example.png | ac6e5671-a185-4a3a-af22-11e6d77b6c90 | "glowing molten lava, bright orange and yellow with dark crust cracks" → "dark cracked basalt rock" | "cooling black crust edge with glowing cracks", **round**, 0.5 | Bright lava with a crust-plate pattern. The basalt is raised, with orange veins in the cliff faces. |
| tiles/basalt_ash.png/.json/_example.png | ac0995cd-7ab8-4e3f-8f58-da936a277206 | basalt (lower_base dfbe096d…) → "grey volcanic ash plain with scattered cinders" | "drifted grey ash over dark rock, soft irregular organic edge", **round**, 0.5 | The ash came out warm grey-beige, and the cinders are barely visible. The ash is raised over the rock. |
| tiles/ash_fortress.png/.json/_example.png | fd826637-1b62-479f-b141-fc370d0a1400 | ash (lower_base c35b50bc…) → "dark red-black armoured fortress plating with glowing orange vents" | "heavy dark iron fortress wall edge with glowing orange vent slits", **square**, 0.25, text_guidance 10 | Maroon plate grid inside a dark iron wall, with glowing orange vents on the wall faces. The all-fortress tile has no vents and is more red than black. |

Base tile ids:
- lava: `7acbaa63-0d9a-4922-a0b6-e4de0b264317`
- basalt (upper of lava_basalt, lower of basalt_ash): `dfbe096d-a27f-41aa-b8a4-e5ac8d523059`. It is pixel-identical in both sheets (max diff 0).
- ash (upper of basalt_ash, lower of ash_fortress): `c35b50bc-c25b-41d9-8b64-203373355811`. It differs by at most 2 per channel. The all-ash tile is at x0 y48 in basalt_ash.png.
- fortress plating: `e66bf642-1570-45ab-90f7-2a8a1e21e7e2`

## Enemies (one 64-candidate create_1_direction_object grid at 32px, style ref = enemies/carrier.png, review 17f1073a…; tag `volcano_enemies`)

Grid description: "hostile volcanic military unit seen from directly above, facing down, dark iron armor with orange glowing heat accents, black outline, medium shading". It used 16 heli items, 10 rock turrets, 12 closed silos, 16 boats, 8 rockets and 2 open silos.

| path | source | size | notes |
|---|---|---|---|
| enemies/lavaboat.png | frame 46 ("heavy iron barge boat from above … bow at the bottom … round turret base in the centre without barrel") | 24x40 | Bow down. Cropped to x4-27, then stretched from 31 to 39 rows by duplicating rows 3, 6, 7, 8 (x2), 21, 25 and 27. The generated black hole in the turret ring was painted over as a dark iron mount with an orange centre pixel. **Turret centre (11.5,17.5)**: the ring spans x8-15, y14-21. The sprite occupies x5-18, y1-39. |
| enemies/magma_turret.png | frame 16 ("rock crusted round gun turret mount … black basalt rock shell with glowing orange lava seams") | 24x24 | The 28px sprite was nearest-neighbour decimated to 22px (rows/cols 2, 6, 10, 17, 21 and 25 dropped) and padded by 1. Some of the thin cracks are thinner or broken. Mount centre **(11.5,11.5)**. There is no barrel. |
| enemies/silo_closed.png | frame 26 ("round missile silo … closed circular blast doors split in two halves … orange warning stripes, glowing orange seam") | 32x32 | Used as generated. The disc is centred at (15.5,16). |
| enemies/silo_open.png | drawn by hand (PIL) on silo_closed | 32x32 | The RGB difference from the closed silo is confined to x7-24, y7-25, the door disc with r ≤ 9.4 around (15.5,16). It contains a dark pit with an orange heat ring and a missile seen from above: a fin cross, a grey body disc and a red warhead. The tip is at **(15.5,15.5)**. |
| enemies/rocket.png | drawn by hand (PIL) | 16x16 | Points down. The 2px grey body runs along x7-8, the fin cross sits at y3-6, there is an orange band at y8, and the red nose is at y13-14. Symmetric about x=7.5, bbox x3-12, y1-14. The grid rockets (frames 54-61) were 12x24 and too long for 16px. |

## Stage-4 redo

| path | source | notes |
|---|---|---|
| enemies/heli.png | volcano grid frame 0 ("sleek slim attack helicopter fuselage … without rotor blades … short stub wings with rocket pods, long thin tail boom pointing up, dark gunmetal grey, red lights") | 32x32. Slim fuselage with the canopy at the bottom (nose down), stub wings with rocket pods at y≈20-25, and the tail boom and fin at the top. A 4px dark rotor hub was hand-drawn at **(15.5,15.5)** (pixels 14-17). Non-outline pixels were brightened by ×1.3 + 8, and the red lights by ×1.5, so that it reads on the dark street_roof tiles. The old bulky heli is in the session scratchpad backup only. Frame 8 (object 3cb92daa…) is an alternative. |

## Boss

| path | tool | prompt | seed | size | id | notes |
|---|---|---|---|---|---|---|
| boss/boss5.png | create_image_pixflux img2img (init = detailed PIL sketch on an opaque grey background: octagonal hull, petal dome, 2 flame mounts in square housings, 2 missile racks of 4x2 tubes, a centre grille, vents and buttresses; **init_image_strength 170**, no_background false, detailed shading, highly detailed) | "top-down view of a giant volcanic crater fortress boss seen from directly above, facing down, massive round closed armored dome made of segmented petal plates in the centre, two round flame cannon turret mounts on the left and right flanks without barrels, two rectangular missile rack blocks with rows of missile tubes lower left and lower right, heavy armored walls and buttresses around, dark red-black metal deck plates, panel lines, rivets, glowing orange vents and seams, symmetrical, arcade shmup boss" | 512 | 144x128 | job 57783cfe-430e-44fa-a767-5cfcb5a3afdd | Post-processing: the grey background was flood-filled away, the image was cut to the octagon hull polygon (which also removed the side buttresses and two exhaust stubs) and given a 1px dark outline. The bbox is x4-140, y4-124. Coordinates: **dome centre (72,54)** (r 25, orange ring r 27); **flame cannon mounts (27,52) and (117,52)** (glowing r≈3 core, 22px mounts in 30x34 housings); **missile racks centred (40,97) and (104,97)** (block x24-56 / x88-120, y85-109; tubes in 2 rows at y≈93 and y≈101). A launch point at the rack's front edge would be (40,108) / (104,108). With `no_background: true` the model made the deck transparent (seeds 501-503). Seeds 504 and 505 (strength 60/80 on a plain sketch) and seed 511 (110) were flatter or lost the layout. |
| boss/boss5_open.png | inpaint_image on the raw pixflux output (job URL), mask x47 y29 w51 h51 | "the round armored dome split open, its segmented petal plates folded back to the rim, revealing a round glowing magma core inside, bright yellow-white molten center surrounded by orange and red glowing lava rings, dark metal frame around the open pit, top-down view" | 7 | 144x128 | job cca153b8-d012-466e-a583-2e20b416ecdf | Only the circle with r ≤ 25.6 around (72,54) was pasted onto boss5.png, so the orange dome ring and the deck stay identical. The RGB difference is confined to x47-97, y29-79. **Magma core centre (71.5,58.5)**: the bright yellow-white blob spans x64-79, y51-66, about 4px below the dome centre. |

## Decor (ash-plain props, 32x32; one 64-grid create_1_direction_object at size 32, no style ref, review e1689801…; tag `volcano_decor`)

Grid description: "flat ground prop on a grey volcanic ash plain seen from directly above, top-down, black basalt, ash grey, charred, glowing orange lava and embers accents, black outline, medium shading, no shadow". There were 4 items per prop across 16 props. Clusters of 3px or fewer were removed, and each prop was re-centred by an integer shift.

| path | frame | notes |
|---|---|---|
| decor/volcano_steamvent.png | 2 | A black rock cone with a glowing vent and a white steam puff, in a slight 3/4 view. |
| decor/volcano_crater.png | 14 | A scorched crater with radiating orange cracks. |
| decor/volcano_stumps.png | 21 | Charred trunks and a fallen log. |
| decor/volcano_boulders.png | 29 | Basalt boulders with faint orange cracks. |
| decor/volcano_wreck.png | 36 | A burnt-out vehicle hulk with a small fire. Chosen over the intact-looking tanks (32-35), which could be mistaken for enemies. |
| decor/volcano_pylon.png | 41 | A toppled rusty lattice pylon. |
| decor/volcano_fissure.png | 49 | A jagged glowing lava crack. |
| decor/volcano_obsidian.png | 61 | Black obsidian spikes with orange glints. |

Unused but good alternatives in the grid: lava pools (52-55) and ash dunes (56-59). The dunes have low contrast on the ash.

Lessons: (1) For a big opaque boss, use img2img with `no_background: false` on a sketch whose background is a flat grey, then flood-fill and polygon-mask the background away. With `no_background: true`, large flat deck areas were made transparent. (2) With a detailed, already shaded sketch, strength ~170 kept the layout and added texture. A plain sketch needs ~60. (3) Chained tileset base ids are returned immediately on creation, but chaining was only started after the previous sheet completed.
