/**
 * The five doors, as data.
 *
 * Everything the Locations section renders comes from this array — the rows, the
 * metro dividers, the expanded panel, the maps links. Adding a sixth location is
 * an entry here and nothing else.
 *
 * `hours` is per-location even though all five currently keep the same schedule.
 * That is deliberate: the whole point of moving off a single global hours string
 * is that a shop can diverge (a Sunday close, a holiday, a late Friday) without
 * anyone having to restructure the section first. Copy HOURS_DEFAULT and edit the
 * one that changes.
 *
 * `orderUrl` is null until the real ordering links exist. The row renders the
 * slot either way — disabled and labelled "coming soon" while null, a live link
 * the moment a URL is dropped in — so no markup changes when they arrive.
 *
 * `photo` names the file the expanded panel wants. Null means the shared
 * placeholder in media.js stands in, labelled with that filename so whoever is
 * sourcing the photography can see exactly which shot each door is waiting for.
 */

/** The schedule every door currently keeps. Copy, don't reference, to diverge. */
const HOURS_DEFAULT = [
  { days: 'Mon — Thu', time: '7:00am — 8:00pm' },
  { days: 'Fri — Sat', time: '7:00am — 9:00pm' },
  { days: 'Sunday', time: '8:00am — 7:00pm' },
];

/** Metro display order. The dividers render in this sequence. */
export const METROS = ['San Diego', 'Sacramento', 'Bay Area'];

const mapsUrl = (address) =>
  `https://maps.google.com/?q=${encodeURIComponent(`Em Coffee House, ${address}`)}`;

export const LOCATIONS = [
  {
    id: 'miramesa',
    name: 'Mira Mesa',
    metro: 'San Diego',
    address: '8945 Mira Mesa Blvd, San Diego',
    photo: null, // loc-miramesa.jpg
    photoLabel: 'loc-miramesa.jpg',
    hours: HOURS_DEFAULT,
    orderUrl: null,
  },
  {
    id: 'kearnymesa',
    name: 'Kearny Mesa',
    metro: 'San Diego',
    address: '8304 Clairemont Mesa Blvd, San Diego',
    photo: null, // loc-kearnymesa.jpg
    photoLabel: 'loc-kearnymesa.jpg',
    hours: HOURS_DEFAULT,
    orderUrl: null,
  },
  {
    id: 'missionvalley',
    name: 'Mission Valley',
    metro: 'San Diego',
    address: '1640 Camino Del Rio N, San Diego',
    photo: null, // loc-missionvalley.jpg
    photoLabel: 'loc-missionvalley.jpg',
    hours: HOURS_DEFAULT,
    orderUrl: null,
  },
  {
    id: 'elkgrove',
    name: 'Elk Grove',
    metro: 'Sacramento',
    address: '7440 Laguna Blvd #111',
    photo: null, // loc-elkgrove.jpg
    photoLabel: 'loc-elkgrove.jpg',
    hours: HOURS_DEFAULT,
    orderUrl: null,
  },
  {
    id: 'sanjose',
    name: 'San Jose',
    metro: 'Bay Area',
    address: '979 Story Road #7096',
    photo: null, // loc-sanjose.jpg
    photoLabel: 'loc-sanjose.jpg',
    hours: HOURS_DEFAULT,
    orderUrl: null,
  },
].map((l) => ({ ...l, mapsUrl: mapsUrl(l.address) }));

/** The locations of one metro, in declaration order. */
export const byMetro = (metro) => LOCATIONS.filter((l) => l.metro === metro);

/** Metros that actually have a door, so an empty group can never render. */
export const activeMetros = () => METROS.filter((m) => byMetro(m).length > 0);
