import { MENU_CATEGORIES } from './menu-data.js';
import { LOCATIONS } from './locations.js';
import { mountBanner, extendFooter } from './credibility.js';
import { paintLogos } from './logo.js';
import { buildHeader } from './motion.js';

/**
 * The full menu page. Typographic, image-first, no 3D — it is the reference
 * list, while the homepage carousel is the showcase.
 */

/** The clover mark, inline so the placeholder can tint it via currentColor. */
const CLOVER = `<svg viewBox="12 132 117 114" fill="currentColor" aria-hidden="true">
  <path d="m100.9 164.4c-1.5 0-2.72 0.06-3.18 0.22 1.09-9.44-6.54-30.65-25.08-30.65-14.67 0-28.57 11.83-28.93 29.65-0.02 0.63 0.03 1.24 0.07 1.84-15.46-0.38-30.26 10.19-30.26 25.09 0 13.19 11.75 24.61 26.16 24.61 2.24 0 3.97-0.28 5.15-0.57-3.46 11.64 7.16 30.38 24.9 30.38 14.94 0 28.04-13.19 28.04-29.24 0-15.34-10.59-27.7-22.95-36.74 13.1 6.65 25.05 19.01 25.69 36.01 14.26-0.31 26.09-12.51 26.09-25.71 0-13.73-11.57-24.89-25.7-24.89z"/>
</svg>`;

/** First letters of the first two words — "Banana Toffee Latte" -> "BT". */
const initialsOf = (name) =>
  name
    .replace(/[—–-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0])
    .join('')
    .toUpperCase();

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * DrinkImage — the one place an item's image zone is decided.
 *
 * A real photo when the item has one; otherwise a DESIGNED placeholder built
 * from the category tint: a flat wash, the clover at low opacity, and the
 * item's initials. Deliberately not a grey box — an empty state that looks
 * considered reads as "photo coming", not as "broken".
 */
function DrinkImage(item, category) {
  if (item.img) {
    return `<div class="mcard__media">
        <!-- Explicit dimensions for the same reason as everywhere else: a lazy
             image with no intrinsic size contributes zero height until it
             decodes, and a grid of them reflows as each one lands. Same
             1000x1250 cut-out frame as the carousel. -->
        <img class="mcard__photo" src="${esc(item.img)}" alt="${esc(item.name)}"
             width="1000" height="1250" loading="lazy" decoding="async" />
        ${item.soldOut ? '<span class="mcard__sold">Sold out</span>' : ''}
      </div>`;
  }
  return `<div class="mcard__media mcard__media--placeholder" style="--tint:${category.tint}">
      <span class="mcard__clover">${CLOVER}</span>
      <span class="mcard__initials">${esc(initialsOf(item.name))}</span>
      ${item.soldOut ? '<span class="mcard__sold">Sold out</span>' : ''}
    </div>`;
}

function Card(item, category) {
  return `<li class="mcard${item.soldOut ? ' is-sold-out' : ''}">
      ${item.badge ? `<span class="mcard__badge">${esc(item.badge)}</span>` : ''}
      ${DrinkImage(item, category)}
      <div class="mcard__body">
        <h3 class="mcard__name">${esc(item.name)}</h3>
        ${item.note ? `<p class="mcard__note">${esc(item.note)}</p>` : ''}
        <p class="mcard__price" aria-label="Price to be confirmed">$—</p>
      </div>
    </li>`;
}

function render() {
  const bar = document.getElementById('menu-jump');
  const wrap = document.getElementById('menu-categories');
  if (!bar || !wrap) return;

  bar.innerHTML = MENU_CATEGORIES.map(
    (c) => `<li><a class="jump__link" href="#${c.id}" data-cat="${c.id}">${esc(c.name)}</a></li>`
  ).join('');

  wrap.innerHTML = MENU_CATEGORIES.map(
    (c) => `<section class="mcat" id="${c.id}">
      <header class="mcat__head">
        <h2 class="mcat__name">${esc(c.name)}</h2>
        ${c.aside ? `<span class="mcat__aside">${esc(c.aside)}</span>` : ''}
      </header>
      <ul class="mcat__grid">${c.items.map((i) => Card(i, c)).join('')}</ul>
    </section>`
  ).join('');

  /* Underline follows the category you are actually reading. rootMargin pins
     the trigger line just under the sticky bar, so a heading counts as current
     the moment it clears it rather than when it reaches the middle. */
  const links = new Map([...bar.querySelectorAll('.jump__link')].map((a) => [a.dataset.cat, a]));
  const spy = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e) => {
          links.forEach((a) => a.classList.remove('is-active'));
          links.get(e.target.id)?.classList.add('is-active');
        });
    },
    { rootMargin: '-18% 0px -74% 0px' }
  );
  wrap.querySelectorAll('.mcat').forEach((s) => spy.observe(s));
}

function renderFooterLocations() {
  const list = document.getElementById('footer-locations');
  if (!list) return;
  list.innerHTML = LOCATIONS.map(
    (loc) => `<li><a class="footer__link" href="/#locations">${esc(loc.name)}</a></li>`
  ).join('');
}

/**
 * Publish the sticky jump bar's real height, and stop the global scroll-padding
 * from double-counting.
 *
 * The bar's height is not knowable from CSS: it depends on the link font's
 * metrics and on whether the row wraps at narrow widths. `.mcat`'s
 * scroll-margin-top consumes this so a jumped-to heading clears BOTH bars
 * exactly, at any viewport.
 *
 * scroll-padding-top is zeroed because it COMPOSES with scroll-margin-top — the
 * target is aligned to the padded edge and then outset by the margin — so the
 * stylesheet's global 5rem would send every jump 80px past where it belongs.
 */
function syncStickyOffsets() {
  const bar = document.querySelector('.jump');
  if (!bar) return;
  const apply = () =>
    document.documentElement.style.setProperty(
      '--jump-h',
      Math.round(bar.getBoundingClientRect().height) + 'px'
    );
  document.documentElement.style.scrollPaddingTop = '0px';
  apply();
  // The bar rewraps with the viewport, so the measurement has to follow it.
  if ('ResizeObserver' in window) new ResizeObserver(apply).observe(bar);
  else window.addEventListener('resize', apply, { passive: true });
}

/* Banner first, for the same reason as on the homepage: it publishes
   --banner-h, and this page's sticky category bar pins at var(--nav-h), which is
   written against it. Mounted before the header so nothing measures a stale
   offset. syncStickyOffsets re-runs on its resize callback. */
mountBanner({ onResize: () => syncStickyOffsets() });

/* No hero on this page, so there is nothing for the bar to be transparent
   over — buildHeader pins the scrolled state and wires the clover. */
buildHeader({ reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
paintLogos();
render();
renderFooterLocations();
syncStickyOffsets();
extendFooter();
