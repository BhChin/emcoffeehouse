// Brand palette — dark and warm. No yellow anywhere.
export const PALETTE = {
  navy: '#14252F',   // room / background — deep espresso-navy
  orange: '#E8762C', // primary accent — burnt orange
  cream: '#F3E7D0',  // secondary — condensed-milk cream
  coffee: '#2B1A05', // the drink
  lamp: '#FFB877',   // pendant bulb warmth (light only, never a surface)
};

// Anton rather than Archivo Black: Archivo Black's static TTF is missing the
// Vietnamese precomposed glyphs this site is built on (ữ ạ ỉ ố ế), which would
// render the menu as tofu. Anton covers the full Vietnamese set.
export const FONTS = {
  grotesque: '/fonts/Anton-Regular.ttf',
  script: '/fonts/Pacifico-Regular.ttf',
};

// The room is one long box; every stop lives further down -Z.
// Camera never turns around, so we only dress the walls it can see.
export const ROOM = {
  width: 62,
  height: 34,
  depth: 190,
  centerZ: -55, // spans roughly z = +40 .. -150
};

// Each stop is a camera position + the point it looks at. Scroll interpolates
// between them; the nav pills jump straight to an index.
export const STOPS = [
  // The hero looks slightly down-scene so the wordmark sits high in frame and
  // leaves room for the phin underneath it.
  { id: 'hero', position: [0, 0.6, 27], target: [0, -1.4, 0] },
  { id: 'menu', position: [0, 0.2, -8], target: [0, 0.2, -30] },
  { id: 'about', position: [0, 0.2, -42], target: [0, 0.2, -64] },
  { id: 'locations', position: [0, 0.2, -76], target: [0, 0.2, -98] },
];

export const STOP_INDEX = Object.fromEntries(STOPS.map((s, i) => [s.id, i]));

export const MENU_ITEMS = [
  { name: 'Cà Phê Sữa Đá', note: 'phin-brewed, condensed milk, ice' },
  { name: 'Egg Coffee', note: 'whipped yolk custard, robusta' },
  { name: 'Bạc Xỉu', note: 'more milk than coffee, on purpose' },
  { name: 'Super Coconut Matcha', note: 'coconut cream, ceremonial matcha' },
  { name: 'Cà Phê Muối', note: 'salted cream, Huế-style' },
];

export const LOCATIONS = [
  { city: 'Mira Mesa', address: '8945 Mira Mesa Blvd, San Diego' },
  { city: 'Kearny Mesa', address: '8304 Clairemont Mesa Blvd, San Diego' },
  { city: 'Mission Valley', address: '1640 Camino Del Rio N, San Diego' },
  { city: 'Elk Grove', address: '7440 Laguna Blvd #111' },
  { city: 'San Jose', address: '979 Story' },
];

export const ABOUT_LINES = [
  'Em means sweetheart —',
  'this is our love letter to',
  'Vietnamese coffee culture',
];

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
