import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
/* video()/armVideos() went with the Ritual section — it held the only <video>
   slot on the page. The sweetheart reveal has its own, armed from scroll
   progress via promoteVideo() rather than by an observer (see media.js). */
import { image } from './media.js';
import { reveal } from './reveal.js';

gsap.registerPlugin(ScrollTrigger);

/* Which assets exist. Declared rather than probed — see media.js. Flip a value
   to its filename as the asset lands; nothing else needs to change. */
const ASSETS = {
  community: [null, null, null, null, null, null], // community-01..06.jpg
};

const IG = 'https://instagram.com/emcoffeehouse';

function gridMarkup() {
  const tiles = ASSETS.community
    .map((src, i) => {
      const n = String(i + 1).padStart(2, '0');
      const inner = image({
        src,
        label: `community-${n}.jpg`,
        alt: `Em Coffee House community photo ${i + 1}`,
        tint: i % 2 ? 'var(--feature)' : 'var(--sage)',
        w: 600,
        h: 600,
      });
      return `<a class="moment__tile" href="${IG}" target="_blank" rel="noopener"
                 aria-label="Em Coffee House on Instagram">${inner}</a>`;
    })
    .join('');

  return `<section class="section moment" id="moments">
      <header class="moment__head">
        <h2 class="moment__tag">#BeInTheMoment</h2>
        <a class="moment__link" href="${IG}" target="_blank" rel="noopener">@emcoffeehouse &rarr;</a>
      </header>
      <div class="moment__grid">${tiles}</div>
    </section>`;
}

/**
 * Insert the moments grid above Locations, and wire its motion.
 *
 * Inserted from JS rather than authored into index.html so the asset manifest
 * above stays the single place that decides what exists — markup and data do not
 * have to be kept in step by hand.
 */
export function buildSections({ reducedMotion = false } = {}) {
  /* Anchored on Locations, and re-entry guarded on what this actually inserts.
     That guard used to test for #ritual; with the Ritual section removed it
     would have been permanently false, so buildSections would re-insert the
     grid on every call. Gate on the thing you create. */
  const locations = document.querySelector('.section--locations');
  if (!locations || document.getElementById('moments')) return;

  locations.insertAdjacentHTML('beforebegin', gridMarkup());

  const tiles = [...document.querySelectorAll('.moment__tile')];

  if (reducedMotion) {
    gsap.set(tiles, { y: 0, autoAlpha: 1 });
    return;
  }

  reveal({
    id: 'moment-tiles',
    targets: tiles,
    trigger: '.moment__grid',
    from: { autoAlpha: 0, y: 24 },
    duration: 0.6,
    stagger: 0.08,
    start: 'top 85%',
    reducedMotion,
  });
}
