import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { reveal, registerPositionSync } from './reveal.js';

gsap.registerPlugin(ScrollTrigger);

// The single brand curve, as a GSAP-readable string.
const EASE = 'cubic-bezier(0.65, 0, 0.15, 1)';
gsap.registerEase('brand', gsap.parseEase(EASE));

/**
 * Load-in: the three wordmark lines rise out of their masks one after another,
 * then the cup slides in from the right and overshoots slightly before settling.
 */
/* Every element the intro hides up front. Named once, so the failsafe below is
   guaranteed to reveal exactly the set that was hidden — the regression this
   guards against was .nav__logo holding `opacity:0; visibility:hidden`
   indefinitely because nothing ever ran against it. */
const INTRO_HIDDEN = ['.tagline', '.nav__logo', '.nav__mark', '.pills', '.hero__stamp'];

/**
 * Force every intro target visible, whatever happened to the timeline.
 *
 * clearProps rather than `autoAlpha: 1`: `.wm` is animated with a `from` tween,
 * so if that never ran it is still holding the tween's start values, and only
 * clearing the inline properties returns it to what the stylesheet says.
 * Idempotent — safe to call after a normal finish as well as from the guard.
 */
export function revealIntro() {
  gsap.set([...INTRO_HIDDEN, '.wm'], {
    clearProps: 'opacity,visibility,transform,translate,rotate,scale',
  });
  /* THE DRINK IS AN INTRO TARGET TOO, and leaving it out of this set is what
     made the hero render an empty cup stage on a cold cache.
     #cup and .cup-shadow rest at opacity 0 in the stylesheet purely so the
     entrance has something to fade up from, and the only thing that raises them
     is animateCupIn — which is invoked from an onCupIn callback scheduled about
     0.5s INTO the intro timeline. When the wall-clock failsafe kills that
     timeline (a 600KB GLB, two WebGL contexts and the font load can stall it
     past 2.4s on a cold cache, see playIntro), the callback never fires and the
     drink stays transparent forever. Everything else recovered because it was
     named here; the cup simply was not.
     autoAlpha, not clearProps: their opacity:0 comes from the STYLESHEET, so
     clearing inline props would leave them exactly as hidden as they were. */
  gsap.set('#cup, .cup-shadow', { autoAlpha: 1 });
}

export function playIntro({ onCupIn, onWrite, failsafeMs = 2400 } = {}) {
  // Hidden up front rather than inside the timeline, so there's no chance of a
  // frame painting them at full opacity before the first tick.
  gsap.set(INTRO_HIDDEN, {
    autoAlpha: 0,
  });

  const tl = gsap.timeline({ defaults: { ease: 'brand' } });

  // One tween per element per property. The script's resting rotate lives in
  // CSS on the OUTER span; GSAP only ever touches the inner one, so the two
  // transforms can't collide.
  // Absolute positions, not relative offsets: the write-on is driven by Vara
  // on its own clock, so the surrounding beats have to be pinned to a shared
  // timeline rather than chained off each other's durations.
  const EM_DUR = 0.4;
  const PAUSE = 0.12;
  const WRITE = 1.6;
  const writeStart = EM_DUR + PAUSE;
  const fadeIn = writeStart + WRITE - 0.3; // the writing's final 300ms

  tl.from('.wm', { yPercent: 40, autoAlpha: 0, duration: EM_DUR }, 0)
    .call(() => onWrite?.(), null, writeStart)
    .to(['.nav__logo', '.nav__mark', '.pills'], { autoAlpha: 1, duration: 0.3 }, fadeIn)
    .fromTo('.tagline', { y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3 }, fadeIn)
    .to('.hero__stamp', { autoAlpha: 1, duration: 0.3 }, fadeIn);

  // Cup rises alongside the writing so the hero fills in as one gesture.
  tl.call(() => onCupIn?.(), null, writeStart);

  /* ── the failsafe ────────────────────────────────────────────────────────
     A wall-clock deadline, deliberately on setTimeout rather than on the GSAP
     ticker or a rAF — the failure this exists for IS the ticker being starved,
     so a guard that rides the same clock would starve with it.

     The entrance is a TIME-based timeline that runs during the heaviest part of
     boot: a 600KB GLB parse, two WebGL contexts and five photo decodes. GSAP's
     default lagSmoothing(500, 33) then advances it by 33ms for any frame longer
     than half a second, so an 1.8s timeline can take many seconds of real time —
     the observed ~8s wordmark — and if a frame is long enough the fade-in that
     un-hides the header may not arrive at all.

     Rather than disable lagSmoothing (which would let the scrubbed scroll work
     jump on a stall), the deadline simply caps how long anything may stay
     hidden. It fires slightly after the timeline's own ~2.1s so a healthy load
     is untouched, and clears itself when the timeline finishes normally. */
  const guard = setTimeout(() => {
    tl.kill();
    revealIntro();
  }, failsafeMs);
  tl.eventCallback('onComplete', () => {
    clearTimeout(guard);
    revealIntro();
  });

  return tl;
}

/** Cup entrance — right-side slide with a soft overshoot, plus its shadow. */
export function animateCupIn(rig) {
  const tl = gsap.timeline();

  tl.fromTo(
    '#cup',
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: 0.5, ease: 'power2.out' },
    0
  );

  if (rig) {
    tl.fromTo(
      rig.position,
      { x: 4.6 },
      { x: 0, duration: 1.5, ease: 'back.out(1.25)' },
      0
    );
  }

  tl.fromTo(
    '.cup-shadow',
    { autoAlpha: 0, scale: 0.7 },
    { autoAlpha: 1, scale: 1, duration: 1.1, ease: 'brand' },
    0.25
  );

  return tl;
}

/** Everything below the fold. */
export function buildScrollScenes({ reducedMotion = false } = {}) {
  /* Every entrance here is declared through reveal() so it lands in the single
     catch-up registry — see reveal.js. Behaviour on a normal scroll is
     unchanged; what is new is that a JUMP past any of these still shows them. */
  reveal({
    id: 'section-heads',
    targets: '.section__head',
    from: { autoAlpha: 0, y: 34 },
    duration: 1,
    start: 'top 88%',
    reducedMotion,
  });

  // Location rows, staggered off the list rather than one trigger each.
  reveal({
    id: 'location-rows',
    targets: '.loc',
    trigger: '.locations',
    from: { autoAlpha: 0, y: 26 },
    duration: 0.8,
    stagger: 0.08,
    start: 'top 85%',
    reducedMotion,
  });

  reveal({
    id: 'footer-mark',
    targets: '.footer__mark',
    trigger: '.footer',
    from: { autoAlpha: 0, y: 50 },
    duration: 1.1,
    start: 'top 90%',
    reducedMotion,
  });
}
/**
 * ONE ticker for the whole page. GSAP already runs its own rAF loop for the
 * intro and every ScrollTrigger; a second independent loop for the drink beats
 * against it and the two alias into visible jitter. Everything rides this.
 *
 * @param {(timeSec: number, deltaMs: number) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onTick(fn) {
  gsap.ticker.add(fn);
  return () => gsap.ticker.remove(fn);
}

/** Web fonts change every measurement on the page; re-measure once they land. */
export function refreshOnFonts() {
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

/**
 * Header state, and the clover as a scroll-progress mark.
 *
 * The state flip is a ScrollTrigger on the hero's bottom edge, not a scroll
 * listener: the trigger already knows where the hero ends and recomputes it on
 * refresh, whereas a listener would have to measure the hero on every tick.
 * `toggleClass` means the transition itself stays in CSS, which is what lets
 * prefers-reduced-motion switch the states instantly without a JS branch.
 *
 * On a page with no hero (/menu) there is nothing to be transparent over, so the
 * caller pins the scrolled state instead of calling this.
 */
export function buildHeader({ reducedMotion = false } = {}) {
  const nav = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  const mark = document.querySelector('.nav__mark');
  if (!nav) return;

  if (hero) {
    /* Fires when the hero's bottom clears the BAR, not the top of the viewport.
       Those differ by the bar's height, and the gap matters: an anchor jump to
       #menu lands at (section top - scroll-padding), which is 80px above the
       hero's bottom, so a viewport-top threshold left the bar transparent with
       the menu filling the screen. Measured as a function so it re-derives when
       the bar compresses. */
    const threshold = () => nav.offsetHeight;
    ScrollTrigger.create({
      trigger: hero,
      start: () => 'bottom top+=' + threshold(),
      end: 'max',
      toggleClass: { targets: nav, className: 'is-scrolled' },
      invalidateOnRefresh: true,
    });

    /* toggleClass only fires when the trigger is CROSSED. Land deep in the page
       without crossing it — /#menu, /#locations, a restored scroll position, a
       back-navigation — and the class is simply never applied, leaving a
       transparent bar over mid-page content.

       So the state is also computed directly from where the page actually is.
       This is the authority on load; the trigger only handles crossings after. */
    const sync = () => {
      const heroBottom = hero.offsetTop + hero.offsetHeight;
      // Same rule as the trigger above, so the two can never disagree.
      nav.classList.toggle('is-scrolled', window.scrollY + threshold() >= heroBottom);
    };

    /* Ordered deliberately: refresh first so ScrollTrigger's own start/end are
       measured against the final layout, then read the position. Reading first
       would sample a scroll offset that the refresh could still move. */
    const resync = () => {
      ScrollTrigger.refresh();
      sync();
    };

    sync();
    /* A hash jump happens after this module runs, and the browser's own scroll
       restoration can land even later — hence both events, plus one settled
       frame for the layout the jump lands in. */
    /* Registered with the shared pass rather than keeping its own hashchange
       and load listeners: the header is position-derived state exactly like the
       reveals are, and two independent catch-ups racing each other is how the
       bar and the content disagreed after a jump. reveal.js calls this on load,
       hashchange, popstate, anchor clicks and scroll-settle. */
    registerPositionSync(sync);
    requestAnimationFrame(() => requestAnimationFrame(sync));
  } else {
    nav.classList.add('is-scrolled');
  }

  if (!mark) return;
  /* The clover turns once across the whole document. It lives in the header and
     is clipped to it, so it can never drift over page content the way it did as
     a free-floating element — the rotation is the only thing that moves.

     Scrubbed off document progress rather than tweened, so it reads as a
     position indicator rather than as decoration: park mid-page and it holds
     its angle. Under reduced motion it simply does not turn; the colour still
     changes with the header state, so the indicator is not the only signal. */
  if (reducedMotion) return;
  gsap.to(mark, {
    rotate: 360,
    ease: 'none',
    scrollTrigger: {
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.4,
      invalidateOnRefresh: true,
    },
  });
}


