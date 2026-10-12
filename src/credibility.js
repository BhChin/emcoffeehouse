/**
 * The credibility strip: an announcement banner, a rewards band, and the two
 * footer lines that go with them.
 *
 * NOTHING HERE INVENTS SOCIAL PROOF. No press logos, no "as seen in", no points
 * balance or tier chart for a programme that does not exist yet. The rewards
 * band says plainly that it is launching soon and offers to tell you when — that
 * is the honest version of the same reassurance, and it is the only version that
 * survives an owner being asked about it.
 */

const HELLO = 'hello@emcoffeehouse.com';

/** The announcement bar. One object decides whether it exists and what it says. */
export const BANNER = {
  /* Off. The bar, its copy and its --banner-h plumbing all stay wired: flip
     this back to true and the header offset and the /menu subnav re-stack
     against it automatically. */
  enabled: false,
  text: 'Now pouring in San Jose — 979 Story Road',
  linkText: 'See all locations',
  href: '#locations',
};

/**
 * Publish the banner's height so the header can sit under it.
 *
 * The nav is FIXED and the /menu jump bar pins to var(--nav-h), so both have to
 * know how tall the banner is — and have to stop knowing the moment it is
 * dismissed. Measuring and writing --banner-h keeps one number in one place;
 * every offset downstream is expressed against it, so dismissal is just this
 * function running again with the element gone.
 */
function publishHeight(el) {
  /* The VISIBLE remainder, not the full height. The bar is in flow, so it
     scrolls away — but the header is fixed, and if this kept reporting the full
     height the header would stay parked that far down the page forever, with a
     transparent gap above it long after the bar had gone. Clamping to what is
     still on screen means the header rides the bar down and then closes up
     behind it, and --nav-h (which the /menu subnav pins against) follows. */
  const h = el && el.isConnected
    ? Math.max(0, Math.round(el.getBoundingClientRect().bottom))
    : 0;
  document.documentElement.style.setProperty('--banner-h', h + 'px');
  return h;
}

export function mountBanner({ onResize } = {}) {
  if (!BANNER.enabled) {
    document.documentElement.style.setProperty('--banner-h', '0px');
    return null;
  }
  const el = document.createElement('div');
  el.className = 'banner';
  el.innerHTML = `
    <p class="banner__text">${BANNER.text}
      <a class="banner__link" href="${BANNER.href}">${BANNER.linkText} &rarr;</a>
    </p>
    <button class="banner__x" type="button" aria-label="Dismiss announcement">&times;</button>`;
  document.body.insertAdjacentElement('afterbegin', el);
  publishHeight(el);

  el.querySelector('.banner__x').addEventListener('click', () => {
    /* In memory only, by instruction: no localStorage, no cookie. It comes back
       on the next load, which for a pitch build is the right behaviour — the
       owners should see it every time they open the page. */
    el.remove();
    publishHeight(null);
    onResize?.();
  });

  window.addEventListener('resize', () => { publishHeight(el); onResize?.(); });
  /* Passive, and it only writes one custom property — the header's offset is a
     function of scroll position while the bar is in flow. */
  window.addEventListener('scroll', () => publishHeight(el), { passive: true });
  return el;
}

/** The rewards band, between the moments grid and locations. */
export function mountRewards() {
  /* Anchored AFTER the moments grid, not before Locations. Those sound
     equivalent and are not: the grid is inserted by buildSections, which also
     places itself before Locations — so anchoring this to Locations put the band
     above the grid, in the order rewards -> moments -> locations. Anchor to the
     thing you are supposed to follow, and run after it exists. */
  const moments = document.getElementById('moments');
  const locations = document.querySelector('.section--locations');
  if ((!moments && !locations) || document.querySelector('.rewards')) return null;
  const el = document.createElement('section');
  el.className = 'rewards';
  el.innerHTML = `
    <h2 class="rewards__head">Em Rewards</h2>
    <p class="rewards__line">Earn a little love with every cup — launching soon.</p>
    <a class="rewards__cta" href="mailto:${HELLO}?subject=${encodeURIComponent('Tell me when Em Rewards launches')}">Get notified</a>`;
  if (moments) moments.insertAdjacentElement('afterend', el);
  else locations.insertAdjacentElement('beforebegin', el);
  return el;
}

/** Careers link + a newsletter row in the footer. Nothing else there changes. */
export function extendFooter() {
  const explore = [...document.querySelectorAll('.footer__col')].find(
    (c) => c.querySelector('.footer__label')?.textContent.trim() === 'Explore'
  );
  if (explore && !explore.querySelector('[data-careers]')) {
    const a = document.createElement('a');
    a.className = 'footer__link';
    a.dataset.careers = '';
    a.href = `mailto:${HELLO}?subject=${encodeURIComponent('Careers at Em Coffee House')}`;
    a.textContent = 'Careers';
    explore.appendChild(a);
  }
  const fine = document.querySelector('.footer__fine');
  if (fine && !document.querySelector('.footer__news')) {
    const row = document.createElement('p');
    row.className = 'footer__news';
    row.innerHTML = `Want the slow news? <a class="footer__link" href="mailto:${HELLO}?subject=${encodeURIComponent('Subscribe me to Em news')}">Join the list &rarr;</a>`;
    fine.insertAdjacentElement('beforebegin', row);
  }
}
