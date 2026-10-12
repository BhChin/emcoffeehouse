import { LOCATIONS, STOPS } from '../config.js';

/**
 * Everything that lives in the DOM on top of the canvas: nav pills, the scroll
 * cue, the loader, and the no-WebGL fallback.
 */
export function createOverlay({ onStop }) {
  const loader = document.getElementById('loader');
  const cue = document.getElementById('cue');
  const pills = Array.from(document.querySelectorAll('[data-stop]'));

  pills.forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      onStop(Number(el.dataset.stop));
    });
  });

  function setActiveStop(index) {
    const nearest = Math.round(index);
    pills.forEach((el) => {
      const isCurrent = Number(el.dataset.stop) === nearest && nearest > 0;
      if (el.classList.contains('pill')) {
        el.setAttribute('aria-current', String(isCurrent));
      }
    });
  }

  function hideCue() {
    cue.classList.add('cue--hidden');
  }

  function hideLoader() {
    loader.classList.add('loader--done');
    // Drop it from the tree once the fade finishes so it can't trap clicks.
    setTimeout(() => loader.remove(), 800);
  }

  return { setActiveStop, hideCue, hideLoader, stopCount: STOPS.length };
}

/** Swap the canvas for a static 2D hero when WebGL can't start. */
export function showFallback() {
  document.getElementById('loader')?.remove();
  document.getElementById('scene')?.remove();
  document.getElementById('overlay')?.remove();

  const list = document.getElementById('fallback-locations');
  for (const loc of LOCATIONS) {
    const li = document.createElement('li');
    li.textContent = `${loc.city} — ${loc.address}`;
    list.appendChild(li);
  }
  document.getElementById('fallback').hidden = false;
}
