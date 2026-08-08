# KRYONIS

A browser-based 3D Mars colony builder. You land in an impact crater with a
descent vehicle, four colonists and a budget, and you have to make the place
self-sustaining before your reserves run out.

Built with Next.js, React Three Fiber and TypeScript. Runs entirely in the
browser — no backend, no accounts, no install.

---

## Quick start

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |

Requires Node 20+. A discrete GPU is not required — quality is auto-detected and
can be overridden in settings.

---

## What the game is

You are running a private Mars programme. The colony sits on the floor of a
crater roughly 170 metres across, ringed by a wall too steep to build on or walk
up. That wall is the map boundary: you cannot leave because there is an
escarpment in the way, not because of an invisible barrier.

The loop is: generate power, turn the atmosphere into breathable oxygen, dig ice
for water, grow food, hire crew to staff it all, and keep the whole chain
balanced while dust storms and equipment failures knock pieces of it over.

**Nothing ever hard-fails.** Running out of oxygen kills colonists and wrecks
morale, but the colony always survives and can rebuild. Events are modifiers
with timers — a dust storm cuts solar output for a few minutes; it does not
delete your panels.

### Systems

- **20 structures** across habitation, power, life support, industry, science
  and logistics, unlocked by a build tree (build a Lab before a Reactor, a Mine
  before a Fabrication Plant).
- **Economy** with a real power grid, production chains that throttle on their
  scarcest input, storage ceilings, and a day/night solar curve. A sol is 24
  minutes and solar output goes to zero for half of it, so batteries matter.
- **Crew** as named individuals with professions and skills. They pathfind
  between home and work on shift schedules. Housing creates vacancies; you
  choose who fills them.
- **Roads** in two grades. Both carry identical power and water — the sealed
  grade buys morale, because crews walk it in shirtsleeves.
- **Research** in four branches. Projects cost points up front and then take
  time, and the crew member you assign as lead makes them cheaper and faster.
- **Directives** that roll forward forever, generating new goals scaled to your
  colony once the authored list runs out.
- **Codex** of 12 entries on the real science, each unlocked by building the
  thing it describes.
- **Save/load** to browser storage, with autosave.

### Educational, without being a lesson

Everything the codex teaches is true, and where a figure is approximate it says
so. MOXIE really did make oxygen from Martian air aboard Perseverance. Martian
soil really does contain perchlorates that must be washed out before crops. A
fission reactor on Mars really is mostly radiator, because the atmosphere is too
thin to carry heat away. Nothing is ever pushed at you — entries unlock at the
moment you have shown you care about the subject, and then wait.

---

## Architecture

```
src/
  app/            Next routes — page.tsx (the game), diagnostics/, models/
  game/
    core/         constants, resources, quality tiers, seeded RNG + noise
    world/        terrain generation, mesh, sky, sun/moons, scatter
    render/       Canvas, Scene, camera, lighting, post FX, controllers
    buildings/    catalog (data), procedural models, materials, layers
    colonists/    agent model, A* pathfinding, rendering
    sim/          simulation.ts — the pure economy step function
    progress/     research, directives, events, codex
    state/        Zustand stores
    save/         save schema, capture/restore, autosave
    ui/           every HUD component
tools/            asset pipeline and headless simulation tests
```

Three decisions carry most of the weight:

**What lives outside React.** Anything that changes every frame — the colony
clock, sun and moon positions, the camera target, the tile occupancy grid, the
colonist roster — is kept in plain mutable objects, not in a store. Routing them
through React would re-render the interface sixty times a second. The simulation
runs on a fixed 0.25s timestep and writes the store four times a second, so the
HUD refreshes at a sane rate while the scene renders at full speed.

**Everything derives from one seed.** Terrain, mineral deposits, boulder
scatter and colonist names all come from a single integer. A save stores the
seed, not a heightmap. The `/diagnostics` route asserts that two generations
from one seed match on every tile.

**Geometry is merged per material and instanced.** One draw call per
(building type × material), however many exist.

---

## Development notes

`/diagnostics` is a server-rendered page that runs the world generator and
reports terrain balance for each landing site. It exists because "is roughly
half this map buildable?" is a question about numbers, not about how the
regolith looks — and it caught a generation bug that made 64% of the map
unbuildable cliff.

`/models` previews the imported GLB assets.

`experimental.useTypeScriptCli` is required in `next.config.mjs`. TypeScript 7
is the native compiler and no longer exposes the JS API Next called directly;
without the flag the dev server throws on startup.

`HANDOFF.md` carries the full engineering context — design decisions worth not
re-litigating, and a table of bugs with their root causes so they do not come
back.

---

## Assets

Most of what you see is generated at runtime: terrain, textures (drawn into
canvases from periodic value noise), and the procedural structure models. A
small set of GLB models in `public/models` is built by `tools/build-models.mjs`.

Large binaries — source video, raw model downloads, archives — are gitignored.
Git keeps every version of a binary forever, so a file deleted from the working
tree still costs its full size in the pack for the life of the project. This
repository is kept small on purpose.

Audio is synthesised with the Web Audio API. There are no sound files.

---

## Status

Playable end to end: choose a landing site, build a colony, run it, save it,
come back to it.

Not finished: the onboarding tutorial, and the Exchange/trade screen.

---

## Deploying

The app is a standard Next.js project with no backend, no database and no
environment variables, so it deploys as-is.

**Vercel (via GitHub):**

1. <https://vercel.com/new> → import `agresh-agrawal8/kryonis`.
2. Accept the detected settings. Framework is Next.js; build is `next build`;
   there is nothing to configure and no environment variables to set.
3. Deploy. Every push to `master` then redeploys automatically.

**Custom domain:**

1. In the Vercel project → Settings → Domains, add the hostname.
2. Vercel will show a DNS record to create. For a subdomain this is a `CNAME`
   pointing at `cname.vercel-dns.com`.
3. Add that record at whoever hosts DNS for the apex domain. Propagation is
   usually minutes; Vercel issues the TLS certificate on its own once the
   record resolves.

Node 20+ is required at build time.

---

## Licence

MIT — see [LICENSE](LICENSE).

Third-party models under `public/models` retain their original licences; see
`KRYONIS_ASSET_SHOPPING_LIST.md` for sourcing notes.
