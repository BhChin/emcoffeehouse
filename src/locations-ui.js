import gsap from 'gsap';
import { LOCATIONS, byMetro, activeMetros } from './locations.js';
import { image } from './media.js';

/**
 * The Locations section: editorial rows that expand in place.
 *
 * The collapsed row is unchanged from the flat list it replaces — big condensed
 * name, street address, arrow — because that row was the part worth keeping. All
 * the new material lives in a panel underneath it.
 *
 * ROWS ARE BUTTONS, not links. They were anchors straight to Google Maps before,
 * and an anchor that expands a panel instead of navigating is a lie to anyone on
 * a keyboard or a screen reader. The maps link still exists, inside the panel,
 * where it is one honest link among several.
 *
 * ONE OPEN AT A TIME. Five panels open at once turns a scannable list into a
 * wall; closing the previous one keeps the section's height predictable and the
 * comparison between doors easy.
 */

const DUR = 0.45;
const EASE = 'power3.inOut';

/** Hours as a definition list — days and times are pairs, so mark them up as pairs. */
const hoursBlock = (hours) => `
  <dl class="locpanel__hours">
    ${hours
      .map(
        (h) => `<div class="locpanel__hrow">
        <dt>${h.days}</dt><dd>${h.time}</dd>
      </div>`
      )
      .join('')}
  </dl>`;

/**
 * The ordering slot.
 *
 * Rendered in both states from the same config field so that dropping a real URL
 * into locations.js swaps a disabled span for a live anchor with no other change.
 * The disabled state is a <span>, not a disabled <a> — there is no such thing as
 * a disabled anchor, and a tabbable link that goes nowhere is worse than none.
 */
const orderSlot = (loc) =>
  loc.orderUrl
    ? `<a class="locpanel__order" href="${loc.orderUrl}" target="_blank" rel="noopener">Order &rarr;</a>`
    : `<span class="locpanel__order is-disabled" aria-disabled="true">Order — coming soon</span>`;

const rowHtml = (loc, i) => `
  <li class="loc" data-loc="${loc.id}">
    <h3 class="loc__h">
      <button class="loc__row" type="button"
              id="loc-btn-${loc.id}"
              aria-expanded="false" aria-controls="loc-panel-${loc.id}">
        <span class="loc__city">${loc.name}</span>
        <span class="loc__address">${loc.address}</span>
        <span class="loc__arrow" aria-hidden="true">&rarr;</span>
      </button>
    </h3>
    <div class="locpanel" id="loc-panel-${loc.id}" role="region"
         aria-labelledby="loc-btn-${loc.id}" hidden>
      <div class="locpanel__in">
        <div class="locpanel__media">
          ${image({
            src: loc.photo,
            label: loc.photoLabel,
            alt: `Em Coffee House, ${loc.name}`,
            tint: i % 2 ? 'var(--amber)' : 'var(--sage)',
            ratio: '4 / 3',
            w: 800,
            h: 600,
          })}
        </div>
        <div class="locpanel__body">
          ${hoursBlock(loc.hours)}
          <div class="locpanel__links">
            <a class="locpanel__dir" href="${loc.mapsUrl}" target="_blank" rel="noopener"
               aria-label="Directions to Em Coffee House ${loc.name}. Opens Google Maps in a new tab.">Directions &rarr;</a>
            ${orderSlot(loc)}
          </div>
        </div>
      </div>
    </div>
  </li>`;

/** Rows grouped under small-caps metro dividers. */
function markup() {
  let i = 0;
  return activeMetros()
    .map((metro) => {
      const rows = byMetro(metro)
        .map((loc) => rowHtml(loc, i++))
        .join('');
      return `<li class="loc-metro" role="presentation"><span>${metro}</span></li>${rows}`;
    })
    .join('');
}

export function renderLocations({ reducedMotion = false } = {}) {
  const list = document.getElementById('locations-list');
  if (!list) return;
  list.innerHTML = markup();

  const panels = new Map();
  for (const loc of LOCATIONS) {
    const btn = list.querySelector(`#loc-btn-${loc.id}`);
    const panel = list.querySelector(`#loc-panel-${loc.id}`);
    if (btn && panel) panels.set(btn, panel);
  }

  let open = null;

  const close = (btn, animate = true) => {
    const panel = panels.get(btn);
    if (!panel) return;
    btn.setAttribute('aria-expanded', 'false');
    btn.closest('.loc')?.classList.remove('is-open');
    gsap.killTweensOf(panel);
    if (!animate || reducedMotion) {
      gsap.set(panel, { height: 0, autoAlpha: 0 });
      panel.hidden = true;
      return;
    }
    gsap.to(panel, {
      height: 0,
      autoAlpha: 0,
      duration: DUR,
      ease: EASE,
      onComplete: () => { panel.hidden = true; },
    });
  };

  const openRow = (btn) => {
    const panel = panels.get(btn);
    if (!panel) return;
    btn.setAttribute('aria-expanded', 'true');
    btn.closest('.loc')?.classList.add('is-open');
    panel.hidden = false;
    gsap.killTweensOf(panel);
    if (reducedMotion) {
      gsap.set(panel, { height: 'auto', autoAlpha: 1 });
      return;
    }
    /* Measured, not 'auto'. GSAP can tween to auto, but doing it explicitly here
       means the height is read once from the laid-out panel and the tween runs on
       a number — and it stays correct if the panel's contents (a placeholder that
       later becomes a photo) change size between opens. */
    gsap.fromTo(
      panel,
      { height: 0, autoAlpha: 0 },
      {
        height: () => panel.scrollHeight,
        autoAlpha: 1,
        duration: DUR,
        ease: EASE,
        /* Released to auto once open, so a resize or a late-decoding image
           cannot leave the panel clipped at a stale pixel height. */
        onComplete: () => gsap.set(panel, { height: 'auto' }),
      }
    );
  };

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.loc__row');
    if (!btn || !list.contains(btn)) return;
    if (open === btn) { close(btn); open = null; return; }
    if (open) close(open);
    openRow(btn);
    open = btn;
  });

  /* Enter and Space come free on a <button>; no key handler is needed and adding
     one would double-fire Space. The rows are buttons precisely so this works. */

  // Start collapsed without animating on first paint.
  for (const btn of panels.keys()) close(btn, false);
}
