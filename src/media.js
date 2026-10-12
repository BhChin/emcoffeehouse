/**
 * Asset slots, and what stands in when the asset is missing.
 *
 * Every image and video on the site outside the hero goes through here. The
 * point is that a missing asset is a DESIGNED state rather than a broken one:
 * the same clover-on-tint treatment the menu cards already use, plus a visible
 * label naming the file that belongs there. That way an unfinished page still
 * reads as composed, and whoever is sourcing the photography can see exactly
 * which filename each hole wants.
 *
 * Nothing here probes the network to decide. A HEAD request per slot would be a
 * dozen extra round-trips on every load to answer a question the build already
 * knows; instead the caller declares whether it has the asset, and <img> keeps
 * its own onerror as the backstop for a file that is declared but 404s.
 */

/** The brand mark, inline so the placeholder can tint it via currentColor. */
const CLOVER = `<svg viewBox="12 132 117 114" fill="currentColor" aria-hidden="true">
  <path d="m100.9 164.4c-1.5 0-2.72 0.06-3.18 0.22 1.09-9.44-6.54-30.65-25.08-30.65-14.67 0-28.57 11.83-28.93 29.65-0.02 0.63 0.03 1.24 0.07 1.84-15.46-0.38-30.26 10.19-30.26 25.09 0 13.19 11.75 24.61 26.16 24.61 2.24 0 3.97-0.28 5.15-0.57-3.46 11.64 7.16 30.38 24.9 30.38 14.94 0 28.04-13.19 28.04-29.24 0-15.34-10.59-27.7-22.95-36.74 13.1 6.65 25.05 19.01 25.69 36.01 14.26-0.31 26.09-12.51 26.09-25.71 0-13.73-11.57-24.89-25.7-24.89z"/>
</svg>`;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * A placeholder standing in for one asset.
 *
 * `label` is the filename the slot expects — shown, not hidden, because the
 * whole value of this state is telling you what to go and make.
 */
export function placeholder({ label, tint = 'var(--sage)', ratio = '1 / 1', note = '' } = {}) {
  return `<div class="ph" style="--ph-tint:${tint};--ph-ratio:${ratio}" role="img"
       aria-label="Placeholder for ${esc(label)}${note ? ' — ' + esc(note) : ''}">
      <span class="ph__mark">${CLOVER}</span>
      <span class="ph__label">${esc(label)}</span>
      ${note ? `<span class="ph__note">${esc(note)}</span>` : ''}
    </div>`;
}

/**
 * An image slot: the real thing when `src` is given, the placeholder otherwise.
 *
 * width/height are required rather than optional. Without them a lazy image
 * contributes zero height until it decodes and everything below it jumps —
 * exactly the layout shift the grid and the location panels would suffer most.
 */
export function image({ src, alt = '', label, tint, ratio = '1 / 1', w = 800, h = 800 } = {}) {
  if (!src) return placeholder({ label, tint, ratio });
  return `<img class="ph-img" src="${esc(src)}" alt="${esc(alt)}"
       loading="lazy" decoding="async" width="${w}" height="${h}"
       onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ph ph--failed',innerHTML:'${esc(label || src)}'}))" />`;
}

/**
 * A video slot, gated so it never costs anything until its section is close.
 *
 * The src is held in data-src and only promoted to the element once the section
 * approaches: a poster-less autoplay video otherwise starts fetching at page
 * load, which on this page would compete with the 600KB bean model for the same
 * connection. Returns the placeholder markup when there is no asset at all.
 */
export function video({ src, poster, label, ratio = '4 / 5' } = {}) {
  if (!src) return placeholder({ label, ratio, note: 'video slot' });
  return `<video class="ph-img" data-src="${esc(src)}" ${poster ? `poster="${esc(poster)}"` : ''}
       muted loop playsinline preload="none" aria-label="${esc(label || '')}"></video>`;
}

/**
 * Promote ONE video's source, on demand.
 *
 * Separate from armVideos() because the sweetheart layer cannot use an
 * IntersectionObserver: it lives inside the sticky pin stage, which is on screen
 * from the moment the page loads, so an observer would fire immediately and put
 * the clip in direct competition with the 600KB bean model. Its caller arms it
 * from scroll progress instead, as the journey's last chapter approaches.
 */
export function promoteVideo(v, { reducedMotion = false } = {}) {
  if (!v || reducedMotion || v.src || !v.dataset.src) return;
  v.src = v.dataset.src;
  v.play?.().catch(() => {});
}

/**
 * Promote data-src to src when the video's section comes within a screen.
 *
 * Also honours reduced motion by leaving the poster in place and never starting
 * playback — a looping video is motion whether or not anything scrolls.
 */
export function armVideos({ reducedMotion = false, root = document } = {}) {
  /* `root` scopes the sweep. Without it this promotes EVERY data-src video on
     the page, including the sweetheart clip, whose whole point is that it is
     armed from scroll progress rather than by an observer. */
  const vids = [...root.querySelectorAll('video[data-src]')];
  if (!vids.length) return;
  if (reducedMotion) return; // poster only; src is never assigned
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const v = e.target;
        if (!v.src) {
          v.src = v.dataset.src;
          v.play?.().catch(() => {});
        }
        io.unobserve(v);
      }
    },
    { rootMargin: '100% 0px' }
  );
  vids.forEach((v) => io.observe(v));
}
