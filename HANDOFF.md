# KRYONIS — Project Handoff

Browser-based 3D Mars colony builder. This document is the complete context
needed to continue the project in a fresh session.

**Status: M1–M8 complete. V2 Pass 1 + asset import complete.** Next is V2 Pass 2 —
see `KRYONIS_V2_PLAN.md` for the agreed scope and the decisions behind it,
and `KRYONIS_ASSET_SHOPPING_LIST.md` (+ `.pdf`) for the model/texture brief.

---

## 1. Running it

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npx tsc --noEmit   # typecheck
```

There is also a `/diagnostics` route: a server-rendered page that runs the world
generator and reports terrain balance per landing site. It exists because
"is roughly half this map buildable?" is a question about numbers, not about how
the regolith looks.

**Environment notes**
- Next.js 16.2 (Turbopack), React 19, three 0.185, R3F 9.7, drei 10.7, Zustand 5.
- `experimental.useTypeScriptCli: true` is **required** in `next.config.mjs`.
  TypeScript 7 is the native compiler and no longer exposes the JS API Next
  called directly; without this flag the dev server throws on startup.
- Windows dev: Next refuses two dev servers **per project directory**, not per
  port. If startup fails with "Another next dev server is already running",
  kill the stale process tree — `autoPort` will not help.

---

## 2. Design decisions worth not re-litigating

These were deliberate and were revisited more than once.

**The world is the hero.** UI lives on screen edges only; nothing is permitted in
the centre of the viewport. Panels are glass with 1px hairlines, not opaque
boxes.

**Palette is Mars, UI is not.** The HUD is cold graphite/titanium with a bronze
(`--color-dust`) accent. Keeping the instruments cool and metallic separates
"the world" from "the tools you run it with". Gold is reserved for *new /
unlocked* only. An earlier bright-cyan pass was rejected as too gamer-RGB.

**Plain English, never chemical notation.** "Oxygen", not "O₂". "Water", not
"H₂O". A player should never pay a beat of translation to read a resource bar.

**The crater is the boundary.** The playable area is an impact basin ringed by a
~55m wall. The player cannot leave because there is an escarpment in the way —
a reason, not an invisible wall. The camera is clamped to the same circle, and
the colonist walkability grid is the terrain's own buildable mask, so colonists
*physically cannot* leave the valley with no special-case code.

**Progression is a build tree, not a parallel tech tree.** Structures unlock by
building prerequisites (Lab → Reactor, Mine → Factory → Propellant Plant).
Research is separate and only makes what you own *work better*. The two answer
different questions: "what can I build" vs "how well does it run".

**No hard failure.** Life-support collapse kills colonists and tanks morale, but
the colony always survives and can rebuild.

**Events are modifiers with timers, never instant losses.** A dust storm cuts
solar to 35% for a few minutes; it does not delete your panels. Nothing fires
for the first two sols.

**A sol is 24 minutes** (`SOL_DURATION_SECONDS = 1440`).

**Research takes time; the build tree does not.** A research project costs
points up front and then runs for a while. That elapsed time is the only reason
the crew screen matters — the assigned lead makes a project both cheaper and
shorter, and one project runs at a time. Making research instant again would
silently delete the crew system's purpose.

**Locked never means dimmer.** Every unavailable state says which kind of
unavailable it is, in words, at full contrast. `opacity-40` on a locked entry
was the single worst readability bug in V1.

---

## 3. Architecture

```
src/
  app/                  Next routes: page.tsx (the game), diagnostics/
  game/
    core/               constants, resources, quality tiers, seeded RNG + noise
    world/              terrain generation, terrain mesh, sky, sun/moons, boulders, dust
    render/             Canvas, Scene, camera rig, lighting, post FX, controllers
    buildings/          catalog (data), procedural models, materials, BuildingsLayer
    colonists/          agent model, A* pathfinding, ColonistsLayer
    sim/                simulation.ts — the pure economy step function
    progress/           research tree, directives, dynamic events
    state/              Zustand stores
    save/               save schema, capture/restore, autosave
    ui/                 all HUD components
```

### The load-bearing rule: what lives outside React

Anything that changes **every frame** is kept in plain mutable objects, not in a
store, because routing it through React would re-render the interface 60×/sec:

- `worldClock.sols` — the colony clock
- `currentSun`, `currentMoons` — updated in place, zero allocations per frame
- `cameraTarget` — shared Vector3
- `occupancy` — Int32Array tile→building index
- `constructionProgress` — Map of in-progress builds
- `colonists[]` — the agent roster

Stores hold what the **UI** needs. `SimulationController` runs a fixed 0.25s
timestep and writes the store 4×/sec, so the HUD refreshes at a sane rate while
the 3D scene runs at full speed.

### Determinism

Everything derives from one integer seed — terrain, deposits, boulder scatter,
colonist names. A save stores the seed, not a heightmap. `/diagnostics` asserts
that two generations from one seed match on all 9216 tiles.

### Rendering strategy

Buildings and colonists are **merged per material and instanced**: one draw call
per (type × material) regardless of how many exist. Every model is generated at
runtime — **the project ships no binary art assets**; textures are drawn into
canvases from periodic value noise.

---

## 4. Bugs fixed (and how, so they don't come back)

| Symptom | Cause | Fix |
|---|---|---|
| Black screen | `SKY_RADIUS` was raised to 4000, equal to the camera far plane, so the sky dome was frustum-clipped. `depthTest:false` does **not** exempt geometry from near/far clipping. | Sky radius 3000, far plane 4000. |
| Everything orange, no terrain | `GroundHaze` was a cylinder *enclosing the camera*, drawn over terrain at 0.64 alpha with its densest band at screen-bottom — where the ground is. | Removed. Distance haze is the scene fog's job. |
| `MAX_TEXTURE_IMAGE_UNITS(16)` shader failures | The offscreen **thumbnail renderer** took a second WebGL context. Browsers cap contexts; the game canvas lost that contest. | Thumbnails removed entirely; build cards use SVG icons. |
| `Cannot read properties of null (reading 'alpha')` | postprocessing reads `renderer.getContext().getContextAttributes()`. Context was null. | `PostFX` checks the context **every render** (not memoised) and renders nothing rather than crashing. |
| `matrixWorld of undefined` | Scaling/moving a rigged model **before** cloning breaks the clone's skeleton bindings. | Rig left untouched; transform applied to a wrapper Group. |
| 64% of the map unbuildable | High-frequency octaves in mountain noise created micro-slopes above the buildable threshold everywhere. | Fewer octaves; slope sampled at tile scale, not half-tile. |
| Territory button opened nothing | `Dock` had a `territory` key but `page.tsx` had no branch for it, so the section switched and the right rail fell through to the directive panel. A dead button that looked alive. | `TerritoryConsole`. **Lesson: `DockKey` and the section switch must be changed together.** |
| Buildings floating above the ground | Structures are seated at the *highest* corner of their footprint so nothing is ever buried — which leaves the downhill corners unsupported on any slope. | `FoundationLayer`: one instanced plinth per building, filling from the seat height down to the low corner. Do not "fix" this by lowering the buildings. |
| Imported models silently unused | three's `GLTFLoader` runs node names through `sanitizeNodeName`, which strips characters reserved for animation paths — including `:`. Meshes written as `mat:hull` arrived as `mathull`. Every model loaded, matched nothing, and fell back to procedural geometry with **no error at all**. | Pipeline writes `mat_<key>`. **Lesson: never put `:` or `.` in a glTF node name you intend to read back.** |
| Downloaded model would not simplify | glTF-Transform v4's `weld` merges only *bitwise identical* vertices — there is no distance tolerance. With normals present, nothing welds on hard-surface geometry, so meshopt has no edges to collapse: the oil rig would not go below 76% at any ratio. | Strip normals → weld → simplify → regenerate normals. |
| Models measured the wrong size | `flatten()` removes the node *hierarchy* but leaves each node's own transform in place; it does not touch vertex data. Anything reading raw accessors afterwards is reading local space. | `flattenAndBake()` in `tools/lib-gltf.mjs`. Meshes shared by several nodes must be deep-copied first, or baking one node moves the others. |
| Small text unreadable | `--color-faint` and `--color-titanium` were both `#6d665e` — 3.5:1 on the void background, under the 4.5:1 needed for body text — and locked states were expressed as `opacity-40` on top of that. | Both colours lifted above 4.5:1; locked/blocked/owned states now use the `state-*` utilities in `globals.css`, which keep full text contrast and change the *container* instead. |

**Lesson worth keeping:** the dev-server log buffer is cumulative since server
start. Stale errors in it caused a long chase after an already-fixed bug.
Restart the server before trusting a "still failing" log.

---

## 5. Milestones

- **M1** Scaffold, terrain, sky, sun/moons, camera, post FX, quality tiers.
- **M2** Grid, terrain classification, radial territory unlocking, placement.
- **M3** 18 procedural structures, materials, construction.
- **M4** Economy: power grid, production chains, storage caps, population, morale.
- **M5** Colonists: named individuals, A* pathfinding, jobs, homes, shifts.
- **M6** HUD: top strip, dock, floating inspector, notifications, minimap, settings.
- **M7** Research (12 nodes), rolling directives, 6 dynamic events.
- **M8** New-colony screen with 3 surveyed landing sites, save/load, autosave.
- **Upgrades** 3 shared tiers (Standard/Enhanced/Optimised) on every structure.
- **V2 Pass 1** Full-screen consoles, research-as-projects, mission doctrine,
  4-step new-colony wizard, foundation plinths, save v3, persistent settings,
  0.5×/1×/3× time, contrast and locked-state pass.

### Not done — this is V2 Pass 2

- **More structures.** Target ~30: industry (smelter, polymer plant, parts
  fabricator), logistics (depot, rover garage, cargo pad), habitation (quarters
  tier 2, canteen, recreation dome), support (radiator field, dust filtration).
- **Minimap accuracy** — real deposits and a click-to-move camera.
- **Which imported model is which** is still partly guesswork. The kit props
  were identified from their proportions, not by looking at them; swapping an
  assignment is a one-line change in `IMPORTED_MODELS`.
- **Trade/Exchange** — greyed in the dock.
- Terrain generation runs on the main thread (~1–2s stall at load). Now hidden
  behind the intro video rather than eliminated; a Web Worker is still the real
  fix and still the biggest perf win available.

### V2 conventions worth knowing

- **`Console` is the shell for any full-screen screen.** It owns the header,
  the clock, Esc-to-close and the radar backdrop. Use `ConsoleSection` and
  `Readout` inside it rather than inventing new containers.
- **While a console is open the HUD is unmounted, not hidden** — a covered HUD
  still holds focus and still repaints four times a second behind an opaque
  screen.
- **`announce()` in `useToastStore`** is how non-React code (the simulation
  tick) raises a transient message. `Notifications` is derived state for
  *ongoing* conditions; toasts are for *moments*. They are not interchangeable.
- **Doctrine is applied in `initialise()`**, not on the new-game screen, so a
  reset rebuilds the same start from the profile.
- **`window.kryonisDebug`** (dev builds only) has `sols`, `setTimeOfDay()`,
  `grant({research: 500})` and `models()` — the last prints which structures are
  on a downloaded model and which fell back to procedural.

## 9. The asset pipeline

Downloaded models are **not** loaded as-is. `tools/build-models.mjs` imports
*geometry only*, maps each source material onto the game's own `MaterialKey`
palette, and emits one mesh per key named `mat_<key>`. The runtime
(`importedModels.ts`) reads those and produces the same `BuildingModel` shape
`buildModel()` produces, so imported and procedural buildings are identical
downstream — same instancing, same construction animation, same plinths, same
sampler budget.

```bash
node tools/inspect-models.mjs "Models i have added self"   # what is in a file
node tools/split-kit.mjs <scene.glb> <outDir> 1.6          # break a diorama up
node tools/build-models.mjs                                # build public/models
```

168 MB of source became 3.0 MB across 13 models. `IMPORTED_MODELS` in
`src/game/buildings/importedModels.ts` maps structure → file; delete an entry to
send that structure back to its procedural model.

---

## 6. Known constraints

- **Fragment sampler budget is 16** on typical ANGLE/D3D11 contexts. Every
  material must stay well under it. Current worst case: colour map + shared
  normal + shadow = 3. **Do not add a second WebGL context anywhere.**
- Colonist models must stay **instanceable**. Rigged/skinned characters were
  tried and removed: skinning cannot be instanced, which dropped the crew cap
  from 240 to 14 and pulled in imported materials that broke shader compilation.

---

## 7. Model wishlist (for outsourcing)

**Hard requirements for anything sourced:**

1. **glTF/GLB only.** Not FBX — FBX is 10–20× larger and needs a heavier loader.
2. **Under 1 MB per model**, ideally under 400 KB. Draco or Meshopt compressed.
3. **Under ~8k triangles.** These are seen at 40–100px on screen.
4. **One material, one texture set** per model. Ideally a single 1024² baked
   albedo with AO already in it. **Maximum two texture maps** — the sampler
   budget above is real.
5. **Y-up, real-world scale (metres), origin at the base centre**, facing +Z.
6. **CC0 / CC-BY** licence. Please record the source URL and author.
7. Characters: **rigged with a looping walk + idle** or don't bother — a static
   character is strictly worse than the procedural one already in the game.

**What would actually help, in priority order:**

| # | Model | Footprint | Notes |
|---|---|---|---|
| 1 | **Solar array** | 2×2 tiles (4×4 m) | Tracking PV rows on a frame. Highest visual payoff — there will be dozens on screen. |
| 2 | **Habitat dome** | 3×3 (6×6 m) | Inflatable shell, regolith berm at the base, one airlock. |
| 3 | **Greenhouse** | 3×2 (6×4 m) | Glazed barrel vault, visible planting inside. |
| 4 | **Storage tanks** | 2×2 | Cluster of 3–4 vertical insulated tanks. |
| 5 | **Fission reactor** | 2×2 | Shielded core + large radiator panels. |
| 6 | **Ice drill rig** | 2×2 | Derrick + condenser drum. |
| 7 | **Comms dish** | 2×2 | Steerable high-gain dish on a mast. |
| 8 | **Spaceport pad** | 4×4 (8×8 m) | Blast-hardened apron, beacon masts, fuel gantry. |
| 9 | **Rover** | — | Small pressurised rover for scenery/animation. |
| 10 | **Astronaut** | 1.85 m tall | **Only if rigged** with walk + idle loops. |

Style reference: NASA/SpaceX plausible hardware — white thermal paint, machined
aluminium, gold MLI foil, dark PV glass. Not military sci-fi, no glowing neon.

Drop models in `public/models/` and wire them into
`src/game/buildings/catalog.ts` (each entry has a `buildParts()` that can be
swapped for a GLB loader).

---

## 8. Suggested M9 scope

1. Finish M8's tail: **codex, tutorial, audio** (Web Audio, procedural — no files).
2. **Terrain generation → Web Worker** to kill the load stall.
3. **Trade/Exchange** screen (Earth contracts, import/export).
4. Swap in outsourced GLB models as they arrive.
5. Colonist detail: click-to-inspect a named colonist, profession icons.
