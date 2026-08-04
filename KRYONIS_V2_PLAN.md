# KRYONIS — Version 2 Plan

V1 (M1–M8) is complete. **Pass 1 is done** and so is the asset import. This
document now describes **Pass 2**, and records the decisions behind Pass 1 so
they are not re-litigated.

Reference display: **1920×1080 fullscreen**.

---

## Where things stand

### Done — Pass 1

| Area | Result |
|---|---|
| Consoles | Crew, Research, Territory, Codex, Objectives are full-screen. Territory previously opened nothing at all. |
| Research | A project that costs points up front and then *takes time*, so the assigned crew lead matters. |
| Doctrine | Chosen at landing; changes starting stock, build speed, research cost, life-support draw. |
| Persistence | Save v3. Resumes straight into the colony. Settings persist separately. Three scoped resets. |
| Readability | `--color-faint` / `--color-titanium` lifted above 4.5:1. Locked states use shape + words, never opacity. |
| Time | 0.5× / 1× / 3×. |
| Trailer | Plays when a colony is **founded**, not on first page visit. |
| Copy | Plain English throughout — "Keep the Lights On", not "Establish Generation". |

### Done — assets

168 MB of downloaded models became **3.8 MB across 7 files**. Six buildings and
one astronaut survived review:

| Model | Used for |
|---|---|
| `reactor.glb` | Fission Reactor |
| `refinery.glb` | Fabrication Plant |
| `rocket.glb` | Spaceport |
| `kit-block-a/b/c.glb` | Habitat Dome, Recreation Atrium, Command Lander |
| `astronaut.glb` | Every colonist |

The smaller kit props were rejected in gallery review as featureless
placeholder cylinders and deleted. Everything else uses purpose-built
procedural geometry, which is the better default: authored for this camera
distance, in this palette, with detail where the player actually looks.

### Done — model detail

Every procedural building now carries working hardware from `detailKit.ts`:
control panels with buttons, handrails, ladders, flanged pipe runs, louvred
vents, bolt rows, crates. The greenhouse was rebuilt outright — it was three
green boxes, because the *soil* material was green, so the soil was the plant.

**Measured, not assumed:** `npx tsx tools/count-tris.mts` prints the triangle
cost of every structure. Current total 86,784 across 18 structures; nothing
over 8k.

---

## Pass 2 — more structures

The catalog is 18. Target is ~30, grouped so the build deck reads as real
categories rather than one long shelf.

### 2.1 Industry
| Structure | Footprint | Role |
|---|---|---|
| Smelter | 3×2 | Ore → refined metal. The missing step between mine and factory. |
| Polymer Plant | 2×2 | Carbon → plastics and seals. Feeds habitat construction. |
| Parts Fabricator | 2×2 | Metal → components. Consumed by upgrades. |
| Ore Sorter | 2×2 | Raises mine yield rather than producing anything itself. |

### 2.2 Logistics
| Structure | Footprint | Role |
|---|---|---|
| Rover Garage | 3×2 | Spawns a rover that drives between structures. Pure life. |
| Cargo Pad | 3×3 | Landing point for Earth supply; pairs with the spaceport. |
| Pipeline Node | 1×1 | Links storage to consumers; reduces transfer loss. |
| Depot | 3×2 | Bulk storage, cheaper per unit than tanks. |

### 2.3 Habitation
| Structure | Footprint | Role |
|---|---|---|
| Crew Quarters II | 3×3 | Denser housing, unlocked by Habitat Ergonomics. |
| Canteen | 2×2 | Converts raw food into morale. |
| Recreation Dome | 3×3 | Morale at scale; the reason a big colony stays happy. |
| Infirmary Wing | 2×2 | Extends the medical bay. |

### 2.4 Support
| Structure | Footprint | Role |
|---|---|---|
| Radiator Field | 2×2 | Sheds heat; required by the reactor at higher tiers. |
| Dust Filtration | 2×2 | Cuts the dust-storm penalty. |
| Comms Relay II | 2×2 | Faster research, longer contracts. |

### 2.5 Deck grouping
Categories become: Habitation · Power · Life Support · Industry · Logistics ·
Science · Support. Each card already shows a real render, baked from the actual
model by `ThumbnailBaker`.

---

## Pass 3 — candidates, not committed

- **Minimap** — real deposits, click-to-move camera.
- **Rover movement** — a vehicle that actually drives between structures.
- **Trade/Exchange** — greyed in the dock since V1.
- **Terrain → Web Worker.** Generation is a 1–2 s main-thread stall, currently
  hidden behind the intro video rather than fixed. Still the largest single
  perf win available.

---

## Constraints that still apply

- **16 fragment samplers.** No second WebGL context. The thumbnail baker
  borrows the game's renderer precisely because an earlier attempt at previews
  made its own context and broke shader compilation.
- **Colonists must stay instanceable.** The imported astronaut works only
  because the pipeline strips its skeleton. A skinned character drops the crew
  cap from 240 to 14.
- **Never put `:` or `.` in a glTF node name** you intend to read back —
  three's loader strips them, and the failure is silent.
- Nothing in the centre of the viewport during play; consoles are the exception
  because they deliberately replace the world.
- Plain English, never chemical notation.
