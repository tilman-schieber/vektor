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
