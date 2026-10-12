import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * One place that derives "what should be visible" from scroll POSITION.
 *
 * THE BUG THIS EXISTS FOR: every entrance on the site is a `once` ScrollTrigger,
 * which fires when its start line is CROSSED. Land past that line without
 * crossing it — an anchor, a hash on cold load, a footer link, any programmatic
 * scrollTo — and it never fires, so the section you were sent to renders blank.
 * Measured on production: landing on #locations left the rows at opacity 0 and
 * visibility hidden while fully on screen.
 *
 * THE FIX IS A CATCH-UP PASS, NOT A CONVERSION. The reveals stay once-based and
 * animate exactly as before when you scroll into them normally. All that is new
 * is this: after any jump, anything whose start is already at or above us is
 * snapped to its end state with gsap.set — no tween — and its trigger is killed
 * so it can never fire a second time.
 *
 * It is centralised because the per-section version of this is how the drift
 * started: each reveal that grows its own catch-up is one more place to forget.
 * Anything with position-derived state registers here, including the header,
 * so there is a single pass rather than several racing each other.
 */

/** Registered entrance reveals. */
const reveals = [];
/** Other position-derived state (the header bar), run by the same pass. */
const syncers = [];

/* The resting value for every property an entrance animates FROM. A `from`
   tween's end state is simply the element's natural state, so this is the whole
   vocabulary — if a reveal ever animates something new, add it here. */
const RESTING = { autoAlpha: 1, y: 0, x: 0, yPercent: 0, xPercent: 0, scale: 1, rotate: 0 };

/**
 * Declare an entrance. Returns the entry, or null when nothing matched.
 *
 * Under reduced motion the end state is set immediately and nothing is
 * registered — there is no animation to catch up with.
 */
export function reveal({
  targets,
  from,
  trigger = null,
  start = 'top 88%',
  duration = 0.9,
  ease = 'brand',
  stagger = 0,
  reducedMotion = false,
  id = '',
} = {}) {
  const els = gsap.utils.toArray(targets);
  /* Silently no-op on an empty match rather than handing GSAP a target it will
     warn about. `.footer__mark` matched nothing for a long time and did exactly
     that on every load. */
  if (!els.length) return null;

  const endState = {};
  for (const k of Object.keys(from)) if (k in RESTING) endState[k] = RESTING[k];

  if (reducedMotion) {
    gsap.set(els, endState);
    return null;
  }

  const tween = gsap.from(els, {
    ...from,
    duration,
    ease,
    stagger,
    scrollTrigger: { trigger: trigger || els[0], start, once: true },
  });

  const entry = { id, els, endState, tween, done: false };
  reveals.push(entry);
  return entry;
}

/** Register any other state that must be derived from scroll position. */
export function registerPositionSync(fn) {
  if (typeof fn === 'function') syncers.push(fn);
}

/**
 * The single pass. Anything already scrolled past is snapped to its end state.
 *
 * `measure` forces a ScrollTrigger.refresh() first, which is needed whenever
 * layout may have changed under us (load, hashchange) because a trigger's
 * `start` is a cached pixel value. The debounced scroll path skips it: starts
 * are already current there, and refreshing on every scroll settle would be
 * wasteful and would fight the pin.
 */
export function syncFromScrollPosition({ measure = false } = {}) {
  if (measure) ScrollTrigger.refresh();
  const y = window.scrollY;

  for (const r of reveals) {
    if (r.done) continue;
    const st = r.tween?.scrollTrigger;
    if (!st) continue;
    if (y >= st.start) {
      /* Kill BEFORE setting: a live trigger on a `once` tween can still write
         the from-state on its next update and undo what we just set. */
      st.kill();
      gsap.set(r.els, r.endState);
      r.done = true;
    }
  }

  for (const fn of syncers) {
    try { fn(); } catch (err) { console.warn('[em] position sync failed', err); }
  }
}

/**
 * Wire the catch-up to every way a jump can happen.
 *
 * hashchange covers anchors and the banner/footer links; popstate covers back
 * and forward. The debounced scroll listener is the universal net for a
 * programmatic scrollTo, which fires no navigation event at all — it costs one
 * timer per scroll burst and, during ordinary scrolling, finds nothing to do
 * because each reveal has already fired on its own trigger by the time we pass
 * it.
 */
export function armRevealSync() {
  const soon = (opts) => requestAnimationFrame(() => requestAnimationFrame(() => syncFromScrollPosition(opts)));

  soon({ measure: true });
  window.addEventListener('load', () => soon({ measure: true }));
  window.addEventListener('hashchange', () => soon({ measure: true }));
  window.addEventListener('popstate', () => soon({ measure: true }));
  /* Same-page anchor clicks do not always fire hashchange — clicking a link to
     the hash you are already on fires nothing — so catch the click too. */
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[href*="#"]')) setTimeout(() => syncFromScrollPosition({ measure: true }), 120);
  });

  let t = 0;
  window.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => syncFromScrollPosition(), 140);
  }, { passive: true });

  document.fonts?.ready.then(() => soon({ measure: true }));
}
