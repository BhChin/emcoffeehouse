// Single source of truth for palette + copy. The CSS holds the same colour
// values as custom properties; these are here because the WebGL cup can't read
// CSS variables, and the two must not drift.
/* Drink colourways — data only; one plane renders all of them by cross-fading
   textures. `lid` fills the swatch chip in the switcher UI.
 *
 * `img` is the product photo for that drink. Only /drink.png exists today, so
 * the others fall back to it (see DRINK_FALLBACK). Drop a matching cut-out PNG
 * at each path and it lights up with no code change.
 *
 * plate/ink retune the page palette. DEFAULT_COLORWAY below equals the
 * stylesheet values, so the page looks untouched at rest. */
export const DRINK_FALLBACK = '/drink.png';

/* Which colourway the page opens on. Declared by id rather than by moving an
   entry to the front of COLORWAYS: the array is also the switcher's running
   order, and 'house' is the shop's own drink, so it should keep its place in
   the row even when it is not what loads first.
   NOTE: :root in style.css and the theme-color meta tag are the SAME palette,
   hard-coded, because they have to be right before any JS runs. Change this id
   and those two must move with it or the page flashes the old plate colour. */
export const DEFAULT_COLORWAY = 'matcha';

/** The colourway the page opens on, falling back to the first if the id is stale. */
export const defaultColorway = () =>
  COLORWAYS.find((w) => w.id === DEFAULT_COLORWAY) || COLORWAYS[0];

/* `swatch` fills the chip. `mask` marks the liquid interior that may ripple —
   it differs per drink because each has its own foam/ice line, so it travels
   with the photo. Both `img` and `mask` fall back if a file is missing. */
export const COLORWAYS = [
  {
    id: 'house', label: 'House', img: '/drink.png', mask: '/drink-liquid-mask.png',
    swatch: '#C2452B', plate: '#F8EDDA', ink: '#1D4A42',
  },
  {
    id: 'suada', label: 'Cà Phê Sữa Đá', img: '/drink-suada.png', mask: '/drink-suada-liquid-mask.png',
    swatch: '#A9702F', plate: '#F6EADA', ink: '#3A2A1A',
  },
  {
    id: 'egg', label: 'Egg Coffee', img: '/drink-egg.png', mask: '/drink-egg-liquid-mask.png',
    swatch: '#E0A81E', plate: '#FAF0D6', ink: '#4A3410',
  },
  {
    id: 'matcha', label: 'Coconut Matcha', img: '/drink-matcha.png', mask: '/drink-matcha-liquid-mask.png',
    swatch: '#6FA53C', plate: '#EFF1E4', ink: '#05435A',
  },
  {
    id: 'muoi', label: 'Cà Phê Muối', img: '/drink-muoi.png', mask: '/drink-muoi-liquid-mask.png',
    swatch: '#8C5A2B', plate: '#F3E6D2', ink: '#3B2414',
  },
];

export const PALETTE = {
  cream: '#F3E8D8',
  // "teal" is the historical name; the current brand ink is a deep spruce
  // green. It drives the cup lid + the logo on the wrap texture.
  teal: '#1D4A42',
  gold: '#C68F45',
  // Warm brown-gray, not green: a cool shadow on a warm cream reads as a stain.
  shadow: 'rgba(92, 72, 46, 0.18)',
};

// NOTE: the drink names carry Vietnamese precomposed glyphs (ữ ạ ỉ ố ế). Neither
// DM Sans nor Poppins ships a `vietnamese` subset on Google Fonts — Fraunces
// does. That's why names are set in the serif and notes stay in the sans. If you
// ever move a name into the sans face, check it doesn't render as tofu first.
/* `theme` names a COLORWAYS entry, and every visual resolves from it: the
   carousel photo, the section background tint, and the accent. One source of
   truth, so retinting a drink means editing COLORWAYS and nothing else.

   TODO: Bạc Xỉu has neither a photo nor a colourway of its own. It currently
   borrows 'house', whose art is the fruity red highball — visibly the wrong
   drink for a milky iced coffee. It needs its own shot and palette entry.

   `feature` is unused by the carousel; kept because it still marks the house
   signature for any non-carousel rendering. */
export const MENU_ITEMS = [
  {
    name: 'Cà Phê Sữa Đá',
    feature: true,
    theme: 'suada',
    note: 'Dark roast robusta, slow-dripped over sweetened condensed milk, poured long over ice.',
    price: '6',
  },
  {
    name: 'Egg Coffee',
    theme: 'egg',
    note: 'Whipped yolk custard, warm and meringue-soft, floated on a short dark brew.',
    price: '7',
  },
  {
    name: 'Bạc Xỉu',
    theme: 'house', // TODO: no Bạc Xỉu photo or colourway exists — see note above
    note: 'Steamed milk first, coffee second — the gentle one, the way it is ordered at home.',
    price: '6',
  },
  {
    name: 'Super Coconut Matcha',
    theme: 'matcha',
    note: 'Ceremonial matcha whisked into coconut cream. Grassy, round, barely sweet.',
    price: '7',
  },
  {
    name: 'Cà Phê Muối',
    theme: 'muoi',
    note: 'Salted cream foam settling slowly through Vietnamese drip. Huế by way of here.',
    price: '6',
  },
];

/* LOCATIONS moved to src/locations.js — it now carries hours, photos, maps
   links and ordering URLs, and the Locations section renders entirely from it. */

// Read once per call rather than cached: the OS-level setting can flip while the
// page is open, and the listener in main.js re-queries on change.
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Scaffold only — PLACEHOLDER items throughout. Replace the rows with the real
   menu; the shape (name, price, optional note) is all the page needs. */
export const FULL_MENU = [
  {
    name: 'Cà Phê',
    items: [
      { name: 'Cà Phê Sữa Đá', price: '6', note: 'Robusta over condensed milk, long over ice.' },
      { name: 'Cà Phê Đen', price: '5', note: 'Phin-dripped, black, no sugar.' },
      { name: 'Bạc Xỉu', price: '6', note: 'Milk first, coffee second.' },
      { name: 'Cà Phê Muối', price: '6', note: 'Salted cream foam, Huế style.' },
      { name: 'Egg Coffee', price: '7', note: 'Whipped yolk custard over a short brew.' },
      { name: 'Cà Phê Dừa', price: '7', note: 'Coconut cream, blended.' },
    ],
  },
  {
    name: 'Espresso Bar',
    items: [
      { name: 'Espresso', price: '3.5' },
      { name: 'Americano', price: '4' },
      { name: 'Cortado', price: '4.5' },
      { name: 'Cappuccino', price: '5' },
      { name: 'Latte', price: '5.5', note: 'Vanilla, caramel or lavender.' },
      { name: 'Mocha', price: '6' },
    ],
  },
  {
    name: 'Matcha & Tea',
    items: [
      { name: 'Super Coconut Matcha', price: '7', note: 'Ceremonial matcha, coconut cream.' },
      { name: 'Matcha Latte', price: '6' },
      { name: 'Hojicha Latte', price: '6' },
      { name: 'Thai Tea', price: '5.5' },
      { name: 'Jasmine Green', price: '4.5' },
      { name: 'Lotus Tea', price: '5' },
    ],
  },
  {
    name: 'Smoothies & Refreshers',
    items: [
      { name: 'Avocado Smoothie', price: '7', note: 'Sinh tố bơ — thick, barely sweet.' },
      { name: 'Mango Smoothie', price: '6.5' },
      { name: 'Passionfruit Refresher', price: '6' },
      { name: 'Lemongrass Limeade', price: '5.5' },
      { name: 'Coconut Water', price: '5' },
    ],
  },
  {
    name: 'Pastries & Bites',
    items: [
      { name: 'Bánh Mì Pâté', price: '8' },
      { name: 'Croissant', price: '4' },
      { name: 'Pandan Waffle', price: '5' },
      { name: 'Bánh Bò Nướng', price: '5', note: 'Honeycomb cake, pandan.' },
      { name: 'Egg Tart', price: '4.5' },
    ],
  },
];
