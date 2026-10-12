import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { MENU_CATEGORIES } from './menu-data.js';
import { placeholder } from './media.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * The category deck — the homepage's whole product area.
 *
 * It replaces BOTH the signatures carousel and the two standalone drink panels.
 * Those two were the defect: a carousel of five drinks followed immediately by
 * two full-bleed panels for two of those same five, so the page sold the same
 * product twice in two different visual languages and neither one led anywhere.
 * This says the same thing once, in the panels' language, and every card is a
 * door into the real menu.
 *
 * THE CARDS ARE CATEGORIES, NOT DRINKS, and that is what makes the section
 * finite: drinks change weekly and there are forty of them; the six categories
 * are the shape of the menu and they map one-to-one onto anchors that already
 * exist on menu.html.
 *
 * THE STACK IS `position: sticky`, NOT ScrollTrigger pinning. Six pinned
 * elements would mean six pin-spacers, six z-index stacking contexts and a
 * release at the end that has to be nursed — the exact class of bug the hero's
 * stage gave up pinning to avoid. Sticky costs nothing, releases itself when the
 * deck's own box ends, and the only thing left for a ScrollTrigger to do is the
 * cheap part: scrub the covered card's scale and dim. See .deck in style.css.
 */

/* One card per category. `cat` is the id of a real section on menu.html, so the
   Explore link lands on a heading that exists rather than on a guess.
   `cut` reuses a cut-out the site already ships; `pastry` has none, so it takes
   the shared placeholder and shows which file it is waiting for. */
const CARDS = [
  {
    cat: 'signature',
    eyebrow: 'The house pour',
    line: 'Four minutes, then ice.',
    body: 'Viet phin coffee under a cap of house cream — banana toffee, pandan coconut, egg brulee. The drink the shop is named for, in six variations.',
    cut: '/drink-egg.png',
  },
  {
    cat: 'ceremonial-matcha',
    eyebrow: 'Ceremonial matcha',
    line: 'Green, but make it Đà Lạt.',
    body: 'Ceremonial grade, whisked to order, then taken somewhere: ube, pandan, brown sugar, strawberry. Grassy and round rather than sweet.',
    cut: '/drink-matcha.png',
  },
  {
    cat: 'viet-phin',
    eyebrow: 'Viet phin drip',
    line: 'The filter does not hurry.',
    body: 'Dark roast robusta, dripped a drop at a time over condensed milk. Black, milked, or salted — the oldest thing on the menu and still the best argument for it.',
    cut: '/drink-suada.png',
  },
  {
    cat: 'espresso',
    eyebrow: 'Espresso',
    line: 'Short, dark, and honest.',
    body: 'The European half of the bar. Pulled on its own, cut with milk, or poured long over ice for the afternoon.',
    cut: '/drink-muoi.png',
  },
  {
    cat: 'tea',
    eyebrow: 'Tea refreshers',
    line: 'Fruit, ice, and nothing to prove.',
    body: 'Cold, bright and caffeine-light: passionfruit, lychee, peach and jasmine, shaken over ice for the days coffee is not the answer.',
    cut: '/drink.png',
  },
  {
    cat: 'pastry',
    eyebrow: 'Pastry & bites',
    line: 'Something to hold.',
    body: 'Bánh mì, croissants, pandan waffles and honeycomb cake — baked for the hour you actually sit down.',
    cut: null, // no cut-out exists; the shared placeholder names the file
    cutLabel: 'pastry-01.png',
  },
];

/** The category's own tint, mixed into cream. Static: resolved once, per card. */
const groundFor = (tint) => `color-mix(in srgb, ${tint} 22%, var(--cream))`;

function cardHtml(card, i) {
  const cat = MENU_CATEGORIES.find((c) => c.id === card.cat);
  if (!cat) return '';
  const art = card.cut
    ? `<img class="deckcard__cut" src="${card.cut}" alt="${cat.name}"
           width="1000" height="1250" loading="lazy" decoding="async" />`
    : placeholder({ label: card.cutLabel, tint: cat.tint, ratio: '4 / 5' });
  return `
  <article class="deckcard deckcard--${i % 2 ? 'mirror' : 'normal'}"
           style="--deck-ground:${groundFor(cat.tint)}; z-index:${10 + i}">
    <div class="deckcard__in">
      <div class="deckcard__art">
        ${art}
        <span class="deckcard__shadow" aria-hidden="true"></span>
      </div>
      <div class="deckcard__copy">
        <p class="deckcard__eyebrow">${card.eyebrow}</p>
        <h3 class="deckcard__line">${card.line}</h3>
        <p class="deckcard__body">${card.body}</p>
        <a class="deckcard__more" href="/menu.html#${cat.id}">Explore &rarr;</a>
      </div>
    </div>
  </article>`;
}

export function buildDeck({ reducedMotion = false } = {}) {
  const host = document.querySelector('.deck');
  /* Guarded on the card class this function creates — NOT on anything generic.
     The preloader ships its own `.panel` elements, and the previous version of
     this section guarded on that name and silently lost its race with the
     loading overlay. */
  if (!host || host.querySelector('.deckcard')) return;

  host.innerHTML = `
    <header class="section__head deck__head">
      <p class="eyebrow">The menu</p>
      <h2 class="section__title">Poured slow</h2>
    </header>
    <div class="deck__stack">${CARDS.map(cardHtml).join('')}</div>`;

  const cards = [...host.querySelectorAll('.deckcard')];

  if (reducedMotion) {
    /* A plain vertical stack: the sticky behaviour is switched off in CSS, and
       there is nothing to scrub, so this branch only has to not build tweens. */
    host.classList.add('is-static');
    return;
  }

  /* Each card dims and shrinks as the NEXT one climbs over it. The trigger is
     the covering card, so the scrub is driven by the thing actually doing the
     covering — start when its top reaches the bottom of the viewport, end when
     it has fully taken the screen. */
  for (let i = 0; i < cards.length - 1; i++) {
    gsap.fromTo(
      cards[i],
      { scale: 1, filter: 'brightness(1)' },
      {
        scale: 0.96,
        filter: 'brightness(0.92)',
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: cards[i + 1],
          start: 'top bottom',
          end: 'top top',
          scrub: 0.4,
          invalidateOnRefresh: true,
        },
      }
    );
  }
}
