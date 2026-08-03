# KRYONIS — Version 2 Plan

V1 (milestones M1–M8) is complete and playable. V2 is the pass that makes it
*feel* finished: nothing unreadable, nothing floating, nothing that opens into
an empty rail, and enough content that a colony has somewhere to go.

Reference display for all layout work: **1920×1080 fullscreen**. Everything must
still degrade sanely down to ~1280 wide, but 1080p is what gets tuned.

Decisions taken before starting (do not re-litigate):

| Question | Decision |
|---|---|
| 250 MB trailer | Ship as-is. Mitigated by loading the world *behind* it and an instant skip. |
| Which screens go full-screen | Crew, Research, Territory, Codex. Directives + inspector stay as edge panels. |
| Reference resolution | 1920×1080 fullscreen. |
| Order of work | Fix-first (Pass 1), then new content (Pass 2). |

---

## Pass 1 — Everything that is broken, unreadable, or missing

### 1.1 Boot and first run
- Trailer plays on **first run only**, before the new-colony screen.
- The 3D world, terrain generation and texture bake all start **during** the
  trailer, so the wait is not dead time. Entering the colony afterwards is
  instant instead of a second stall.
- Skip button available from the first frame, not after 1.8 s.
- Buffering state is visible rather than a black rectangle.
- Returning players get the short loading clip, not the trailer.
- Settings gains **Replay intro**.

### 1.2 New-colony flow (more questions, better UI)
Currently one screen: corporation name + site. Becomes a short wizard:

1. **Commander** — your name, used by the game when it addresses you.
2. **Programme** — corporation name, and a mission doctrine that actually
   changes starting conditions (see below).
3. **Landing site** — the existing three surveyed sites, with the survey bars
   kept because they are measured from real terrain.
4. **Confirm** — a summary card, then descent.

Doctrine is not flavour text; each sets starting stock, a standing modifier and
one free research node:

| Doctrine | Start | Ongoing |
|---|---|---|
| Scientific | Extra research points, fewer credits | Research costs less |
| Industrial | Extra metal + credits | Construction is faster |
| Sustainer | Extra water + food, larger crew | Life support drains slower |

### 1.3 Time controls
Replace 1× / 2× / 4× with **0.5× / 1× / 3×**, plus pause. Four states total:
stop, slow, normal, fast — matching the request exactly. Keyboard: `Space`
pause, `1` `2` `3` for the speeds.

### 1.4 Full-screen consoles
A shared `Console` shell: full-viewport, world hidden behind it, its own header
with title/subtitle/close, `Esc` to exit, and a slow radar sweep in the
background so it reads as an instrument rather than a web page.

- **Crew console** — roster as cards, capacity from habitats, hire by skill,
  assign to research. Detailed in 1.5.
- **Research console** — branch columns, node detail, assigned researcher,
  progress over time. Detailed in 1.6.
- **Territory console** — the thing that currently opens nothing. A top-down
  claim map of the crater: claimed ring, next ring, cost, what each ring
  contains (ice, ore, buildable fraction).
- **Codex console** — readable entries with locked ones clearly marked
  *Undiscovered* rather than dimmed into illegibility.

### 1.5 Crew, in full
- Capacity comes from built habitation. 4 crew at start; a Habitat Dome adds
  places; you may only hire into a vacancy.
- Hiring: choose the **skill** you want. Cost rises with roster size and varies
  by skill.
- Each member has a skill, a rank, and a morale/fatigue state.
- Assign a member to **lead research** — their skill affinity and rank cut the
  cost and raise the rate of matching branches.
- Named colonists in the roster correspond to the agents walking around.

### 1.6 Research, in full
- Research stops being an instant purchase. A project is **started**, then
  progresses per sol at a rate set by the assigned researcher and by how many
  labs you have running.
- Prerequisites shown honestly: a locked node says which node unlocks it.
- Locked/undiscovered nodes are legible — outlined and labelled, not 55% opacity.

### 1.7 Readability
- Audit every `text-faint` / `opacity-55` / micro-type use against the 1080p
  reference. Minimum contrast for body copy raised.
- Locked, undiscovered and disabled states get an explicit visual language
  (outline + label) instead of "make it dimmer".

### 1.8 World and render fixes
- **Floating structures.** Buildings are seated at the highest corner of their
  footprint, so downhill corners hang in the air. Add a regolith skirt/plinth
  that fills to the lowest corner — physically what a real pad would be.
- **Untextured surfaces.** Audit every material in the library for a colour map;
  anything flat-shaded gets one, within the 16-sampler budget.
- Boulders and scatter checked for the same seating problem.

### 1.9 Persistence
- Save schema v3: adds crew detail, research-in-progress, doctrine, commander
  name, time speed, camera position, settings.
- **Settings persist** across sessions (currently they do not).
- Reset is expanded: *Reset world* (new colony), *Reset settings*, *Reset
  everything including the intro flag*.

### 1.10 Objectives / overview
Overview becomes a real screen: current directive, what it wants, what it pays,
and a short "what should I do next" line derived from the actual colony state.

---

## Pass 2 — Content and depth

### 2.1 More structures
Target ~30 total, grouped so the build deck reads as categories:

- **Industry** — smelter, polymer plant, parts fabricator, ore refinery.
- **Logistics** — depot, pipeline node, rover garage, cargo pad.
- **Habitation** — crew quarters tier 2, medical bay, canteen, recreation dome.
- **Support** — radiator field, dust filtration, comms relay upgrade.

### 2.2 Map
Minimap becomes accurate: real terrain colours, real deposits, real building
positions, claimed-ring overlay, click to move the camera.

### 2.3 Models
Swap procedural geometry for downloaded GLB models as they arrive. Wiring point
is `buildParts()` in `src/game/buildings/catalog.ts`. See
`KRYONIS_ASSET_SHOPPING_LIST.md` for what to fetch and the hard constraints.

---

## Constraints that still apply

- **16 fragment samplers.** Every material stays well under. No second WebGL
  context, ever.
- **Colonists must stay instanceable** — no skinned/rigged characters in the
  crowd. Rigged models are fine for a portrait or a single hero prop.
- Nothing in the centre of the viewport during play. Consoles are the exception,
  because they deliberately replace the world.
- Plain English, never chemical notation.
