import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { REVEAL_SVH, REVEAL_BUDGET } from './sweetheart.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * The hero takeover.
 *
 * A single scrubbed progress value drives the story: the bean arrives and clears
 * the stage; chapter zero and three chapters scroll past while it holds centre;
 * the tumble then decelerates to rest through chapter 3, which stays on screen
 * beside it. That is the end of the story — there is no exit animation.
 *
 * THERE IS NO TRANSITION. The stage is `position: sticky`, so the browser holds
 * it for the length of the story; when the section runs out it scrolls away and
 * the menu follows in ordinary flow. Nothing in this file fades, moves or
 * reveals the handoff.
 *
 * That is a decision, not an omission. A camera flyover, a drop, a bean-shaped
 * aperture, a hinged panel, a sliding cover and a crossfade all came before it,
 * and each was removed. If you are about to add another, the useful question is
 * whether the story needs a send-off at all — it ends on the bean at rest with
 * chapter 3 still up, which is already an ending.
 *
 * The story's descent is an ILLUSION and that is deliberate: the bean barely
 * moves during the chapters (~4vh over 70% of the scroll). What sells it is the
 * copy rising past a near-stationary object. Animating the bean downward as
 * well would cancel the relative motion out.
 *
 * THE CAMERA NEVER MOVES. It sat still through the story and then flew over the
 * bean in an earlier version of this file; that broke rig.visibleHalf(), whose
 * whole vh -> world mapping is valid only because "fov and camera distance are
 * fixed" (see bean.js). Every position here is expressed in vh through that
 * mapping, so moving the camera silently invalidated the units the rest of this
 * module is written in. Keep all motion on the bean.
 *
 * Everything stays fully OPAQUE throughout. The stage's own opacity is never
 * touched — only the chapters and the intro title fade, and only within the
 * story itself.
 */

/** How long to wait for the GLB before giving up and leaving scroll alone. */
const LOAD_BUDGET_MS = 3000;

// Phase boundaries.

/* THE BEAN'S ANIMATION IS NOT KEYED TO THE FULL SCRUB. Every number describing
   it used to be a fraction of the entire hero, so lengthening the hero for the
   title beat silently stretched the bean too: measured at 1440x900, the tumble
   went from one turn per 954px of scroll to one per 1380px, and the arrival
   moved from 544px into the page to 1656px. Nothing had been re-tuned — it was
   collateral damage from a height change. So the story runs on its own progress
   over its own slice of the scrub, and the constants below are the original
   whole-scrub numbers, unchanged. */
/* .hero's height in style.css MUST equal TOTAL_SVH + 100svh - 18px. The 100svh
   is one stage height: sticky travel is (height - stage height), so that term is
   what makes the sticky range equal the scrub. Change one, change the other. */
/* ── the front of the pin, in svh ────────────────────────────────────────
   Laid out so that consecutive beats OVERLAP rather than queue. Each one starts
   while its predecessor is still finishing, which is what removes the empty
   stretches: the old layout ran furniture-out, then a long nothing, then a title
   that held at full opacity for 91svh (~840px at 1440) while drifting 18vh — a
   near-freeze the reader had to scroll through.

     0  -> 22   furniture and the drink exit
     3  -> 39   the title rises (starts 3svh in — ~0.14 of the furniture's exit)
     39 -> 89   the title HOLDS at full opacity: 50svh, half a viewport
     89 -> 125  the title exits...
     92 -> 113  ...while the bean is already arriving, the same overlap again
     119 ->337  ...and the chapters begin under its last fading trace
     337->587   the sweetheart reveal

   Nowhere in that is there a stretch longer than 0.3 viewport with nothing
   moving, except the reveal's closing dwell, which is deliberate.

   WHY THE RAMPS ARE LONG (36svh each) WHILE THE HOLD IS SHORT (50svh):
   two requirements pull against each other here. The hold has to be about half a
   viewport, or the beat reads as a freeze — that was the complaint. But the
   title also has to survive being sampled every half viewport, and landing twice
   inside a window is only GUARANTEED when that window exceeds one full viewport.
   A 50svh hold is 0.54 of a viewport, so those two cannot both be met by the
   hold alone.

   Widening the ramps satisfies both without slowing anything down: the title is
   continuously MOVING and changing opacity through them, so they read as motion
   rather than dwell, while the span over which it is legible grows past a
   viewport. Full opacity stays at half a viewport; legibility spans 1.05. */
const FURNITURE_SVH = 22;
const TITLE_IN_SVH = 3;
const TITLE_RISE_SVH = 36;
const TITLE_HOLD_SVH = 50;
const TITLE_FALL_SVH = 36;
/* How far into the pin the bean's own clock starts. Chosen so its arrival
   (19% into the story) lands 3svh into the title's exit — the same overlap the
   title has with the furniture. */
const STORY_LEAD_SVH = 17;
const STORY_SVH = 320;
export const TOTAL_SVH = STORY_LEAD_SVH + STORY_SVH + REVEAL_SVH;
/** An svh position on the pin, as a fraction of the whole scrub. */
const at = (svh) => svh / TOTAL_SVH;

/** Where the bean's story begins and ends on the full scrub. */
const STORY_ORIGIN = at(STORY_LEAD_SVH);
const STORY_TAIL = at(STORY_SVH);
/** An original, whole-scrub constant expressed in the new p-space. */
const inStory = (v) => STORY_ORIGIN + v * STORY_TAIL;

/** The reveal owns everything after the story. */
const P_REVEAL_START = at(STORY_LEAD_SVH + STORY_SVH);
/** The clear phase's share of the reveal — kept in step with sweetheart.js. */
const REVEAL_CLEAR_FRAC = REVEAL_BUDGET.clear / REVEAL_SVH;

/* Furniture and drink are gone by here — and the takeover latch in build() uses
   the same figure, so what the scrub fades out is exactly what stays out. */
const P_CLEAR = at(FURNITURE_SVH);

const P_ARRIVE = inStory(0.19);
const P_TAKEOVER = inStory(0.30);
/* The chapters start just after P_TAKEOVER: chapter zero occupies everything
   before it, so the story begins once its title has cleared the frame. */
const P_STORY_START = inStory(0.32);
/* The three chapters divide [P_STORY_START, P_STORY_END].

   This used to be 1.0, when the story ran to the end of the scrub. It now ends
   where the reveal begins — the value is still "the whole story", it is just
   that the story is no longer the whole pin. */
const P_STORY_END = inStory(1.0);

/* Chapter zero — the intro title. Rises in as the stage finishes clearing and
   exits upward just as chapter 01 arrives, using the same travel as a chapter
   so the pattern (text moves, bean does not) is set before the story starts.
   Its slot deliberately overlaps the chapters' start: one is leaving as the
   next enters, which is what the chapters do to each other. */
/* The title band, derived from the svh layout above rather than hand-tuned as
   fractions of the scrub. That indirection is what let it drift out of shape:
   these were last set when the pin was 360svh, and the reveal later pushed the
   pin to 635 without them being re-derived — so a band written as 0.02->0.22
   silently grew from 72svh to 127svh, and its hold with it. Expressed in svh,
   the beat keeps its intended length whatever else is added to the pin. */
const TITLE_BAND_SVH = TITLE_RISE_SVH + TITLE_HOLD_SVH + TITLE_FALL_SVH;
const P_INTRO_IN = at(TITLE_IN_SVH);
const P_INTRO_OUT = at(TITLE_IN_SVH + TITLE_BAND_SVH);
const INTRO_FROM_VH = 14;
const INTRO_TO_VH = -14;
/* Separate ramps. They shared one hardcoded 0.22, so the fade-out could not be
   moved without also re-timing the entrance. The out ramp is now the shorter of
   the two, which holds the title at full strength longer and then lets it go —
   the beat reads as a linger rather than a slow dissolve. */
const INTRO_FADE_IN = TITLE_RISE_SVH / TITLE_BAND_SVH;
const INTRO_FADE_OUT = TITLE_FALL_SVH / TITLE_BAND_SVH;

/* ── the rest ──────────────────────────────────────────────────────────────
   Chapter 3 is where the journey ENDS. The bean decelerates to near-still and
   stays, and the chapter's copy stays with it rather than exiting upward like
   the other two — there is nothing after it to make room for. */
const SETTLE_S = 0.62;          // story-local, as it always was
const P_SETTLE = inStory(SETTLE_S); // ...and where that lands on the full scrub

/* The yaw at which the bean's SEAM runs vertically down the middle of the frame
   — measured off the render, not guessed. The settle decelerates into this so
   the journey ends on the bean's face.

   Without a target the settle simply slowed to a stop wherever the tumble
   happened to be, which was yaw 15.626 rad ≡ 3.06 — within a few degrees of
   dead-on backside. The back of this model is a smooth unbroken curve, so it
   read as a featureless blob rather than as a coffee bean. */
const CREASE_Y = 1.26;

// Bean size, in vh of height. The model is normalised to 1.0 on its long axis.
const BEAN_VH = 40;
const BEAN_VH_MOBILE = 30;

// Where the bean rests during the story, and how far it drifts across it.
const BEAN_CENTRE_VH = 48;
const BEAN_DRIFT_VH = 4;
const BEAN_CENTRE_VH_MOBILE = 30; // top-centre: the copy passes underneath

// Chapter travel: enters from below the fold, exits above it.
const CH_FROM_VH = 58;
const CH_TO_VH = -58;
/** Fade ramp at each end of a chapter's slot, as a fraction of that slot. */
const CH_FADE = 0.18;
/* A chapter must be fully transparent BEFORE its top edge reaches the nav.
   It used to fade over the last CH_FADE of its slot regardless of where it
   physically was, and at a 918px viewport the top edge crossed the nav band at
   q = 0.697 while the fade did not even begin until 0.82 — so the number and
   title collided with the nav buttons at full opacity. The exit is now clamped
   to a measured q instead (see measureChapterExits), with this much extra px of
   daylight so it clears rather than just touches. */
const NAV_CLEAR_PX = 6;

/* ── pointer response ──────────────────────────────────────────────────────
   The bean leans toward the cursor. Small numbers on purpose: this is a hint
   that the object is present in the room, not a toy to be swung around, and it
   has to survive being layered on top of a tumble that is already running.

   Tilt is applied to the OUTER group (rig.bean) while the story's tumble stays
   on the inner one (rig.spin), so the two compose instead of overwriting each
   other — the same split bean.js set up for exactly this reason. */
const TILT_Y = 0.30; // rad at full deflection, ~17 degrees
const TILT_X = 0.22; // rad, ~13 degrees
/* Banking. rotation.z is otherwise unused on this group, and rolling INTO the
   lean is what stops the yaw from reading as a flat turntable spin — it is the
   difference between a turning object and a leaning one. */
const PTR_ROLL = 0.10; // rad, ~6 degrees
/* Positional parallax, in vh. Kept SMALL relative to the rotation on purpose:
   rotation reads as the bean turning to face you, translation reads as it being
   dragged along behind the cursor. When the two were comparable the second one
   won, and the whole thing felt like a sticker being slid around. */
const PTR_SHIFT_VH = 1.1;

/* ── spring ────────────────────────────────────────────────────────────────
   The lean is a damped spring, not an exponential ease. Exponential smoothing
   (`1 - exp(-dt/tau)`) is monotonic: it approaches the target and stops dead,
   never overshooting, never settling. Nothing with mass moves like that, and it
   is the main reason this read as a puppet on a string rather than an object.

   Underdamped at 0.62, so it arrives with a small overshoot and settles — about
   7% past the mark, gone within ~0.4s. */
const PTR_OMEGA = 16.5; // rad/s, ~2.6Hz
const PTR_ZETA = 0.62; // damping ratio; 1.0 would be critically damped
/* The integrator is explicit Euler, which goes unstable if a frame is long
   enough for the spring to step past its own target. Substepping at a fixed
   small dt makes the motion identical at 30Hz, 60Hz and 144Hz. */
const PTR_STEP = 1 / 240;
/* Hit area, as a multiple of the bean's own projected radius. Slightly generous:
   an exact silhouette test makes a rounded, moving target feel broken at the
   edges, because the pointer is already off it by the time the eye says it is on. */
const HOVER_PAD = 1.18;
/* ── idle ──────────────────────────────────────────────────────────────────
   A slow drift so the bean is never completely dead, including once the story
   has finished and it is just sitting there.

   Three sines on DELIBERATELY unrelated periods. Matched periods would relock
   into one obvious cycle every few seconds and read as a loop; primes-ish ones
   drift against each other so the motion never repeats visibly.

   These ADD to the pointer's lean on the outer group, which itself adds to the
   story's tumble on the inner one. Three layers, none overwriting another. */
const IDLE_BOB_VH = 0.85; // vertical float
const IDLE_BOB_MS = 5200;
const IDLE_SWAY = 0.055; // rad of yaw, ~3 degrees
const IDLE_SWAY_MS = 7400;
const IDLE_ROLL = 0.035; // rad of bank, ~2 degrees
const IDLE_ROLL_MS = 9100;


/* ── the transforming object ───────────────────────────────────────────────
   bean -> phin -> cup, one stage per chapter, crossfading at the chapter
   boundaries. The dissolve is a RACK FOCUS: the outgoing stage grows slightly
   and blurs out while the incoming one arrives from under-scale and pulls into
   focus. Blur rather than a plain fade, because two coffee objects dissolving
   through each other at equal sharpness reads as a glitch — the focus pull
   tells the eye which one it is meant to be looking at.

   The window is deliberately wide: 0.12 of progress is a little under half a
   viewport of scroll at this pin length, so the change is legible at reading
   speed rather than snapping between chapters. */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (v) => v * v * (3 - 2 * v);
/** Progress of `p` through [a,b], clamped. */
const span = (p, a, b) => clamp01((p - a) / (b - a));

export function mountHeroBean({ reducedMotion = false, reveal = null } = {}) {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('bean');
  if (!hero || !canvas) return null;

  // Nothing loads, nothing pins, nothing animates. CSS drops the chapters into
  // normal flow and hides the canvas; the hero is otherwise untouched.
  if (reducedMotion) return null;

  const mobile = () => window.matchMedia('(max-width: 768px)').matches;

  const chapters = [...hero.querySelectorAll('.chapter')];
  /* The sticky story stage. Everything the story is made of lives inside it, so
     the menu covers the whole thing in one move. */
  const stage = document.getElementById('stage');
  const intro = document.getElementById('intro-title');
  const menu = document.querySelector('.section--menu');
  const backdrop = hero.querySelector('.hero-backdrop');
  /* Queried at build() time because main.js renders the carousel from config
     after this module is constructed.

     The whole .section__head rides in as one block — eyebrow and headline
     together — which is what the type wants: "Poured slow" is a single editorial
     statement, and staggering it apart made it read as an effect. */
  const menuParts = () =>
    menu
      ? [
          menu.querySelector('.section__head'),
          menu.querySelector('.carousel__caption'),
          menu.querySelector('.carousel__labels'),
          menu.querySelector('.menu__coda'),
        ].filter(Boolean)
      : [];
  const progressBar = document.querySelector('#hero-progress i');
  const progressWrap = document.querySelector('#hero-progress');
  // Everything that clears the stage during the takeover.
  const furniture = [
    hero.querySelector('.heroplate'),
    hero.querySelector('.wm'),
    hero.querySelector('.tagline'),
    hero.querySelector('.hero__stamp'),
    hero.querySelector('.colorways'),
    hero.querySelector('.arrow'),
  ].filter(Boolean);
  // The drink moves as a unit: its canvas and its cast shadow.
  const drinkParts = [
    document.getElementById('cup'),
    hero.querySelector('.cup-shadow'),
  ].filter(Boolean);

  const nav = document.querySelector('.nav');

  let rig = null;
  let master = null;

  let visible = true;
  /* The scroll story's resting pose, kept separate from what is written to the
     object so the pointer can add to it rather than fight it. */
  const base = { y: 0, scale: 1 };
  /* Pointer lean: `t` is where the cursor says it should be, `c` is where it has
     eased to. Both in [-1, 1] over the stage. */
  const ptr = { tx: 0, ty: 0, cx: 0, cy: 0, vx: 0, vy: 0 };
  /** Idle drift, recomputed each frame from the clock. */
  const idle = { bobVH: 0, sway: 0, roll: 0 };
  let ptrRaf = 0;
  let ptrLast = 0;
  /* Per-chapter q at which its exit fade must be finished. Measured, because it
     depends on the chapter's laid-out position, its font sizes and the nav's
     computed height — none of which are knowable from constants. */
  let chExitEnd = [];

  /* Every per-frame write goes through a quickSetter.
     applyProgress runs on every scroll frame, and gsap.set() re-parses the
     target and the property on each call; a quickSetter resolves both once and
     then writes straight to the element. Grouped on one object so applyProgress
     can null-check a whole family (`if (set.introY)`) rather than each element. */
  const set = {};

  function buildSetters() {
    set.furnitureAlpha = furniture.map((el) => gsap.quickSetter(el, 'opacity'));

    if (intro) {
      /* Centring moves into GSAP's transform. The CSS puts the block at top:50%
         with `translate: 0 -50%`, but GSAP takes ownership of `translate` the
         moment it writes y — which would blow the centring away mid-scroll.
         Handing it yPercent instead keeps both halves in the one transform GSAP
         controls. */
      gsap.set(intro, { yPercent: -50 });
      set.introY = gsap.quickSetter(intro, 'y', 'px');
      set.introAlpha = gsap.quickSetter(intro, 'opacity');
    }

    set.chapterY = chapters.map((el) => gsap.quickSetter(el, 'y', 'px'));
    set.chapterAlpha = chapters.map((el) => gsap.quickSetter(el, 'opacity'));

    if (backdrop) set.backdropAlpha = gsap.quickSetter(backdrop, 'opacity');
    if (progressBar) set.progress = gsap.quickSetter(progressBar, 'scaleX');
    if (progressWrap) set.progressAlpha = gsap.quickSetter(progressWrap, 'opacity');
  }

  /**
   * The q at which each chapter's exit fade must already be finished.
   *
   * Derived rather than declared, because it depends on where the chapter
   * actually sits: its top edge has to be transparent BEFORE it reaches the nav,
   * and that crossing point moves with the chapter's laid-out position, its
   * wrapped height and the nav's own computed height.
   *
   * The stage is sticky, so while the story runs a chapter's untranslated top is
   * just the stage's sticky offset plus its own offsetTop — no scroll position
   * enters into it, which is what makes this measurable at build time.
   */
  function measureChapterExits() {
    const vhpx = innerHeight / 100;
    const navB = (nav?.offsetHeight || 0) + NAV_CLEAR_PX;
    const stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
    const denom = (CH_TO_VH - CH_FROM_VH) * vhpx;
    chExitEnd = chapters.map((ch) => {
      if (!denom) return 1;
      const top0 = stickyTop + ch.offsetTop;
      return clamp01((navB - top0 - CH_FROM_VH * vhpx) / denom);
    });
  }

  function applyProgress(p) {
    /* Story-local progress. 0 where the bean's sequence begins, 1 at the end of
       the scrub — so everything below reads in the same units the story was
       originally written in, regardless of how much runway the title takes. */
    const sp = clamp01(span(p, STORY_ORIGIN, P_STORY_END));
    /* How far through the reveal's CLEAR phase we are. Needed up here because
       chapter 3's exit rides it — see the last-chapter branch below. */
    const revealClear = clamp01(span(p, P_REVEAL_START, P_REVEAL_START + (1 - P_REVEAL_START) * REVEAL_CLEAR_FRAC));
    const { halfH } = rig.visibleHalf();
    const vh = innerHeight / 100;
    const isMobile = mobile();
    // vh -> world for this frustum. halfH spans 50vh by definition.
    const worldPerVH = halfH / 50;

    // ── phase 0: takeover ──────────────────────────────────────────────────
    /* Cleared once and never restored. The hero belongs to the top of the page:
       the sequence ends in the menu, so bringing the wordmark and drink back
       would mean scrolling out of the menu and into a hero that already had its
       turn. */
    /* Cleared over its OWN short window, not over the object's arrival. Those
       used to share P_TAKEOVER; pushing the object back to 0.30 to give the
       title a clean frame dragged the furniture with it, so the wordmark and
       drink were still up underneath the title at full strength. The title beat
       is only clean if the stage empties before it, not alongside it. */
    const stageClear = smoothstep(span(p, 0, P_CLEAR));
    for (let i = 0; i < set.furnitureAlpha.length; i++) {
      set.furnitureAlpha[i](1 - stageClear);
    }

    /* The drink is pushed straight down out of the viewport and stays there.
       Transform only — translating a canvas costs a composite, while touching
       top/height would relayout the hero on every scrub tick. It also has to be
       the CANVAS that moves, never .cup-stage: drink.js watches that element's
       position and would re-place the drink to chase the transform. */
    const drinkOut = stageClear;
    /* Written as the INDEPENDENT translate/scale CSS properties rather than
       through two GSAP quickSetters. Two quickSetters for different transform
       channels on one element each rebuild the whole `transform` string from
       their own cache, so whichever runs last wins and the other silently
       vanishes — that is exactly how the scale-down went missing while the
       translate still applied. `translate` and `scale` are separate properties
       and compose cleanly. Still transform-only: no layout, no paint. */
    const drinkPx = drinkOut * innerHeight * 1.1;
    const drinkS = 1 - drinkOut * 0.15;
    for (let i = 0; i < drinkParts.length; i++) {
      drinkParts[i].style.translate = '0 ' + drinkPx + 'px';
      drinkParts[i].style.scale = drinkS;
    }

    // ── chapter zero ───────────────────────────────────────────────────────
    if (set.introY) {
      const q = span(p, P_INTRO_IN, P_INTRO_OUT);
      set.introY(lerp(INTRO_FROM_VH, INTRO_TO_VH, q) * vh);
      set.introAlpha(
        q <= 0 || q >= 1
          ? 0
          : Math.min(smoothstep(clamp01(q / INTRO_FADE_IN)),
                      smoothstep(clamp01((1 - q) / INTRO_FADE_OUT)))
      );
    }

    /* ── chapters ───────────────────────────────────────────────────────────
       Each rises through its own third of the story — EXCEPT the last. Chapter 3
       is where the journey ends: it rises to centre and stays there, on screen
       with the resting bean, and the two of them leave together when the window
       hinges open. Exiting it upward like the others would empty the stage just
       before the reveal and lose the beat the whole story was building to. */
    const last = chapters.length - 1;
    const storyLen = (P_STORY_END - P_STORY_START) / chapters.length;
    for (let i = 0; i < chapters.length; i++) {
      const a = P_STORY_START + storyLen * i;
      const q = span(p, a, a + storyLen);
      if (i === last) {
        /* Rises to its resting position and holds — and then, unlike the other
           two, it does not exit on its own slot. It leaves during the reveal's
           CLEAR phase instead, travelling upward with the same vocabulary as the
           others so the stage empties as one gesture rather than the copy
           lingering while the object dissolves under it. */
        const arrive = smoothstep(clamp01(q / (1 - CH_FADE)));
        const out = smoothstep(revealClear);
        set.chapterY[i](lerp(lerp(CH_FROM_VH, 0, arrive), CH_TO_VH, out) * vh);
        set.chapterAlpha[i](smoothstep(clamp01(q / CH_FADE)) * (1 - out));
        continue;
      }
      // Travel is unclamped: the chapter keeps rising after it is invisible, so
      // scrubbing back down reverses through the same path.
      set.chapterY[i](lerp(CH_FROM_VH, CH_TO_VH, q) * vh);
      /* In over the first CH_FADE of the slot, out so that zero lands on the
         MEASURED nav-clearance point rather than at the end of the slot. */
      const exitEnd = chExitEnd[i] ?? 1;
      const on =
        q <= 0 || q >= exitEnd
          ? 0
          : Math.min(smoothstep(clamp01(q / CH_FADE)),
                     smoothstep(clamp01((exitEnd - q) / CH_FADE)));
      set.chapterAlpha[i](on);
    }

    // ── bean ───────────────────────────────────────────────────────────────
    const centreVH = isMobile ? BEAN_CENTRE_VH_MOBILE : BEAN_CENTRE_VH;
    const bigVH = isMobile ? BEAN_VH_MOBILE : BEAN_VH;

    let beanVH;
    let sizeVH;
    if (p <= P_TAKEOVER) {
      /* Tumbles in from above the fold and settles dead centre — starting at
         P_ARRIVE, not at 0. It used to ramp from the very top of the scrub,
         which put it at ~11vh by p = 0.10, straight across the title block that
         owns the frame until 0.19. That is what occluded the eyebrow. */
      const t = smoothstep(span(p, P_ARRIVE, P_TAKEOVER));
      beanVH = lerp(-26, centreVH, t);
      sizeVH = lerp(bigVH * 0.45, bigVH, t);
    } else {
      const t = span(p, P_TAKEOVER, P_STORY_END);
      /* Barely-there drift, ending a few vh BELOW centre — the journey comes to
         rest slightly low, which reads as settling rather than hovering. The
         copy climbing past it does the real work. */
      beanVH = centreVH + t * BEAN_DRIFT_VH;
      // Breathes 1.0 -> 1.06 -> 1.0 across the three chapters.
      sizeVH = bigVH * (1 + 0.06 * Math.sin(t * Math.PI));
    }

    /* Nothing after P_STORY_END: the bean holds its resting pose and the window
       carries it away. span() already clamps, so this is simply what the two
       expressions above evaluate to at t = 1. */

    /* The scroll story owns the RESTING pose; the pointer adds an offset on top
       of it (see applyPointer). Storing the base rather than writing it straight
       to the object is what lets the two coexist — otherwise whichever ran last
       each frame would erase the other. */
    base.y = (50 - beanVH) * worldPerVH;
    base.scale = sizeVH * worldPerVH;
    rig.bean.scale.setScalar(base.scale);

    /* ── the settle ─────────────────────────────────────────────────────────
       Through chapter 3 the tumble decelerates to near-still: the journey is
       over and the bean rests.

       It eases toward a TARGET yaw rather than just shedding speed, so the pose
       it comes to rest in is chosen rather than incidental — see CREASE_Y.

       1-(1-t)^3 has zero derivative at t = 1, so the bean glides to a stop
       instead of arriving with speed still on it. Continuous at the boundary
       too: at t = 0 it evaluates to the yaw the linear spin already had. */
    const settle = span(sp, SETTLE_S, 1);
    const eased = 1 - Math.pow(1 - settle, 3);
    const spinAtSettle = SETTLE_S * Math.PI * 6;
    /* Wind FORWARD to the next crease-facing yaw. Rounding to the NEAREST one
       would sometimes run the tumble backwards to reach it, and a bean that
       reverses as it comes to rest reads as a mistake rather than as a stop. */
    const creaseYaw =
      CREASE_Y + Math.ceil((spinAtSettle - CREASE_Y) / (Math.PI * 2)) * Math.PI * 2;
    rig.spin.rotation.y =
      sp <= SETTLE_S ? sp * Math.PI * 6 : lerp(spinAtSettle, creaseYaw, eased);
    // The wobble levels out with it, so the resting bean sits square.
    rig.spin.rotation.x =
      Math.sin(Math.min(sp, SETTLE_S) * Math.PI * 2.4) * 0.42 * (1 - eased);

    /* ── the sweetheart reveal ──────────────────────────────────────────────
       Everything the story owns is faded out by the end of the clear phase, so
       nothing repaints behind the shroud once the aperture starts opening. The
       canvas is hidden outright rather than left at opacity 0: a transparent
       WebGL canvas still composites every frame, and there is no reason to run
       the bean's renderer under an opaque cream sheet. */
    if (reveal) {
      const rp = span(p, P_REVEAL_START, 1);
      reveal.apply(p < P_REVEAL_START ? 0 : rp);
      const gone = smoothstep(revealClear);
      canvas.style.opacity = String(1 - gone);
      canvas.style.visibility = gone >= 1 ? 'hidden' : 'visible';
      /* Armed one clear-phase ahead of the aperture, which is the last moment
         the fetch can start and still have frames decoded by the first glimpse
         through the heart — and long after the bean's model is done. */
      if (p > P_REVEAL_START - (P_REVEAL_START - P_STORY_START) * 0.15) reveal.arm();
    }

    // Lay the pointer's tilt and parallax back on top of the pose just written.
    applyPointer();

    /* The camera and the key light are deliberately NOT touched — see the note
       at the top of this file. rig.visibleHalf() is only valid while camera
       distance is fixed, and every position in this module is expressed through
       it. */

    /* The contact shadow stays: the bean is resting on the stage now, not
       flying, and that is exactly when a shadow under it earns its keep. */
    rig.shadow.material.opacity = 0.14;

    /* NO EXIT AND NO TRANSITION. The story ends with the bean at rest and
       chapter 3 still on screen; the stage then simply scrolls away and the menu
       follows it in normal flow. Nothing here fades, moves or reveals anything —
       every version that did (a flyover, a drop, an aperture, a hinged panel, a
       sliding cover, a crossfade) is gone. */
    if (set.backdropAlpha) set.backdropAlpha(1);
    /* The bean's own opacity is NOT forced here any more — the stage driver
       above owns it, because the bean is one of three stages that dissolve into
       each other. Pinning it to 1 here meant the phin and cup faded in over a
       bean that never left, and all three were on screen at once. */

    // ── story progress line ────────────────────────────────────────────────
    if (set.progress) set.progress(p);
    // Present only while the pin is doing something.
    if (set.progressAlpha) {
      set.progressAlpha(Math.min(smoothstep(span(p, 0, 0.04)),
                                 smoothstep(span(1 - p, 0, 0.04))));
    }
  }

  /* ── pointer ───────────────────────────────────────────────────────────────
     Writes ONLY the outer group's rotation and the position offset, both of
     which the scroll story deliberately leaves alone. Safe to call from either
     side — the scrub calls it after re-posing, and the ease loop calls it while
     the cursor is settling. */
  function applyPointer() {
    if (!rig?.ready) return;
    const worldPerVH = rig.visibleHalf().halfH / 50;
    rig.bean.rotation.y = ptr.cx * TILT_Y + idle.sway;
    rig.bean.rotation.x = -ptr.cy * TILT_X;
    /* Banks INTO the lean — negative z tips the top toward +x, so a cursor to
       the right leans the bean's top to the right. (An earlier comment here
       claimed the opposite; the sign was right, the description was not.) */
    rig.bean.rotation.z = -ptr.cx * PTR_ROLL + idle.roll;
    rig.bean.position.x = ptr.cx * PTR_SHIFT_VH * worldPerVH;
    /* base.y is the story's pose; the idle float and the pointer's parallax are
       offsets on top of it. Half the horizontal travel on the pointer term —
       vertical parallax reads as heavier. */
    rig.bean.position.y =
      base.y + idle.bobVH * worldPerVH - ptr.cy * PTR_SHIFT_VH * 0.5 * worldPerVH;
  }

  /**
   * Ease the lean toward the cursor, then stop.
   *
   * The smoothing is frame-rate independent — a fixed per-frame lerp would lean
   * twice as fast on a 120Hz display as on a 60Hz one.
   */
  function ptrTick(t) {
    ptrRaf = requestAnimationFrame(ptrTick);
    if (!rig?.ready || !visible) { ptrLast = t; return; }
    // Clamped: a backgrounded tab resumes with a huge delta and would explode.
    let dt = ptrLast ? Math.min(0.05, (t - ptrLast) / 1000) : 0;
    ptrLast = t;

    const k = PTR_OMEGA * PTR_OMEGA;
    const c = 2 * PTR_ZETA * PTR_OMEGA;
    while (dt > 0) {
      const h = Math.min(PTR_STEP, dt);
      dt -= h;
      ptr.vx += (k * (ptr.tx - ptr.cx) - c * ptr.vx) * h;
      ptr.vy += (k * (ptr.ty - ptr.cy) - c * ptr.vy) * h;
      ptr.cx += ptr.vx * h;
      ptr.cy += ptr.vy * h;
    }

    /* Idle drift, straight off the clock rather than integrated — it has no
       state to keep, and reading absolute time means it cannot accumulate error
       or jump after a stall. */
    idle.sway = Math.sin((t / IDLE_SWAY_MS) * Math.PI * 2) * IDLE_SWAY;
    idle.roll = Math.sin((t / IDLE_ROLL_MS) * Math.PI * 2) * IDLE_ROLL;
    idle.bobVH = Math.sin((t / IDLE_BOB_MS) * Math.PI * 2) * IDLE_BOB_VH;

    applyPointer();
    rig.render();
  }

  /* ONE loop, running whenever the bean is on screen, driving both the spring
     and the idle drift.

     It no longer stops when the lean settles. The idle needs a frame every frame
     regardless, so a second loop for it would just double the draw calls — and
     the rig renders once per invalidate, so two loops would mean two renders per
     frame. `visible` (the IntersectionObserver on the stage) is what actually
     gates the cost: scrolled past the story, this stops entirely. */
  function ptrWake() {
    if (ptrRaf || !rig?.ready) return;
    ptrLast = 0;
    ptrRaf = requestAnimationFrame(ptrTick);
  }
  function ptrSleep() {
    if (ptrRaf) cancelAnimationFrame(ptrRaf);
    ptrRaf = 0;
  }

  /* Fine pointers only. On touch there is no hover to respond to, and reacting
     to the coordinates of a scroll gesture would make the bean twitch every time
     the reader dragged the page. */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /**
   * The bean's current on-screen ellipse, in canvas pixels.
   *
   * Derived from the model's published extents rather than by reading pixels
   * back: for a rotated box the projected half-extents are |R| * extents, which
   * is exact and costs three multiplies — a readPixels per pointermove would be
   * megabytes a frame to answer the same question.
   *
   * Pitch is deliberately ignored. It only ever foreshortens the silhouette, so
   * leaving it out makes the target slightly generous instead of slightly mean,
   * which is the right way for a hit test to be wrong.
   */
  function beanBounds() {
    if (!rig?.ready || rig.extents.x <= 0) return null;
    const worldPerPx = (2 * rig.visibleHalf().halfH) / canvas.clientHeight;
    const s = rig.bean.scale.x;
    const yaw = rig.spin.rotation.y + rig.bean.rotation.y;
    return {
      cx: canvas.clientWidth / 2 + rig.bean.position.x / worldPerPx,
      cy: canvas.clientHeight / 2 - rig.bean.position.y / worldPerPx,
      rx:
        ((Math.abs(Math.cos(yaw)) * rig.extents.x +
          Math.abs(Math.sin(yaw)) * rig.extents.z) *
          s) / 2 / worldPerPx,
      ry: (rig.extents.y * s) / 2 / worldPerPx,
    };
  }

  function onPointerMove(e) {
    // Nothing to react to while the story is off screen or covered by the menu.
    if (!visible || !rig?.ready || !finePointer.matches) return;
    const r = canvas.getBoundingClientRect();
    const b = beanBounds();
    if (!r.height || !b || b.rx <= 0) return;

    /* Normalised against the BEAN, not the stage. Two reasons: the lean only
       responds while the cursor is actually on the object, and measuring from
       the bean's own centre means the deflection maps to where the pointer is
       ON it — the edge is full tilt, the middle is neutral — which is what makes
       it feel attached to the thing rather than to the window. */
    const nx = (e.clientX - r.left - b.cx) / (b.rx * HOVER_PAD);
    const ny = (e.clientY - r.top - b.cy) / (b.ry * HOVER_PAD);

    if (nx * nx + ny * ny <= 1) {
      ptr.tx = Math.max(-1, Math.min(1, nx));
      ptr.ty = Math.max(-1, Math.min(1, ny));
    } else {
      // Off the bean: fall back to rest rather than holding the last lean.
      ptr.tx = 0;
      ptr.ty = 0;
    }
    ptrWake();
  }

  /** Let the lean fall back to neutral when the cursor leaves the document. */
  function onPointerLeave() {
    ptr.tx = 0;
    ptr.ty = 0;
    ptrWake();
  }

  /** Put every element the sequence touches back exactly as CSS left it. */
  function resetFurniture() {
    gsap.set(furniture, { clearProps: 'opacity' });
    for (const el of drinkParts) { el.style.translate = ''; el.style.scale = ''; }
    gsap.set(chapters, { clearProps: 'transform,opacity' });
    if (intro) gsap.set(intro, { clearProps: 'transform,opacity' });
    if (backdrop) gsap.set(backdrop, { clearProps: 'opacity' });
    if (menuParts().length) gsap.set(menuParts(), { clearProps: 'transform,opacity' });


    if (progressWrap) gsap.set(progressWrap, { clearProps: 'opacity' });
  }

  function build() {
    master?.scrollTrigger?.kill();
    master?.kill();
    buildSetters();
    /* Re-measured on every build, so a resize or an orientation change that
       changes the nav's height or the chapters' wrapping re-derives the clamp
       instead of carrying a stale one. */
    measureChapterExits();

    /* ── the takeover latch ────────────────────────────────────────────────
       Hero furniture must stay gone once the takeover has begun, and come back
       if you scroll up out of it.

       The scrub cannot do this on its own. Its writes only happen while the
       playhead is inside the pin's range, so past the end the last value simply
       persists — and anything the story left TRANSLATED rather than faded goes
       with it. That is how the drink's cast shadow ended up over the menu: the
       exit slides it 1.1 viewports down the stage, and once the hero stops
       scrolling that lands it squarely on the section below, still opaque and
       still taking pointer events.

       A toggleClass trigger is the right shape because it is a function of
       scroll POSITION, not a one-shot: it survives unpin, resize and refresh,
       and it releases on the way back up. The CSS it switches carries
       `pointer-events: none` too, so nothing invisible is left clickable. */
    ScrollTrigger.create({
      trigger: hero,
      start: () => 'top top-=' + P_CLEAR * Math.max(1, hero.offsetHeight - (stage?.offsetHeight || 0)),
      end: 'max',
      toggleClass: { targets: hero, className: 'is-taken-over' },
      invalidateOnRefresh: true,
    });

    /* NO PIN. The stage is `position: sticky`, so the browser holds it in place
       and this trigger only has to supply progress. That removes the pin-spacer,
       the runway element and the whole class of drift bugs where the pin's end
       and the menu's top disagreed by a few px.

       The range is measured, not declared, and it must equal the STICKY TRAVEL
       exactly — (hero height - stage height). A sticky box is held for precisely
       that distance, so any other value desynchronises the scrub from the thing
       it is animating: this briefly subtracted two stage heights (left over from
       a version where the menu overlapped the hero by a screen), and the story
       then ran to completion at half the scroll while the stage was still stuck.

       Read through a function so invalidateOnRefresh re-derives it on resize. */
    const prog = { p: 0 };
    master = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: () => '+=' + Math.max(1, hero.offsetHeight - (stage?.offsetHeight || 0)),
        scrub: 0.7,
        invalidateOnRefresh: true,
        /* Pin the end states explicitly on the way out and back in.
           Under `scrub` the timeline eases toward the scroll position, so when
           the pin is left quickly the playhead can stop a hair short of the
           boundary and never send a final update — which left the header stuck
           in its minimal cinema state over the menu section below, because the
           frame that would have restored it was never drawn. */
        onLeave: () => applyProgress(1),
        onLeaveBack: () => applyProgress(0),
      },
    });

    /* One tween on a proxy, read in onUpdate. Reading ScrollTrigger's own
       `progress` here instead would bypass the scrub entirely: under `scrub`
       that property is the RAW scroll position and the smoothing lives in the
       timeline's playhead, so everything would snap. */
    master.to(prog, {
      p: 1,
      ease: 'none',
      duration: 1,
      onUpdate: () => {
        applyProgress(prog.p);
        if (visible) rig.invalidate();
      },
    }, 0);
  }

  async function init() {
    /* Lazy and after first paint: the hero's LCP is the wordmark, and neither
       the Three chunk nor a 262 KB model may compete with it. */
    const { createBean } = await import('./bean.js');
    rig = createBean({ canvas, reducedMotion });

    /* If the model is slow, leave scroll alone rather than pinning the page for
       320% of a viewport with nothing to show. A pin that arrives late is worse
       than no pin — the reader has already scrolled past. */
    const won = await Promise.race([
      rig.loaded.then(() => 'loaded'),
      new Promise((r) => setTimeout(() => r('timeout'), LOAD_BUDGET_MS)),
    ]);
    if (won === 'timeout' || !rig.ready) {
      rig.dispose();
      rig = null;
      return;
    }

    buildSetters();
    applyProgress(0);
    rig.render();
    gsap.to(canvas, { opacity: 1, duration: 0.4, ease: 'power2.out' });
    build();
    ScrollTrigger.refresh();
    // Starts the idle drift; it self-gates on `visible`.
    ptrWake();
  }

  if ('requestIdleCallback' in window) requestIdleCallback(() => init(), { timeout: 1200 });
  else setTimeout(init, 400);

  /* Watches the STAGE, not the section. .hero is 420svh tall, so it stays
     "intersecting" long after the one screen that is actually drawn has left —
     the stage is the thing whose visibility matches what the reader can see.

     `visible` gates both the scrub's rig.invalidate() and the idle loop's work,
     so scrolling past the story stops all drawing. */
  const onScreen = new IntersectionObserver(
    (entries) => { visible = entries.some((e) => e.isIntersecting); },
    { rootMargin: '0px' }
  );
  onScreen.observe(stage || hero);

  /* On window, not on the canvas: .bean-layer is `pointer-events: none` (it
     covers the whole stage and would eat every click underneath), so it never
     receives pointer events itself. Passive — this only reads coordinates. */
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave, { passive: true });

  const mq = window.matchMedia('(max-width: 768px)');
  const rebuild = () => {
    if (!rig?.ready) return;
    build();
    ScrollTrigger.refresh();
  };
  let resizeT;
  const onResize = () => { clearTimeout(resizeT); resizeT = setTimeout(rebuild, 180); };
  mq.addEventListener('change', rebuild);
  window.addEventListener('resize', onResize, { passive: true });

  return {
    get rig() { return rig; },
    get timeline() { return master; },
    get scrollTrigger() { return master?.scrollTrigger; },
    applyProgress: (p) => (rig?.ready ? (applyProgress(p), rig.render()) : null),
    ScrollTrigger,
    dispose() {
      onScreen.disconnect();
      mq.removeEventListener('change', rebuild);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      ptrSleep();
      clearTimeout(resizeT);
      master?.scrollTrigger?.kill();
      master?.kill();
      resetFurniture();
      rig?.dispose();
    },
  };
}


