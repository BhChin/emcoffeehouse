import { video, armVideos } from './media.js';

/**
 * The hero's lifestyle plate — an arch of footage behind the drink.
 *
 * It exists to put people and warmth into the hero without touching its
 * composition: it occupies the right flank only, sits BEHIND the cup, and never
 * passes under the display type. The wordmark, tagline, hashtag and swatches all
 * stay on clean cream, which is what keeps the hero reading as an editorial
 * cover rather than a stock-photo banner.
 *
 * THE ARCH IS THE SITE'S OWN LANGUAGE, borrowed from the ritual section that
 * used to sit downpage (border-radius 50% 50% 0 0 — a half-round top on a
 * squared base). The ritual owned the draw-on keyline flourish; this one is
 * static, so the two never competed even when both existed.
 *
 * THE WASH IS THE ONE SANCTIONED USE OF THE LIVE PAIR out here. Everything
 * structural on the page derives from static tokens, but this plate is inside
 * the hero and is supposed to follow the swatch: tapping a drink re-grades the
 * footage toward that drink's world. It reads --plate directly, so it inherits
 * the same 0.5s transition the cup swap uses and the two move together with no
 * extra timing code.
 */

/* Manifest slots.
 *
 * CONTENT BRIEF for hero-life.mp4 — the room, not the product: someone setting a
 * glass down, a hand on a warm cup, light moving across a table, two people
 * mid-conversation. It sits behind a cut-out drink for its whole life, so the
 * middle third of the frame is effectively hidden — keep the subject to the
 * upper and outer thirds, and keep the footage SLOW. Anything with a cut in it
 * will fight the stillness of the type. Vertical or square crops best: the plate
 * is a tall arch at 1440 and a short band at 390. */
const ASSETS = {
  video: null, // hero-life.mp4
  poster: null, // hero-life-poster.jpg
};

/** Wash strength. Enough to tint, not enough to mud the footage. */
const WASH_ALPHA = 0.18;

export function mountHeroPlate({ reducedMotion = false } = {}) {
  const stage = document.getElementById('stage');
  const backdrop = stage?.querySelector('.hero-backdrop');
  if (!stage || !backdrop) return null;

  /* NO ASSET, NO PLATE. Everywhere else on the site a missing file shows the
     labelled placeholder card, because those sit in sections where an empty hole
     would read as broken and the label tells you what to go and shoot. The hero
     is the exception: it is the first thing anyone sees, it is 42% of the fold,
     and a card reading "HERO-LIFE.MP4" there makes a finished site look
     unfinished. So this slot stays dark until the footage exists — and lights up
     on its own the moment ASSETS.video is filled in, with no other change. */
  if (!ASSETS.video) return null;

  const el = document.createElement('div');
  el.className = 'heroplate';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="heroplate__media">
      ${video({ src: ASSETS.video, poster: ASSETS.poster, label: 'hero-life.mp4', ratio: '3 / 4' })}
      <div class="heroplate__wash"></div>
    </div>
    <div class="heroplate__key"></div>`;

  /* Inserted directly after the backdrop, which puts it below every other layer
     in the stage. The wordmark carries the same z-index, so DOM order is what
     keeps the type in front — see the note on .heroplate in style.css. */
  backdrop.insertAdjacentElement('afterend', el);

  if (reducedMotion) {
    // Poster only: the src is never assigned and the wash never transitions.
    el.classList.add('is-static');
    return el;
  }

  /* ARMED LATE, and deliberately not by an observer. This plate is above the
     fold, so an IntersectionObserver would fire during boot and put the clip in
     direct competition with the 600KB bean model — the one download the page
     cannot afford to slow down. Waiting for idle after first paint puts it
     behind the model and the type reveal without needing to know when either
     finished. The timeout is the fallback for browsers where idle never comes
     (Safari has no requestIdleCallback), and armVideos is scoped to this element
     so it cannot also promote the sweetheart clip, which is scroll-gated. */
  const arm = () => armVideos({ reducedMotion, root: el });
  if ('requestIdleCallback' in window) requestIdleCallback(arm, { timeout: 3000 });
  else setTimeout(arm, 1200);

  return el;
}
