import { MENU_ITEMS, LOCATIONS, prefersReducedMotion } from './config.js';
import { playIntro, animateCupIn, buildScrollScenes, refreshOnFonts } from './motion.js';

// Three.js is ~600 kB and drives one decorative element, while the page's
// actual star is the wordmark. Loading the cup as its own chunk lets the type
// reveal start immediately instead of waiting on the 3D bundle.
const cupModule = () => import('./cup.js');

const reducedMotion = prefersReducedMotion();

/* ── markup from data ─────────────────────────────────────────────────────
   Built here rather than hand-written in the HTML so the menu and locations
   have one source of truth in config.js. */

function renderCards() {
  const list = document.getElementById('cards');
  list.innerHTML = MENU_ITEMS.map(
    (item) => `
    <li class="card-slot">
      <article class="card">
        <h3 class="card__name">${item.name}</h3>
        <p class="card__note">${item.note}</p>
        <p class="card__price">$${item.price}</p>
      </article>
    </li>`
  ).join('');
}

function renderLocations() {
  const list = document.getElementById('locations-list');
  list.innerHTML = LOCATIONS.map(
    (loc) => `
    <li class="loc">
      <a class="loc__link" href="https://maps.google.com/?q=${encodeURIComponent(
        `Em Coffee House, ${loc.address}`
      )}" target="_blank" rel="noopener"
        aria-label="${loc.city} — ${loc.address}. Opens in Google Maps in a new tab.">
        <span class="loc__city">${loc.city}</span>
        <span class="loc__address">${loc.address}</span>
        <span class="loc__arrow" aria-hidden="true">&rarr;</span>
      </a>
    </li>`
  ).join('');
}

/** The CTA's glow trails the cursor a few px while hovered (CSS reads --glow-x). */
function wireButtonGlow() {
  const btn = document.querySelector('.btn-gold');
  if (!btn) return;
  btn.addEventListener('pointermove', (e) => {
    const r = btn.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2; // -1 … 1 across the pill
    btn.style.setProperty('--glow-x', `${(x * 6).toFixed(1)}px`);
  });
  btn.addEventListener('pointerleave', () => btn.style.setProperty('--glow-x', '0px'));
}

/** Clear the pre-animation hidden state on anything the intro would have faded in. */
function revealStatic() {
  document.querySelectorAll('#cup, .cup-shadow').forEach((el) => {
    el.style.opacity = '1';
    el.style.visibility = 'visible';
  });
}

/** No WebGL: swap the canvas for the flat mark, which the CSS floats instead. */
function cupFallback() {
  const stage = document.querySelector('.cup-stage');
  if (!stage) return;
  document.getElementById('cup')?.remove();
  stage.classList.add('cup-stage--flat');
  const img = document.createElement('img');
  img.className = 'cup-flat';
  img.src = '/em-logo.svg';
  img.alt = '';
  stage.prepend(img);
  // The cup's entrance tween owns the shadow's reveal and is never going to
  // run now, so un-hide it here or the mark floats over nothing.
  revealStatic();
}

async function boot() {
  renderCards();
  renderLocations();

  const canvas = document.getElementById('cup');
  const shadowInner = document.querySelector('.cup-shadow__i');

  // Kicked off but not awaited yet: the type reveal below must not wait on it.
  const cupReady = cupModule()
    .then((m) => m.createCup(canvas, { reducedMotion }))
    .catch((err) => {
      console.warn('[em] cup chunk failed to load', err);
      return null;
    });

  if (reducedMotion) {
    // Static everywhere: no timelines are built at all, so nothing is left
    // hidden by an un-run `from` tween.
    //
    // The cup and its shadow start at opacity 0 in CSS purely so the entrance
    // has something to fade up from, and that entrance never runs here. The
    // stylesheet's own reduced-motion block also restores them, but that is a
    // *separate* evaluation of the same preference — if the two ever disagree
    // the cup silently vanishes. Un-hiding them from the same flag that
    // skipped the animation keeps one source of truth.
    revealStatic();
  } else {
    // The cup enters when the timeline calls for it, or as soon as its chunk
    // lands if that's later — whichever way round, the type never stalls.
    playIntro({ onCupIn: () => cupReady.then((c) => (c ? animateCupIn(c.rig) : null)) });
    buildScrollScenes();
    refreshOnFonts();
    wireButtonGlow();
  }

  const cup = await cupReady;
  if (!cup) {
    cupFallback();
    return;
  }

  // ── frame loop ────────────────────────────────────────────────────────
  if (reducedMotion) {
    cup.step(0, 0);
  } else {
    const wordmark = document.querySelector('.wordmark');
    let last = performance.now();

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const elapsed = now / 1000;

      cup.step(dt, elapsed);

      // The cup module owns the pointer lerp; everything below reads the same
      // settled value so the whole hero moves as one system.
      const px = cup.pointer.x;
      const py = cup.pointer.y;

      // Shadow: bob tracking (tighter + fainter as the cup rises), plus a
      // few px of drift *opposite* the cup so the light source stays put.
      // Written to the inner element so it never collides with the entrance
      // tween, which owns the outer one.
      if (shadowInner) {
        const b = cup.bobNorm;
        shadowInner.style.transform =
          `translateX(${(-px * 8).toFixed(2)}px) scale(${(1 - b * 0.13).toFixed(4)})`;
        shadowInner.style.opacity = (1 - b * 0.22).toFixed(3);
      }

      // Headline parallax: 1–2px, drifting away from the cursor. Applied to
      // the h1, not the masked line inners, so it can't fight the intro tween.
      if (wordmark) {
        wordmark.style.transform = `translate(${(-px * 2).toFixed(2)}px, ${(-py * 1.5).toFixed(2)}px)`;
      }

      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  if (import.meta.env.DEV) {
    // Screenshots aren't reliable in the embedded preview, so expose a handle
    // that can step a frame deterministically and read pixels back.
    window.__em = { cup, canvas, reducedMotion };
  }
}

boot().catch((err) => {
  console.error('[em] boot failed', err);
  cupFallback();
});
