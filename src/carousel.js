import gsap from 'gsap';
import EmblaCarousel from 'embla-carousel';
import { MENU_ITEMS, COLORWAYS } from './config.js';

/**
 * The drink carousel — a stage, not a boxed slideshow.
 *
 * One drink is centred at full size; its neighbours peek in from both edges at
 * reduced scale and opacity, so it is always visible that there is more. Embla
 * owns drag, momentum, snapping and wrap-around; everything else here is
 * presentation layered on the index it reports.
 *
 * The photos are the SAME assets the hero drink uses, already keyed and
 * normalised by scripts/normalize-drinks.mjs — every subject centred on both
 * axes within its frame. That is what lets a plain <img> sit on the stage with
 * no per-drink nudging.
 */

// Peek geometry lives here rather than in CSS because Embla needs the slide
// width to compute snapping, and the two must agree exactly.
const SLIDE_PCT = 30; // desktop: peeks land near the frame edges, fully inside
const SLIDE_PCT_MOBILE = 62; // portrait: tighter, but still a whole cup a side

const CAPTION_LAG = 0.06; // the brief's 60ms, after the photo starts moving

/** Resolve a menu item's colourway. Falls back to the first if the id is stale. */
const themeOf = (item) =>
  COLORWAYS.find((w) => w.id === item.theme) || COLORWAYS[0];

/** Decode every photo before enabling transitions — five files, worth the wait. */
function preload(urls) {
  return Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve(src);
          img.src = src;
        })
    )
  );
}

export async function mountCarousel({ reducedMotion = false } = {}) {
  const root = document.getElementById('drink-carousel');
  if (!root) return null;

  const track = root.querySelector('.carousel__track');
  const caption = root.querySelector('.carousel__caption');
  const labelList = root.querySelector('.carousel__labels');
  const section = root.closest('.section--menu');
  if (!track || !caption || !labelList || !section) return null;

  // ── markup from data ────────────────────────────────────────────────────
  track.innerHTML = MENU_ITEMS.map(
    (item, i) => `
    <div class="carousel__slide" role="group" aria-roledescription="slide"
         aria-label="${item.name}, ${i + 1} of ${MENU_ITEMS.length}">
      <!-- Explicit dimensions and lazy loading, like every other image below the
           hero. The cut-outs are all the same 1000x1250 frame, so the ratio is
           known ahead of the decode and the stage cannot reflow under the
           carousel as slides come in. The first slide loads eagerly because it is
           the one already on screen — lazy-loading the visible slide would show
           an empty stage until the observer fired. -->
      <img class="carousel__photo" src="${themeOf(item).img}" alt="${item.name}"
           width="1000" height="1250"
           loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async"
           draggable="false" />
    </div>`
  ).join('');

  /* Real buttons, not dots: every drink stays discoverable and reachable by
     keyboard without stepping through the whole carousel. */
  labelList.innerHTML = MENU_ITEMS.map(
    (item, i) => `
    <li>
      <button type="button" class="carousel__label" data-idx="${i}"
        aria-label="Show ${item.name}">${item.label || item.name}</button>
    </li>`
  ).join('');

  const slides = [...track.querySelectorAll('.carousel__slide')];
  const labels = [...labelList.querySelectorAll('.carousel__label')];
  const nameEl = caption.querySelector('.carousel__name');
  const noteEl = caption.querySelector('.carousel__note');
  const priceEl = caption.querySelector('.carousel__price');

  await preload(MENU_ITEMS.map((i) => themeOf(i).img));
  root.classList.add('is-ready'); // unlocks the CSS transitions

  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  const applySlideWidth = () => {
    root.style.setProperty('--slide-pct', (isMobile() ? SLIDE_PCT_MOBILE : SLIDE_PCT) + '%');
  };
  applySlideWidth();

  // ── embla ───────────────────────────────────────────────────────────────
  const embla = EmblaCarousel(root.querySelector('.carousel__viewport'), {
    loop: true, // wrap-around at both ends
    align: 'center', // the stage IS the centre
    skipSnaps: false,
    dragFree: false, // momentum, then snap to a drink
    duration: reducedMotion ? 0 : 26,
    watchDrag: !reducedMotion,
  });

  let current = -1;

  function paint(index) {
    if (index === current) return;
    const first = current === -1;
    current = index;
    const item = MENU_ITEMS[index];
    const theme = themeOf(item);

    /* Exactly one preview per side. Five slides at 30% width means a third and
       fourth would otherwise drift into frame at the edges; anything that is
       not the stage or an immediate neighbour is hidden outright. Modulo, so it
       still holds across the loop seam. */
    const n = slides.length;
    const prev = (index - 1 + n) % n;
    const next = (index + 1) % n;
    slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === index);
      s.classList.toggle('is-peek', i === prev || i === next);
    });
    labels.forEach((b, i) => {
      b.classList.toggle('is-active', i === index);
      // aria-current, not aria-selected: these are buttons, not tabs.
      if (i === index) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });

    /* SECTION-SCOPED theming. These custom properties are set on the section
       element, never on :root — the hero and the global palette must not move
       when someone browses the menu. The 40% blend keeps the page recognisably
       itself while still leaning toward the drink. */
    section.style.setProperty('--menu-bg', theme.plate);
    section.style.setProperty('--menu-accent', theme.swatch);

    const write = () => {
      nameEl.textContent = item.name;
      noteEl.textContent = item.note;
      priceEl.textContent = '$' + item.price;
    };

    if (reducedMotion || first) {
      write();
      gsap.set(caption, { autoAlpha: 1, y: 0 });
      return;
    }

    /* Caption crossfades and re-rises, starting a beat after the photo begins
       moving. One block whose text is swapped at the midpoint, rather than five
       stacked blocks — the descriptions are different lengths, and stacking
       them would force a fixed height that fits the longest. */
    gsap.timeline({ delay: CAPTION_LAG })
      .to(caption, { autoAlpha: 0, y: -10, duration: 0.18, ease: 'power2.in' })
      .add(write)
      .fromTo(caption, { y: 14 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power2.out' });
  }

  embla.on('select', () => paint(embla.selectedScrollSnap()));
  embla.on('reInit', () => {
    applySlideWidth();
    paint(embla.selectedScrollSnap());
  });
  paint(embla.selectedScrollSnap());

  // ── controls ────────────────────────────────────────────────────────────
  labels.forEach((btn) =>
    btn.addEventListener('click', () => embla.scrollTo(+btn.dataset.idx))
  );
  // Clicking a peeking drink advances to it.
  slides.forEach((slide, i) =>
    slide.addEventListener('click', () => {
      if (i !== embla.selectedScrollSnap()) embla.scrollTo(i);
    })
  );

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { embla.scrollNext(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { embla.scrollPrev(); e.preventDefault(); }
  });

  const onResize = () => embla.reInit();
  window.addEventListener('resize', onResize, { passive: true });

  return {
    embla,
    get index() { return current; },
    destroy() {
      window.removeEventListener('resize', onResize);
      embla.destroy();
    },
  };
}
