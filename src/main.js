import { MENU_ITEMS, COLORWAYS, defaultColorway, prefersReducedMotion } from './config.js';
import {
  playIntro,
  revealIntro,
  animateCupIn,
  buildScrollScenes,
  refreshOnFonts,
  onTick,
  buildHeader,
} from './motion.js';
import { mountHeroBean } from './hero-bean.js';
import { paintLogos } from './logo.js';
import { buildSections } from './sections.js';
import { renderLocations } from './locations-ui.js';
import { mountSweetheart } from './sweetheart.js';
import { mountHeroPlate } from './hero-plate.js';
import { buildDeck } from './deck.js';
import { mountBanner, mountRewards, extendFooter } from './credibility.js';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { armRevealSync } from './reveal.js';
/* The doors live in locations.js now, not config.js — the footer reads the same
   array the section does so the two can never list different shops. */
import { LOCATIONS } from './locations.js';

// Three.js is ~600 kB and drives one decorative element, while the page's
// actual star is the wordmark. Loading the drink as its own chunk lets the type
// reveal start immediately instead of waiting on the 3D bundle.
const cupModule = () => import('./drink.js');

const reducedMotion = prefersReducedMotion();

/* ── markup from data ─────────────────────────────────────────────────────
   Built here rather than hand-written in the HTML so the menu and locations
   have one source of truth in config.js. */

/** The footer city list — same LOCATIONS array, so the two can never diverge. */
function renderFooterLocations() {
  const list = document.getElementById('footer-locations');
  if (!list) return;
  list.innerHTML = LOCATIONS.map(
    (loc) => `<li><a class="footer__link" href="#locations">${loc.name}</a></li>`
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

const STIR_MS = 900;
// The palette hand-off. The brief asks for ~40% through, so the nav and the
// sections below recolour while the wavefront is still crossing the hero —
// it reads as the wave carrying the colour out of the canvas.
const PALETTE_HANDOFF_MS = STIR_MS * 0.4;

let washTimers = [];

/** Retune the page to a colourway. The CSS custom properties are registered
    with @property, so assigning them animates rather than snapping. */
/* The colourway target. NOT documentElement: writing the live pair at the root
   let a hero swatch retint the quote and the moments grid three screens away,
   which is the opposite of the rule that everything outside the hero derives
   from static tokens. Scoped here, --plate/--ink inherit through the hero only. */
const paletteHost = () => document.querySelector('.hero') || document.documentElement;

function applyPagePalette(way) {
  /* If the flat fallback is what is on screen, it is the thing that has to
     change when somebody taps a chip — the canvas underneath it is hidden. */
  const flat = document.querySelector('.cup-flat');
  if (flat && way?.img) {
    flat.onerror = () => { flat.onerror = null; flat.src = '/drink.png'; };
    flat.src = way.img;
  }
  const s = paletteHost().style;
  s.setProperty('--plate', way.plate);
  s.setProperty('--ink', way.ink);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', way.plate);
}

/** Snap a custom property without animating it. */
function withoutTransition(fn) {
  const root = document.documentElement;
  root.classList.add('wash-reset');
  fn();
  void root.offsetWidth; // flush, so removing the class can't replay the change
  root.classList.remove('wash-reset');
}

/**
 * The DOM half of the stir: a radial wash of the incoming plate colour,
 * expanding from the same point as the shader's wavefront.
 */
function stirPage(way, clientX, clientY) {
  const root = paletteHost();
  const page = document.querySelector('.hero');
  if (!page) return applyPagePalette(way);

  washTimers.forEach(clearTimeout);
  washTimers = [];

  const r = page.getBoundingClientRect();
  // Reach the furthest VIEWPORT corner, not the furthest corner of the box: the
  // hero is several viewports tall, and sizing to that makes the wave cross the
  // visible part in the first few percent of its travel.
  const maxR = Math.hypot(
    Math.max(clientX, window.innerWidth - clientX),
    Math.max(clientY, window.innerHeight - clientY)
  );

  // withoutTransition() flushes, so 0px is committed as the transition's base
  // before we set the target below. Doing the hand-off in a rAF callback
  // instead would silently no-op anywhere rAF is throttled or deferred.
  withoutTransition(() => {
    root.style.setProperty('--wash-color', way.plate);
    root.style.setProperty('--wash-x', `${clientX - r.left}px`);
    root.style.setProperty('--wash-y', `${clientY - r.top}px`);
    root.style.setProperty('--wash-r', '0px');
  });
  root.style.setProperty('--wash-r', `${Math.ceil(maxR)}px`);

  // Text/borders follow mid-wave; the plate itself is already being shown by
  // the wash, so it only needs to land underneath once the wave has passed.
  washTimers.push(
    setTimeout(() => {
      root.style.setProperty('--ink', way.ink);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', way.plate);
    }, PALETTE_HANDOFF_MS)
  );
  washTimers.push(
    setTimeout(() => {
      withoutTransition(() => {
        root.style.setProperty('--plate', way.plate);
        root.style.setProperty('--wash-r', '0px');
        root.style.setProperty('--wash-color', 'transparent');
      });
    }, STIR_MS)
  );
}

/**
 * Colourway previewer. Radiogroup pattern: one chip per colourway, roving
 * tabindex, arrow keys move-and-select. Only shown once the drink is live —
 * without WebGL there's nothing to preview.
 */
function wireColorways(cup) {
  const root = document.getElementById('colorways');
  if (!root || !cup) return;

  // Which chip the page opens on. Must agree with drink.js's initial texture
  // and with :root's plate/ink, or the switcher shows one drink selected while
  // the canvas renders another.
  const startIdx = Math.max(0, COLORWAYS.indexOf(defaultColorway()));

  root.innerHTML = COLORWAYS.map(
    (way, i) => `
    <button class="chip" role="radio" aria-checked="${i === startIdx}" tabindex="${i === startIdx ? 0 : -1}"
      data-idx="${i}">
      <span class="chip__dot" style="background:${way.swatch}"></span>
      <span class="chip__label">${way.label}</span>
    </button>`
  ).join('');

  const chips = [...root.querySelectorAll('.chip')];
  let active = startIdx;

  function select(idx, { focus = false, at = null } = {}) {
    idx = (idx + COLORWAYS.length) % COLORWAYS.length;
    if (idx === active && !focus) return;
    chips[active].setAttribute('aria-checked', 'false');
    chips[active].tabIndex = -1;
    active = idx;
    chips[active].setAttribute('aria-checked', 'true');
    chips[active].tabIndex = 0;
    if (focus) chips[active].focus();

    const way = COLORWAYS[active];

    // Keyboard selection has no pointer position, so the chip's own centre
    // becomes the ripple origin — the wave still starts where the user acted.
    const box = chips[active].getBoundingClientRect();
    const px = at?.x ?? box.left + box.width / 2;
    const py = at?.y ?? box.top + box.height / 2;

    if (reducedMotion) {
      cup.setColorway(way); // no origin => plain crossfade
      applyPagePalette(way);
      return;
    }

    // Origin in the canvas's UV space; v is flipped because texture space
    // starts bottom-left. Values outside 0..1 are fine and expected — the
    // chips sit outside the drink's canvas, so the wave enters from off-stage.
    const c = document.getElementById('cup');
    const cr = c.getBoundingClientRect();
    cup.setColorway(way, {
      x: (px - cr.left) / cr.width,
      y: 1 - (py - cr.top) / cr.height,
    });
    stirPage(way, px, py);
  }

  chips.forEach((chip) =>
    chip.addEventListener('click', (e) =>
      select(+chip.dataset.idx, {
        // detail === 0 for keyboard-activated clicks (Space/Enter).
        at: e.detail ? { x: e.clientX, y: e.clientY } : null,
      })
    )
  );
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(active + 1, { focus: true });
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(active - 1, { focus: true });
    else if (e.key === 'Home') select(0, { focus: true });
    else if (e.key === 'End') select(COLORWAYS.length - 1, { focus: true });
    else return;
    e.preventDefault();
  });

  root.hidden = false;
}

/** Clear the pre-animation hidden state on anything the intro would have faded in. */
function revealStatic() {
  document.querySelectorAll('#cup, .cup-shadow').forEach((el) => {
    el.style.opacity = '1';
    el.style.visibility = 'visible';
  });
}

/**
 * No WebGL, or the drink module never came back: mount the default colourway's
 * photo as a plain <img> so the hero still has a drink in it.
 *
 * Idempotent, because two paths reach it — the null return and the watchdog in
 * boot() — and a double-mount would stack two drinks in the stage.
 *
 * It used to drop in the logo mark. That was the honest fallback when this only
 * covered missing WebGL, but the failure it now also has to cover is "the module
 * hung", where the rest of the page is fine and the real photo is the right
 * thing to show.
 */
function cupFallback() {
  const stage = document.querySelector('.cup-stage');
  if (!stage || stage.querySelector('.cup-flat')) return;
  /* HIDDEN, not removed. A slow-but-alive module can still resolve after the
     watchdog has fired, and boot() puts the real drink back when it does — which
     it cannot do if the renderer's canvas has been detached from the document. */
  const canvas = document.getElementById('cup');
  if (canvas) canvas.style.display = 'none';
  stage.classList.add('cup-stage--flat');
  const img = document.createElement('img');
  img.className = 'cup-flat';
  const way = defaultColorway();
  img.src = way?.img || '/drink.png';
  // Not every colourway has its own cut-out yet; /drink.png always exists.
  img.onerror = () => { img.onerror = null; img.src = '/drink.png'; };
  img.alt = '';
  stage.prepend(img);
  // The cup's entrance tween owns the shadow's reveal and is never going to
  // run now, so un-hide it here or the mark floats over nothing.
  revealStatic();
}

/** How long after init to confirm the hero drink actually made it to screen. */
const CUP_VERIFY_MS = 2000;

/**
 * Load-time proof that the hero drink is REALLY on screen, not merely mounted.
 *
 * Note what this does NOT check: whether .cup-stage contains an <img>. It never
 * does on the happy path — the drink is a WebGL canvas (#cup) framed against
 * that box, and the only <img> in there is the flat fallback below. Asserting on
 * an <img> would fail forever on a perfectly healthy page.
 *
 * What actually goes wrong is subtler and was invisible to every earlier check:
 * the canvas mounts, sizes and renders correctly while sitting at opacity 0,
 * because its fade-in rides a callback inside the intro timeline that the
 * timeline's own failsafe can kill first. So this asserts on VISIBILITY —
 * laid out, opaque, and backed by a live GL context — and force-mounts the flat
 * drink if any of that is false.
 */
function verifyCupVisible() {
  const stage = document.querySelector('.cup-stage');
  if (!stage) return;
  const cv = document.getElementById('cup');
  const box = cv?.getBoundingClientRect();
  const gl = cv && (cv.getContext('webgl2') || cv.getContext('webgl'));
  const shown =
    !!cv &&
    cv.style.display !== 'none' &&
    !!box && box.width > 1 && box.height > 1 &&
    parseFloat(getComputedStyle(cv).opacity) > 0.01 &&
    !!gl && !gl.isContextLost();
  if (shown) return;
  console.warn(
    '[em] hero drink not visible ' + CUP_VERIFY_MS + 'ms after init — forcing the flat fallback.',
    { canvas: !!cv, box: box && [Math.round(box.width), Math.round(box.height)],
      opacity: cv && getComputedStyle(cv).opacity, glLost: gl ? gl.isContextLost() : 'no context' }
  );
  cupFallback();
}

async function boot() {
  /* Banner first: it publishes --banner-h, which the header and the /menu jump
     bar both offset against, so it has to exist before anything measures them. */
  mountBanner({ onResize: () => ScrollTrigger.refresh() });
  paintLogos();
  renderFooterLocations();
  renderLocations({ reducedMotion });
  extendFooter();

  const canvas = document.getElementById('cup');
  const shadowInner = document.querySelector('.cup-shadow__i');

  // Kicked off but not awaited yet: the type reveal below must not wait on it.
  const cupReady = cupModule()
    .then((m) => m.createDrink(canvas, { reducedMotion }))
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
    playIntro({
        // The cup enters when the timeline calls for it, or as soon as its
        // chunk lands if that's later — either way the type never stalls.
      onCupIn: () => cupReady.then((c) => (c ? animateCupIn(c.rig) : null)),
    });

    buildScrollScenes({ reducedMotion });
    refreshOnFonts();
    wireButtonGlow();
  }

  /* The header state, the clover progress mark and the quote reveal. Each takes
     reducedMotion itself rather than
     being skipped: the header must still change state (that is what stops
     content colliding with it) and the quote must still be readable — only the
     motion is dropped. */
  /* Guarded individually. These run in the same task as the intro, and a throw
     in any one of them would abort boot() before the entrance ever ran — which
     is precisely how the header ends up stuck at opacity 0 with no error the
     user can see, because the rejection surfaces on boot().catch far from here.
     Each is decorative; none is worth taking the page down for. */
  for (const [name, fn] of [
    ['header', buildHeader],
    ['moments', buildSections],
    ['deck', buildDeck],
    /* After 'moments': the rewards band anchors to the grid that builder makes. */
    ['rewards', mountRewards],
  ]) {
    try {
      fn({ reducedMotion });
    } catch (err) {
      console.warn(`[em] ${name} setup failed`, err);
    }
  }

  /* Armed AFTER every builder above has registered its reveals — the first
     catch-up pass runs immediately, so anything already scrolled past on a cold
     hash load is snapped visible before the user touches the wheel. */
  armRevealSync();

  /* Returns null under reduced motion — it declines to pin, load, or animate
     anything, so the hero behaves exactly as it did before the bean existed. */
  /* Built before the pin, and handed to it: the pin drives the beat, but under
     reduced motion the pin never exists and the reveal still has to paint its
     static end state. Mounting it here keeps that one call site. */
  /* Before the pin is built: hero-bean.js collects the furniture list at mount
     time, and the plate has to be in it to inherit the takeover fade. */
  mountHeroPlate({ reducedMotion });
  const reveal = mountSweetheart({ reducedMotion });
  const heroBean = mountHeroBean({ reducedMotion, reveal });


  /* Watchdog, same shape as the intro timeline's wall-clock failsafe.
     `cupReady` already catches a rejected import, but a promise that simply
     never settles — a chunk request left hanging by a flaky connection, a
     decode that never finishes — would park this await forever, and everything
     below it (colourways, the frame loop) would never run. Racing a timer means
     the worst case is the flat drink rather than an empty stage. */
  const CUP_BUDGET_MS = 3000;
  let timer;
  const cup = await Promise.race([
    cupReady,
    new Promise((r) => { timer = setTimeout(() => r(null), CUP_BUDGET_MS); }),
  ]);
  clearTimeout(timer);
  if (!cup) {
    cupFallback();
    /* If the module is merely SLOW rather than dead it may still resolve after
       the watchdog fired. Tear the placeholder back out and use the real thing
       rather than leaving a flat photo where an interactive drink is available. */
    cupReady.then((late) => {
      if (!late) return;
      document.querySelector('.cup-flat')?.remove();
      document.querySelector('.cup-stage')?.classList.remove('cup-stage--flat');
      const canvas = document.getElementById('cup');
      if (canvas) canvas.style.display = '';
      wireColorways(late);
    });
    return;
  }

  wireColorways(cup);
  setTimeout(verifyCupVisible, CUP_VERIFY_MS);

  // Tuning panel, dev-only and opt-in. Loaded dynamically so lil-gui never
  // reaches the production bundle. Bake the values you settle on into
  // the ripple uniform defaults in drink.js, then drop this.
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === '1') {
    import('./debug.js').then((m) => m.mountTuning(cup)).catch(() => {});
  }

  // ── frame loop ────────────────────────────────────────────────────────
  if (reducedMotion) {
    cup.step(0, 0);
  } else {
    const wordmark = document.querySelector('.wm');

    // Rides GSAP's ticker rather than a second rAF loop — see onTick().
    onTick((elapsed, deltaMs) => {
      const dt = Math.min(deltaMs / 1000, 0.05);

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
    });
  }

  if (import.meta.env.DEV) {
    // Screenshots aren't reliable in the embedded preview, so expose a handle
    // that can step a frame deterministically and read pixels back.
    window.__em = { cup, canvas, reducedMotion, heroBean };
  }
}

boot().catch((err) => {
  console.error('[em] boot failed', err);
  cupFallback();
  /* Last resort. If boot threw between playIntro's gsap.set and its timeline
     completing, the header and tagline are sitting at autoAlpha 0 with nothing
     left alive to raise them — cupFallback only handles the drink. */
  revealIntro();
});

/* And a floor under all of it, including the case boot() never settles at all:
   a hung dynamic import, or a promise nobody chained. Neither the timeline's own
   guard nor boot().catch covers that, because both presuppose that the code
   installing them actually ran.

   Longer than the intro's internal 2.4s failsafe on purpose, so it is a backstop
   rather than a second deadline racing the first. */
setTimeout(revealIntro, 3000);
