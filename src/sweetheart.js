import gsap from 'gsap';
import { video, promoteVideo, image } from './media.js';
import { defaultColorway } from './config.js';

/**
 * The sweetheart reveal — the journey's final beat, as a LOCKET.
 *
 * A heart keyline draws itself around the standing cup; the cream shroud's hole
 * opens at exactly that size, so the first thing you see through it is a RING of
 * footage around the cup's silhouette; the heart then blooms to full bleed and
 * the cup dissolves into the film.
 *
 * WHAT THIS REPLACED, and why: the aperture used to be born as a dot at the
 * stage centre and grow from nothing, preceded by a phase that emptied the stage
 * completely. That left several hundred pixels of scroll where the viewport was
 * both object-free and footage-free — a dead cream frame. The locket has no such
 * position: the cup holds the frame until footage is already visible around it,
 * and the footage holds it after.
 *
 * WHY THE HEART IS A HOLE IN A SHROUD, rather than a mask or clip-path on the
 * video: a single <path> with fill-rule="evenodd" — outer rectangle plus heart
 * subpath — paints as one ordinary fill. No compositing layer, no mask buffer,
 * and none of the clip-path animation jank Safari has on a scaled clip.
 *
 * THE `d` IS REBUILT PER FRAME rather than animated with transform: scale(). A
 * subpath cannot carry its own transform, and a transform on the <path> would
 * scale the outer rectangle with it — the rectangle has to stay pinned to the
 * viewport or the shroud stops covering the screen. Rebuilding is nine cubic
 * segments, ~56 numbers, on a page already running a WebGL frame. It also means
 * the keyline's stroke-width needs no compensation: there is no group scale to
 * compensate against, so 2.4px stays 2.4px apparent at every heart size.
 *
 * THE CUP IS THIS MODULE'S OWN DOM ELEMENT, not the hero's WebGL drink. Three
 * reasons: the beat requires the cup to sit ABOVE the shroud in the z-order,
 * which a canvas underneath the reveal layer cannot do; the hero's cup is
 * cleared at the top of the pin and held hidden by the takeover latch, so
 * reusing it would mean fighting that latch; and the brief requires zero canvas
 * repaints from the segment's start, which is only guaranteed if no WebGL
 * surface is involved in this beat at all.
 */

/* ── the segment's scroll budget, in svh ──────────────────────────────────
   Exported: hero-bean.js sizes the pin from it, and .hero's height in style.css
   must equal the same total.

   The brief's phase fractions run to 0.97 and then say "the dwell and release as
   currently built". Those cannot both be fractions of the same span — the dwell
   is 100svh, which would be 0.40 of this segment, not 0.03. So the fractions are
   applied to the ANIMATED span and the dwell is appended after it. The segment's
   total is unchanged at 250svh, which is what the brief actually asks to hold. */
const ANIM_SVH = 150;
const DWELL_SVH = 100;
export const REVEAL_SVH = ANIM_SVH + DWELL_SVH;
/** Kept for hero-bean.js, which reads `.clear` to time the bean's release. */
export const REVEAL_BUDGET = { anim: ANIM_SVH, dwell: DWELL_SVH, clear: ANIM_SVH * 0.1 };

/** Segment progress -> animated-sequence progress. */
const ANIM_FRAC = ANIM_SVH / REVEAL_SVH;

/* Phase boundaries, as fractions of the animated sequence. Straight from the
   brief; named so the ordering constraints between them stay legible. */
const P = {
  exitEnd: 0.10, // ch03 + tint gone, bean canvas released, cup holding the frame
  drawIn: 0.10, // keyline starts drawing
  birth: 0.24, // ...finishes, and the hole opens AT the keyline's size
  bloomEnd: 0.92,
  cupScaleEnd: 0.55, // counter-scale 1.0 -> 1.04
  shadowOut: 0.40, // shadow gone by here (a shadow over video reads wrong)
  keyFadeIn: 0.50,
  keyFadeOut: 0.62,
  dissolveIn: 0.55,
  dissolveOut: 0.72, // cup fully gone before the heart passes ~75%
  scrimIn: 0.72,
  scrimOut: 0.85,
  l1: [0.80, 0.88],
  l2: [0.86, 0.93],
  tag: [0.92, 0.97],
};

/** Ring size: the heart is born this many times the cup's larger dimension. */
const BIRTH_RATIO = 1.2;
/** Apparent stroke weight of the keyline, in px, constant at every heart size. */
const KEY_STROKE = 2.4;
/** Safety factor on S_full. The heart is not a circle: its bbox covering the
    viewport does not mean its OUTLINE does, because the top notch and the lower
    flanks cut inside that box. Verified by sampling for cream pixels. */
const S_FULL_K = 2.35;
/** The cup's dissolve, in the chapter-crossfade vocabulary. */
const DISSOLVE_BLUR_PX = 8;

/* The heart, in its own units, centred on (0,0).
 *
 * Redrawn against the em logo's curve character rather than emoji proportions.
 * The first cut of this path was carried over from the preview draft and only
 * ever judged as a FILLED shape; seen as a hairline ring around the cup, where
 * the eye reads the outline rather than the mass, its notch cut a third of the
 * way down and its cusp came to a near-point. Both now match the logo's language:
 *
 *   ~1.10:1 wider than tall — the shape sits, rather than standing up (the x
 *     values are the drawn curve narrowed by 0.908; measured, not guessed)
 *   FULL soft lobes whose crowns are wide arcs, like the clover's petals
 *   a SHALLOW notch: it dips to -30 while the lobes crest near -47, so the
 *     cleft is 18% of the height rather than 29% — a dimple, not a V
 *   a GENTLED cusp: the flanks meet through a 12-unit radius at y≈46, so the
 *     bottom reads as a soft point rather than a needle
 *
 * Nine cubic segments, no polyline anywhere: it has to read as a heart at ring
 * size around a cup, and stay smooth when scaled past the viewport diagonal. */
const HEART = [
  ['M', 0, -30],
  ['C', -7.3, -46, -27.2, -53, -40.9, -44],
  ['C', -54.5, -35, -54.5, -11, -42.7, 5],
  ['C', -32.7, 18, -15.4, 31, -5.4, 42],
  ['C', -1.8, 46.5, 1.8, 46.5, 5.4, 42],
  ['C', 15.4, 31, 32.7, 18, 42.7, 5],
  ['C', 54.5, -11, 54.5, -35, 40.9, -44],
  ['C', 27.2, -53, 7.3, -46, 0, -30],
  ['Z'],
];
/** The heart's half-width in local units — the sizing reference for every scale. */
const HEART_HALF_W = Math.max(
  ...HEART.filter((s) => s[0] !== 'Z').flatMap((s) => s.slice(1).filter((_, i) => i % 2 === 0)).map(Math.abs)
);

/** The heart's path data, scaled about its centre and moved to (cx, cy). */
function heartD(s, cx, cy) {
  let d = '';
  for (const seg of HEART) {
    const [cmd, ...n] = seg;
    if (cmd === 'Z') { d += 'Z'; continue; }
    d += cmd;
    for (let i = 0; i < n.length; i += 2) {
      d += (cx + n[i] * s).toFixed(2) + ',' + (cy + n[i + 1] * s).toFixed(2) + ' ';
    }
  }
  return d;
}

/* Asset slots.
 *
 * CONTENT BRIEF for sweetheart.mp4 — people and warmth, NOT process: hands
 * around a glass, a shared table, steam in morning light, someone laughing
 * mid-sentence. This is the emotional payoff, so it wants faces and hands.
 * Shoot or licence 16:9, safe for a centre crop at 9:16 — it is full-bleed at
 * both 1440 and 390, and for most of the locket it is seen through a heart, so
 * keep the subject off the exact centre where the cup stands. */
const ASSETS = {
  video: null, // sweetheart.mp4
  poster: null, // sweetheart-poster.jpg
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const span = (p, a, b) => clamp01((p - a) / (b - a));
const smoothstep = (v) => v * v * (3 - 2 * v);
/** power2.inOut, matching the ease name the rest of the page uses. */
const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const MARKUP = () => {
  const way = defaultColorway();
  return `
  <div class="sweet__layer" aria-hidden="true">
    <div class="sweet__video" data-sweet-video>
      ${video({ src: ASSETS.video, poster: ASSETS.poster, label: 'sweetheart.mp4', ratio: '16 / 9' })}
    </div>
    <div class="sweet__scrim" data-sweet-scrim></div>
  </div>
  <div class="sweet__copy" data-sweet-copy>
    <p class="sweet__line sweet__line--lead"><span class="sweet__in">Em means sweetheart &mdash;</span></p>
    <p class="sweet__line sweet__line--sub"><span class="sweet__in">this is our love letter to</span></p>
    <p class="sweet__line sweet__line--sub"><span class="sweet__in">Vietnamese coffee culture.</span></p>
    <p class="sweet__line sweet__line--tag"><span class="sweet__in">#BeInTheMoment</span></p>
  </div>
  <svg class="sweet__shroud" data-sweet-shroud preserveAspectRatio="none" aria-hidden="true">
    <path data-sweet-cut fill-rule="evenodd"></path>
  </svg>
  <div class="sweet__cupshadow" data-sweet-cupshadow aria-hidden="true"></div>
  <div class="sweet__cup" data-sweet-cup aria-hidden="true">
    ${image({ src: way?.img || '/drink.png', alt: '', label: 'drink.png', ratio: '3 / 4', w: 800, h: 1066 })}
  </div>
  <svg class="sweet__keyline" data-sweet-keysvg preserveAspectRatio="none" aria-hidden="true">
    <path data-sweet-key fill="none"></path>
  </svg>`;
};

/**
 * Build the reveal and return a controller the pin drives.
 *
 * Under reduced motion it paints a static mid-state once — the cup inside the
 * heart ring over the poster frame, every line at its end state — and hands back
 * a no-op `apply`, since the pin does not exist in that mode.
 */
export function mountSweetheart({ reducedMotion = false } = {}) {
  const stage = document.getElementById('stage');
  if (!stage) return null;

  const host = document.createElement('div');
  host.className = 'sweet';
  host.id = 'sweet';
  host.innerHTML = MARKUP();
  stage.appendChild(host);

  const shroud = host.querySelector('[data-sweet-shroud]');
  const cut = host.querySelector('[data-sweet-cut]');
  const keySvg = host.querySelector('[data-sweet-keysvg]');
  const key = host.querySelector('[data-sweet-key]');
  const copy = host.querySelector('[data-sweet-copy]');
  const scrim = host.querySelector('[data-sweet-scrim]');
  const cup = host.querySelector('[data-sweet-cup]');
  const cupShadow = host.querySelector('[data-sweet-cupshadow]');
  const lines = [...host.querySelectorAll('.sweet__in')];
  const videoEl = host.querySelector('video');
  const nav = document.querySelector('.nav');

  let vw = 0, vh = 0, sFull = 1, sBirth = 1, cx = 0, cy = 0, keyLen = 0;
  let measured = false;
  let lastScale = 0;

  /**
   * Where the heart is born, how big it starts, and how big it must grow.
   *
   * The birth size is derived from the CUP's rendered box, not from a constant:
   * the ring has to sit around whatever the cup actually measures, which differs
   * between 1440 and 390 and again after a rotation.
   */
  function measure() {
    const r = stage.getBoundingClientRect();
    vw = Math.ceil(r.width) || window.innerWidth;
    vh = Math.ceil(r.height) || window.innerHeight;
    shroud.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    keySvg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);

    const cr = cup.getBoundingClientRect();
    cx = cr.width ? cr.left - r.left + cr.width / 2 : vw / 2;
    cy = cr.height ? cr.top - r.top + cr.height / 2 : vh / 2;

    const cupMax = Math.max(cr.width || vw * 0.28, cr.height || vh * 0.4);
    /* Nominal first, then CALIBRATED against the rendered bbox. HEART_HALF_W is
       the control-point extent, and a cubic sits inside its control hull — the
       drawn heart comes out about 7% narrower than nominal, which put the ring
       at 1.12x the cup instead of 1.2x. Measuring the real path once and
       correcting is exact, and it survives any future edit to HEART. */
    sBirth = (BIRTH_RATIO * cupMax) / (HEART_HALF_W * 2);
    key.setAttribute('d', heartD(sBirth, cx, cy));
    const kb = key.getBBox();
    if (kb.width) sBirth *= (BIRTH_RATIO * cupMax) / kb.width;
    sFull = (Math.hypot(vw, vh) / (HEART_HALF_W * 2)) * S_FULL_K;
  }

  /** Paint the shroud: viewport rectangle, heart subpath, one evenodd fill. */
  function paintHole(scale) {
    lastScale = scale;
    cut.setAttribute('d', `M0,0 H${vw} V${vh} H0 Z` + heartD(scale, cx, cy));
  }

  /** Paint the keyline at the birth size and (re)measure its length for the draw-on. */
  function paintKey(scale) {
    key.setAttribute('d', heartD(scale, cx, cy));
    keyLen = key.getTotalLength();
    key.style.strokeDasharray = keyLen;
  }

  measure();
  paintKey(sBirth);
  /* Closed at the birth size, NOT at zero. The hole must never be smaller than
     the keyline that announced it — opening below that size is the dot-from-
     nothing the locket replaced. Before the birth beat it is simply not painted. */
  paintHole(0);

  /* The header goes minimal while the locket is open: a solid bar with pills
     over full-bleed video fights the cinema. Driven from apply(), i.e. from the
     same pin progress as everything else, so it cannot desync. */
  const setHeaderMinimal = (on) => {
    if (!nav || reducedMotion) return;
    nav.classList.toggle('is-cinema', on);
  };

  let armed = false;
  function arm() {
    if (armed) return;
    armed = true;
    if (videoEl) promoteVideo(videoEl, { reducedMotion });
  }

  if (reducedMotion) {
    /* Hard cut to a legible mid-state: the cup inside the heart ring, over the
       poster frame, with the copy already at its end state. No scrub, no scaling
       mask, and the video src is never assigned. */
    host.classList.add('is-static');
    const sMid = Math.max(sBirth * 1.35, sBirth);
    paintHole(sMid);
    paintKey(sBirth);
    key.style.strokeDashoffset = '0';
    key.style.opacity = '0.5';
    cupShadow.style.opacity = '0';
    gsap.set(lines, { yPercent: 0, autoAlpha: 1 });
    copy.style.opacity = '1';
    scrim.style.opacity = '1';
    /* Inline, not left to the stylesheet's reduced-motion block: that block and
       this branch are two separate readings of the same preference, and if they
       ever disagree the whole beat is invisible. One source of truth. */
    host.style.visibility = 'visible';
    host.style.opacity = '1';
    return { apply() {}, resize: measure, arm() {}, isStatic: true };
  }

  gsap.set(lines, { yPercent: 100 });
  copy.style.opacity = '0';
  scrim.style.opacity = '0';
  host.style.opacity = '0';

  /**
   * Drive the locket from the segment's progress, 0 -> 1.
   *
   * `rp` below 0 means the story is still running and the whole layer is off.
   * Everything below reads in `t`, the ANIMATED sequence's progress, so the
   * brief's phase numbers appear here unmodified.
   */
  function apply(rp) {
    if (!measured) { measured = true; measure(); paintKey(sBirth); }

    if (rp <= 0) {
      host.style.opacity = '0';
      host.style.visibility = 'hidden';
      setHeaderMinimal(false);
      return;
    }
    host.style.visibility = 'visible';
    /* Opaque from the first frame: what is showing is the cream shroud and the
       cup, not the video. Fading the layer in would cross-dissolve the shroud
       against the stage and let the footage through early. */
    host.style.opacity = '1';

    const t = clamp01(rp / ANIM_FRAC);

    // ── the cup ───────────────────────────────────────────────────────────
    /* Arrives during the exit phase, overlapping the bean's release, so the
       frame is never empty. (The brief has the cup already standing here; in
       this build the object at chapter 03 is the bean, so the cup takes over
       from it rather than simply persisting — see the module note.) */
    const cupIn = smoothstep(clamp01(t / (P.exitEnd * 0.6)));
    const dissolve = smoothstep(span(t, P.dissolveIn, P.dissolveOut));
    const counter = 1 + 0.04 * smoothstep(span(t, P.birth, P.cupScaleEnd));
    cup.style.opacity = String(cupIn * (1 - dissolve));
    cup.style.transform = `scale(${(counter + 0.02 * dissolve).toFixed(4)})`;
    cup.style.filter = dissolve > 0 ? `blur(${(dissolve * DISSOLVE_BLUR_PX).toFixed(2)}px)` : 'none';
    // A shadow over footage reads wrong, so it leaves as the hole opens.
    cupShadow.style.opacity = String(cupIn * (1 - smoothstep(span(t, P.birth, P.shadowOut))));

    // ── the keyline ───────────────────────────────────────────────────────
    const draw = smoothstep(span(t, P.drawIn, P.birth));
    key.style.strokeDashoffset = String(keyLen * (1 - draw));
    key.style.opacity = String(
      t < P.drawIn ? 0 : 1 - smoothstep(span(t, P.keyFadeIn, P.keyFadeOut))
    );

    // ── the hole ──────────────────────────────────────────────────────────
    /* Nothing before the birth beat, then it opens AT the keyline's size and
       blooms. `paintHole(0)` collapses the heart to a point, which under evenodd
       leaves the rectangle solid — the shroud with no hole in it. */
    if (t < P.birth) paintHole(0);
    else paintHole(sBirth + (sFull - sBirth) * inOut(span(t, P.birth, P.bloomEnd)));

    // ── scrim and copy ────────────────────────────────────────────────────
    scrim.style.opacity = String(smoothstep(span(t, P.scrimIn, P.scrimOut)));
    const bands = [P.l1, P.l2, P.l2, P.tag];
    copy.style.opacity = t >= P.l1[0] ? '1' : '0';
    for (let i = 0; i < lines.length; i++) {
      const [a, b] = bands[i];
      // The two middle lines share a band; the second trails by a fifth of it.
      const lag = i === 2 ? (b - a) * 0.2 : 0;
      const q = smoothstep(span(t, a + lag, b + lag));
      lines[i].style.transform = `translateY(${((1 - q) * 100).toFixed(2)}%)`;
      lines[i].style.opacity = String(q);
    }

    /* Minimal header from the moment the hole opens until just before release.
       Keyed off 0.98 rather than 1: a scrubbed progress does not reliably land
       exactly on 1, and stopping at 0.9999 would strand the minimal bar over the
       menu section below. */
    /* Minimal only once the FOOTAGE is actually behind the bar. Keyed to the
       birth beat, the header went cream-on-cream: is-cinema recolours the logo
       and clover to cream for legibility over video, but at the ring stage the
       ground under the bar is still the cream shroud, so the mark vanished. By
       0.58 the hole has passed the top corners. */
    setHeaderMinimal(t > 0.58 && rp < 0.98);
  }

  const onResize = () => {
    measure();
    paintKey(sBirth);
    paintHole(lastScale);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  return { apply, resize: onResize, arm, isStatic: false };
}
