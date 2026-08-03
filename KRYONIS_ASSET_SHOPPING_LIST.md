# KRYONIS — Asset Shopping List

What to download, where to look for it, and the rules a file has to obey to be
usable. Hand this list to the internet; drop what you find into the folders
named below and the game will pick them up.

---

## 1. Rules every downloaded file must obey

These are not preferences. A file that breaks one of these will either not load,
or will load and quietly destroy the frame rate.

| # | Rule | Why |
|---|---|---|
| 1 | **glTF / GLB only.** Not FBX, not OBJ, not BLEND. | FBX is 10–20× larger and needs a heavier loader. If you only find FBX, say so and it can be converted. |
| 2 | **Under 1 MB per model.** Ideally under 400 KB. | Dozens are on screen at once. |
| 3 | **Under ~8,000 triangles.** | These are seen at 40–100 pixels tall. Detail beyond that is thrown away. |
| 4 | **Maximum two texture maps per model.** One 1024² albedo with ambient occlusion baked in is perfect. | The graphics card allows 16 texture slots total for the *entire* scene. This limit is real and has already broken the build once. |
| 5 | **Y-up, metres, origin at the base centre, facing +Z.** | Anything else lands sideways, underground, or a hundred times too big. |
| 6 | **CC0 or CC-BY licence.** Record the source URL and the author's name. | CC-BY needs credit in the game. Anything "personal use only" cannot be used. |
| 7 | Characters: **rigged with looping walk + idle**, or skip it. | A static human is worse than the procedural one already in the game. |

**Style reference:** NASA / SpaceX plausible hardware. White thermal paint,
machined aluminium, gold foil insulation, dark blue-black solar glass, dusty
regolith. **Not** military sci-fi. No glowing neon, no purple rim lights.

**Good sources:** Poly Haven (CC0, best textures), Sketchfab (filter to
Downloadable + CC0/CC-BY), Quaternius, Kenney.nl, NASA 3D Resources (public
domain, real spacecraft), ambientCG (CC0 textures), Freesound (audio).

**Where to put files:**

| Kind | Folder |
|---|---|
| Building models | `public/models/buildings/` |
| Props and scenery | `public/models/props/` |
| Characters | `public/models/characters/` |
| Textures | `public/textures/` |
| Audio | `public/audio/` |
| Crew portraits | `public/portraits/` |

---

## 2. Buildings — highest payoff first

Footprint is in grid tiles; one tile is 2 metres. A 2×2 building is 4 m × 4 m.

| # | Asset | Footprint | Search phrase to paste into Google / Sketchfab | Replaces | What matters most |
|---|---|---|---|---|---|
| 1 | **Solar array** | 2×2 | `solar panel array low poly glb cc0` | Solar Field | Dozens on screen — the single biggest visual win. Tilted rows on a frame. |
| 2 | **Habitat dome** | 3×3 | `mars habitat dome 3d model gltf` | Habitat Dome | Inflatable shell, regolith berm at the base, one visible airlock. |
| 3 | **Command lander** | 3×3 | `mars lander descent module 3d model glb` | Command Lander | Squat, legged descent stage. This is the first thing the player sees. |
| 4 | **Greenhouse** | 3×2 | `greenhouse module sci fi 3d model gltf` | Greenhouse | Glazed barrel vault with planting visible inside. |
| 5 | **Storage tanks** | 2×2 | `industrial storage tank cluster low poly glb` | Storage / Oxygen Plant | A cluster of 3–4 vertical insulated tanks reads better than one big one. |
| 6 | **Fission reactor** | 2×2 | `kilopower nuclear reactor mars 3d model` | Fission Reactor | The radiator fins are the recognisable part. Prioritise those. |
| 7 | **Ice drill rig** | 2×2 | `drilling rig derrick low poly 3d model glb` | Ice Extractor | Vertical derrick + condenser drum. |
| 8 | **Regolith mine** | 3×3 | `bucket wheel excavator low poly 3d model` | Regolith Mine | A conveyor or bucket wheel makes mining readable from above. |
| 9 | **Comms dish** | 2×2 | `satellite dish antenna low poly glb` | Comms Relay | Steerable high-gain dish on a mast. |
| 10 | **Battery bank** | 2×2 | `battery storage container industrial 3d model` | Power Cell Bank | Containerised racks — grounded and plausible. |
| 11 | **Research laboratory** | 3×2 | `space station laboratory module 3d model gltf` | Research Lab | Instruments, small windows, antennas — must not read as a habitat. |
| 12 | **Spaceport pad** | 4×4 | `rocket landing pad sci fi 3d model glb` | Spaceport | Blast-hardened apron, beacon masts, fuel gantry. |
| 13 | **Smelter / refinery** | 3×3 | `industrial refinery low poly 3d model glb` | *New in Pass 2* | Stacks and pipework. Industry needs to look industrial. |
| 14 | **Depot / warehouse** | 3×2 | `warehouse container depot low poly glb` | *New in Pass 2* | Flat-roofed shed plus container stacks. |
| 15 | **Rover garage** | 3×2 | `garage hangar low poly sci fi glb` | *New in Pass 2* | Open bay with a vehicle visible inside. |
| 16 | **Medical bay** | 2×2 | `medical module space station 3d model` | *New in Pass 2* | Distinguishable from other habitat modules at a glance. |
| 17 | **Radiator field** | 2×2 | `heat radiator panel spacecraft 3d model` | *New in Pass 2* | Flat white panels on a frame. |
| 18 | **Pressurised corridor** | 1×N | `modular space station corridor tube 3d model` | Connection pieces | Straight, corner and T pieces if you can get a matched set. |

---

## 3. Characters and vehicles

| # | Asset | Search phrase | Notes |
|---|---|---|---|
| 19 | **Astronaut (rigged)** | `rigged astronaut walk animation glb free` | 1.85 m tall. **Only useful if rigged with walk + idle loops.** One will be used for portraits and hero shots — the walking crowd stays procedural for performance reasons. |
| 20 | **Pressurised rover** | `mars rover pressurised 3d model low poly glb` | Drives between buildings. Makes the colony feel alive before vehicles are simulated. |
| 21 | **Small utility rover** | `mars rover curiosity 3d model nasa` | NASA 3D Resources has real ones, public domain. |
| 22 | **Cargo crates / pallets** | `sci fi cargo crate low poly glb` | Scatter props around depots. A set of 3–4 variants is ideal. |

---

## 4. Scenery and terrain dressing

| # | Asset | Search phrase | Notes |
|---|---|---|---|
| 23 | **Mars boulders** | `mars rock photogrammetry 3d model cc0` | 4–6 *small* variations beat one detailed hero rock. Under 2k triangles each. |
| 24 | **Regolith texture set** | `mars regolith seamless texture 2k cc0` (try ambientCG) | Albedo + normal + roughness. 2048² maximum. |
| 25 | **Dust / sand texture** | `desert sand seamless texture cc0` | Used for terrain variation between regions. |
| 26 | **Rock cliff texture** | `rock cliff seamless texture cc0` | For the crater escarpment wall. |
| 27 | **Mars sky / starfield** | `starfield equirectangular hdri cc0` | Night sky backdrop. Equirectangular, 4096² maximum. |
| 28 | **Antenna / mast props** | `antenna mast low poly sci fi glb` | Small dressing to break up flat ground. |

---

## 5. Audio

Short and dry beats cinematic. Long reverb tails fight the music.

| # | Asset | Search phrase | Use |
|---|---|---|---|
| 29 | **UI click / confirm** | `sci fi ui button click sound effect wav` | Every button. Under 200 ms. |
| 30 | **Alert / warning** | `sci fi alarm alert beep wav` | Life support failure, dust storm. |
| 31 | **Construction loop** | `construction machinery loop ambience wav` | Plays while something is being built. Must loop seamlessly. |
| 32 | **Wind ambience** | `desert wind ambience loop wav` | The Mars bed layer. Thin, not howling. |
| 33 | **Research complete** | `sci fi success chime sound effect` | One-shot reward sound. |
| 34 | **Ambient music bed** | `ambient space exploration music loop royalty free` | You already have `jonasblakewood-adventure-trailer.mp3` in Downloads — that works for the trailer, but the in-game bed should be quieter and loopable. |

---

## 6. 2D art

| # | Asset | Search phrase | Use |
|---|---|---|---|
| 35 | **Crew portraits** | `astronaut portrait helmet photo` (or generate them) | Square, 512², one per crew member. Makes the crew console feel like people rather than rows. |
| 36 | **Codex illustrations** | `mars colony concept art` | One per codex entry. Bright and inspectable, not dark and atmospheric. |
| 37 | **Landing site imagery** | `mars orbital photograph nasa public domain` | The three site cards on the new-colony screen. NASA imagery is public domain. |
| 38 | **Faction / corporation marks** | *make these, don't download* | Simple SVG marks. Can be drawn in-engine. |

---

## 7. When you hand files back

Keep a plain text file next to the models listing, for each one: **filename,
source URL, author, licence**. CC-BY legally requires the credit, and without a
record it is impossible to reconstruct later.

If a model is only available as FBX and it is genuinely the right one, download
it anyway and flag it — conversion is possible, it just is not free.
