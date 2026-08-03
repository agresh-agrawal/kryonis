/**
 * The codex.
 *
 * KRYONIS is meant to be educational without ever feeling like a lesson, so
 * nothing here is ever pushed at the player. Entries unlock when you build the
 * thing they describe - at the exact moment you have demonstrated you care
 * about it - and then sit quietly in a panel until you choose to read them.
 *
 * Everything below is true. Where a figure is approximate it is written as
 * approximate, because a game that teaches wrong numbers confidently is worse
 * than one that teaches nothing.
 */

import type { BuildingId } from '../buildings/catalog';

export interface CodexEntry {
  id: string;
  title: string;
  /** Unlocked by completing this structure. */
  unlockedBy: BuildingId;
  category: 'Environment' | 'Life Support' | 'Power' | 'Industry' | 'People';
  body: string;
  /** The single fact worth remembering, surfaced as a pull-quote. */
  keyFact: string;
}

export const CODEX: CodexEntry[] = [
  {
    id: 'radiation',
    title: 'Why the Habitat Is Buried',
    unlockedBy: 'habitat',
    category: 'Environment',
    body: 'Mars has no global magnetic field and almost no atmosphere, so the surface receives roughly 40 to 50 times the radiation dose you would get at sea level on Earth. There is no clever shield that fixes this cheaply. What does work is mass: a few metres of regolith piled over a habitat absorbs most of it, and regolith is the one construction material already lying everywhere. That is why the domes here are bermed rather than gleaming.',
    keyFact: 'Regolith is the cheapest radiation shielding on the planet, and it is already there.',
  },
  {
    id: 'moxie',
    title: 'Breathing the Atmosphere',
    unlockedBy: 'oxygen',
    category: 'Life Support',
    body: 'The Martian atmosphere is about 95% carbon dioxide. Solid-oxide electrolysis splits that CO2 into oxygen and carbon monoxide, which means the air itself is an oxygen mine. This is not theoretical: the MOXIE instrument aboard the Perseverance rover ran 16 times between 2021 and 2023 and produced oxygen every time, at roughly the rate a small tree does. Scaling it is an engineering problem, not a scientific one.',
    keyFact: 'MOXIE made breathable oxygen from Martian air on the actual surface of Mars.',
  },
  {
    id: 'water',
    title: 'Ice Is Everywhere and Nowhere',
    unlockedBy: 'water',
    category: 'Life Support',
    body: 'There is a great deal of water on Mars, almost all of it frozen. Buried glaciers sit under the mid-latitudes and the poles hold enormous ice caps, but liquid water cannot persist on the surface: at 0.6% of Earth’s atmospheric pressure it boils and freezes at nearly the same temperature. Water here is dug up, not pumped, and it is simultaneously the drinking supply, the crop irrigation, the radiation shielding and the source of rocket propellant.',
    keyFact: 'Liquid water cannot exist on the Martian surface - it boils and freezes at once.',
  },
  {
    id: 'solar',
    title: 'A Dimmer Sun, and Dust',
    unlockedBy: 'solar',
    category: 'Power',
    body: 'Mars orbits about 1.5 times further from the Sun than Earth, so it receives roughly 43% of the sunlight. That is the easy problem. The hard one is dust: it settles on panels continuously and cuts output month by month. The Opportunity rover survived years longer than planned partly because passing gusts happened to clean its panels. A colony cannot plan around luck, which is why storm hardening and anti-static coatings matter more than raw panel area.',
    keyFact: 'Mars gets 43% of Earth’s sunlight - and dust steadily takes a share of what is left.',
  },
  {
    id: 'night',
    title: 'The Problem With Night',
    unlockedBy: 'battery',
    category: 'Power',
    body: 'A sol is 24 hours and 39 minutes, so roughly half of every one is dark. Solar output goes to zero, but life support does not get to take the night off - oxygen production, heating and pressure regulation all keep drawing. Every solar colony is really a storage colony: the panels decide how much you can bank, and the batteries decide whether you survive until morning.',
    keyFact: 'A solar colony is only as good as its ability to survive its own night.',
  },
  {
    id: 'reactor',
    title: 'Getting Rid of Heat',
    unlockedBy: 'reactor',
    category: 'Power',
    body: 'A fission reactor on Mars is mostly radiator. On Earth waste heat is dumped into air or water; the Martian atmosphere is far too thin to carry it away by convection, so heat has to be radiated as infrared from large panels. NASA’s Kilopower programme demonstrated a compact fission unit in 2018 that produced up to 10 kilowatts. Most of what you see around the core here is not the reactor - it is the machinery for throwing its waste heat at the sky.',
    keyFact: 'On Mars, rejecting waste heat is harder than generating the power.',
  },
  {
    id: 'crops',
    title: 'Growing Food in the Dark',
    unlockedBy: 'greenhouse',
    category: 'Life Support',
    body: 'Plants only use part of the visible spectrum, mostly red and blue, so lighting a greenhouse with white light wastes a large fraction of the power. Tuned LEDs and stacked trays make far better use of a scarce watt. Crops also scrub carbon dioxide and release oxygen, which means a greenhouse is partly life support and not only a farm. Martian soil is a separate problem: it contains perchlorates, which are toxic and must be washed out before anything is grown in it.',
    keyFact: 'Martian soil contains perchlorates - it has to be cleaned before it can grow food.',
  },
  {
    id: 'iron',
    title: 'Why Mars Is Red',
    unlockedBy: 'mine',
    category: 'Industry',
    body: 'The colour comes from iron oxide - rust - distributed through the dust across the entire planet. It is a nuisance and a resource at the same time. The dust is fine enough to work into seals and machinery, but that same iron content makes it strongly magnetic, so separating the useful fraction from the rest is unusually straightforward. The planet is red because it is, in a real sense, made of ore.',
    keyFact: 'Mars is red because it is covered in rust - and that rust is your iron supply.',
  },
  {
    id: 'concrete',
    title: 'Concrete Without Water',
    unlockedBy: 'factory',
    category: 'Industry',
    body: 'Ordinary concrete needs water to cure, and water is far too precious here to pour into foundations. The alternative is to sinter regolith - heat it until the grains fuse - using concentrated sunlight or electrical heating. The result is a dense structural material made from the ground you are standing on, needing no binder shipped from Earth. Sulphur-based concretes work too and can be melted and reused.',
    keyFact: 'Martian concrete is made by fusing soil with heat, not by mixing it with water.',
  },
  {
    id: 'sabatier',
    title: 'Making Fuel From Air',
    unlockedBy: 'fuelplant',
    category: 'Industry',
    body: 'The Sabatier reaction combines carbon dioxide with hydrogen to produce methane and water. Take the CO2 from the atmosphere and the hydrogen from your own water supply, and you can manufacture rocket propellant on the surface. This is the single idea that makes a return journey affordable: without it, every gram of fuel for the trip home would have to be carried from Earth, along with the fuel needed to carry that fuel.',
    keyFact: 'Making propellant on Mars is what makes coming home affordable.',
  },
  {
    id: 'delay',
    title: 'Nobody Is Coming to Help',
    unlockedBy: 'comms',
    category: 'People',
    body: 'A radio signal takes between about 3 and 22 minutes to travel one way between Earth and Mars, depending on where the planets are. There is no live conversation, no real-time guidance, and no possibility of talking a crew through an emergency as it happens. Anything urgent has to be decided locally. Launch windows open roughly every 26 months, so a colony that misses one waits over two years for the next resupply.',
    keyFact: 'Help is up to 22 light-minutes away, and resupply comes only every 26 months.',
  },
  {
    id: 'isolation',
    title: 'The Hazard Nobody Photographs',
    unlockedBy: 'atrium',
    category: 'People',
    body: 'NASA groups the risks of deep-space missions into categories, and one of them is simply isolation and confinement. Analogue studies in Antarctic stations and sealed habitats consistently find that crews come apart over cramped layouts, monotony and lack of privacy long before they fail on workload. Somewhere to stand under an open sky, even a glazed one, is not decoration. It is life support for the mind.',
    keyFact: 'Confinement, not workload, is what breaks long-duration crews.',
  },
];

/** Entries whose unlocking structure has been completed. */
export function unlockedCodex(completed: ReadonlySet<BuildingId>): CodexEntry[] {
  return CODEX.filter((entry) => completed.has(entry.unlockedBy));
}
