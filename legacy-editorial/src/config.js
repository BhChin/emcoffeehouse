// Single source of truth for palette + copy. The CSS holds the same colour
// values as custom properties; these are here because the WebGL cup can't read
// CSS variables, and the two must not drift.
export const PALETTE = {
  cream: '#F3E8D8',
  teal: '#083F4D',
  gold: '#B97824',
  // Warm brown-gray, not teal: a cool shadow on a warm cream reads as a stain.
  shadow: 'rgba(90, 70, 52, 0.18)',
};

// NOTE: the drink names carry Vietnamese precomposed glyphs (ữ ạ ỉ ố ế). Neither
// DM Sans nor Poppins ships a `vietnamese` subset on Google Fonts — Fraunces
// does. That's why names are set in the serif and notes stay in the sans. If you
// ever move a name into the sans face, check it doesn't render as tofu first.
export const MENU_ITEMS = [
  {
    name: 'Cà Phê Sữa Đá',
    note: 'Dark roast robusta, slow-dripped over sweetened condensed milk, poured long over ice.',
    price: '6',
  },
  {
    name: 'Egg Coffee',
    note: 'Whipped yolk custard, warm and meringue-soft, floated on a short dark brew.',
    price: '7',
  },
  {
    name: 'Bạc Xỉu',
    note: 'Steamed milk first, coffee second — the gentle one, the way it is ordered at home.',
    price: '6',
  },
  {
    name: 'Super Coconut Matcha',
    note: 'Ceremonial matcha whisked into coconut cream. Grassy, round, barely sweet.',
    price: '7',
  },
  {
    name: 'Cà Phê Muối',
    note: 'Salted cream foam settling slowly through Vietnamese drip. Huế by way of here.',
    price: '6',
  },
];

export const LOCATIONS = [
  { city: 'Mira Mesa', address: '8945 Mira Mesa Blvd, San Diego' },
  { city: 'Kearny Mesa', address: '8304 Clairemont Mesa Blvd, San Diego' },
  { city: 'Mission Valley', address: '1640 Camino Del Rio N, San Diego' },
  { city: 'Elk Grove', address: '7440 Laguna Blvd #111' },
  { city: 'San Jose', address: '979 Story Road #7096' },
];

// Read once per call rather than cached: the OS-level setting can flip while the
// page is open, and the listener in main.js re-queries on change.
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
