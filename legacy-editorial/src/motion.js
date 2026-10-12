import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// The single brand curve, as a GSAP-readable string.
const EASE = 'cubic-bezier(0.65, 0, 0.15, 1)';
gsap.registerEase('brand', gsap.parseEase(EASE));

/**
 * Load-in: the three wordmark lines rise out of their masks one after another,
 * then the cup slides in from the right and overshoots slightly before settling.
 */
export function playIntro({ onCupIn } = {}) {
  // Hidden up front rather than inside the timeline, so there's no chance of a
  // frame painting them at full opacity before the first tick.
  gsap.set(['.tagline', '.btn-gold', '.nav__logo', '.nav__pills'], { autoAlpha: 0 });

  const tl = gsap.timeline({ defaults: { ease: 'brand' } });

  // One tween per element per property. Pairing a `.to` with an overlapping
  // `.from` on the same `y` leaves two tweens fighting over it and the element
  // sticks at its start offset.
  tl.from('.wordmark__inner', {
    // 105% rather than 100% so the line is fully clear of the mask edge even
    // with Fraunces' descenders hanging below the box.
    yPercent: 105,
    duration: 1.15,
    stagger: 0.11,
  })
    .to('.nav__logo', { autoAlpha: 1, duration: 0.7 }, 0.35)
    .to('.nav__pills', { autoAlpha: 1, duration: 0.7 }, 0.45)
    .fromTo('.tagline', { y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8 }, '-=0.55')
    .fromTo('.btn-gold', { y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7 }, '-=0.5');

  // Cup arrives last, after the type has settled.
  tl.call(() => onCupIn?.(), null, '-=0.7');

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
export function buildScrollScenes() {
  // Section headings and the pull-quote: a short rise as they enter.
  gsap.utils.toArray('.section__head, .quote__text, .quote__tag').forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0,
      y: 34,
      duration: 1,
      ease: 'brand',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });

  // Cards: reveal on the card, drift on its slot. Keeping the two transforms on
  // separate elements means the scrubbed parallax can't stomp the entrance.
  const slots = gsap.utils.toArray('.card-slot');
  slots.forEach((slot, i) => {
    gsap.from(slot.querySelector('.card'), {
      autoAlpha: 0,
      y: 40,
      duration: 0.9,
      ease: 'brand',
      scrollTrigger: { trigger: slot, start: 'top 92%' },
    });

    // Alternating, uneven depths — an even ramp reads as a tilt, not a drift.
    const depth = [0.42, -0.18, 0.6, -0.05, 0.3][i % 5];
    gsap.fromTo(
      slot,
      { y: 62 * depth },
      {
        y: -62 * depth,
        ease: 'none',
        scrollTrigger: {
          trigger: '.section--menu',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.65,
        },
      }
    );
  });

  // Location rows, staggered off the list rather than one trigger each.
  gsap.from('.loc', {
    autoAlpha: 0,
    y: 26,
    duration: 0.8,
    ease: 'brand',
    stagger: 0.08,
    scrollTrigger: { trigger: '.locations', start: 'top 85%' },
  });

  gsap.from('.footer__mark', {
    autoAlpha: 0,
    y: 50,
    duration: 1.1,
    ease: 'brand',
    scrollTrigger: { trigger: '.footer', start: 'top 90%' },
  });
}

/** Web fonts change every measurement on the page; re-measure once they land. */
export function refreshOnFonts() {
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
