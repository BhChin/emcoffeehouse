import * as THREE from 'three';
import { Text, preloadFont } from 'troika-three-text';
import { FONTS } from '../config.js';

// Vietnamese needs a lot of stacked diacritics; preloading both faces with the
// exact glyph set we render means no pop-in when a stop comes into view.
export function preloadFonts(characters) {
  return Promise.all(
    [FONTS.grotesque, FONTS.script].map(
      (font) =>
        new Promise((resolve) => {
          preloadFont({ font, characters }, resolve);
        })
    )
  );
}

/**
 * Thin wrapper over troika's Text so every label in the scene gets the same
 * defaults and we can await layout instead of guessing at frame timing.
 */
export function makeText(opts = {}) {
  const t = new Text();
  t.font = opts.script ? FONTS.script : FONTS.grotesque;
  t.text = opts.text ?? '';
  t.fontSize = opts.size ?? 1;
  t.color = opts.color ?? '#F3E7D0';
  t.anchorX = opts.anchorX ?? 'center';
  t.anchorY = opts.anchorY ?? 'middle';
  t.letterSpacing = opts.letterSpacing ?? 0;
  t.lineHeight = opts.lineHeight ?? 1.15;
  // Unlit and outside tone mapping: label colours must stay exactly on-brand
  // regardless of where they sit in the room's light falloff.
  t.material = new THREE.MeshBasicMaterial({
    transparent: true,
    toneMapped: false,
    fog: false,
  });
  if (opts.maxWidth) t.maxWidth = opts.maxWidth;
  if (opts.opacity != null) {
    t.fillOpacity = opts.opacity;
  }
  if (opts.position) t.position.set(...opts.position);
  if (opts.rotation) t.rotation.set(...opts.rotation);
  return t;
}

export function syncText(t) {
  return new Promise((resolve) => t.sync(resolve));
}

// Every glyph the site can render, so preloadFont covers the whole page.
export function collectCharacters(strings) {
  return Array.from(new Set(strings.join('').split(''))).join('');
}
