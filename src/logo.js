/**
 * Paints the brand mark into every [data-logo] slot.
 *
 * The asset already uses `fill="currentColor"`, but it was being loaded through
 * an <img>, and an <img> renders SVG in an isolated document — `currentColor`
 * there resolves against the SVG's own default, i.e. black. That is why the
 * mark was black in the nav and, because the nav is now permanently fixed, over
 * every section it floated across.
 *
 * Injecting the markup inline lets `currentColor` inherit from the slot, so one
 * file serves the ink nav and the cream footer. Fetched once and shared rather
 * than duplicated into each page's HTML — the file is 4.6 kB and there are four
 * placements across two pages.
 */
let pending;

export function paintLogos(root = document) {
  const slots = root.querySelectorAll('[data-logo]:empty');
  if (!slots.length) return Promise.resolve();
  pending ??= fetch('/em-logo.svg').then((r) => r.text());
  return pending
    .then((svg) => {
      slots.forEach((el) => {
        el.innerHTML = svg;
        // The asset carries its own width/height; the slot should drive size.
        const node = el.firstElementChild;
        if (node) {
          node.removeAttribute('width');
          node.removeAttribute('height');
          node.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }
      });
    })
    .catch(() => {});
}
