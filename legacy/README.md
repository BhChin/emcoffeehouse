# Em Coffee House — immersive 3D landing site

A single-page site where the visitor is *inside* a dim, warm room rather than
scrolling a document. Scrolling walks the camera through four stops; the DOM
overlay (nav, tagline, scroll cue) floats on top of the canvas.

Three.js (vanilla) + Vite. No postprocessing — the vignette is a CSS gradient
and the lamp "bloom" is an additive sprite, which keeps the frame cost flat.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
```

### ⚠️ Where this project lives

The real directory is **`C:\Users\brand\em-coffee-house`**, with a junction at
`The Melt\em-coffee-house` pointing to it — not the other way around.

Vite's dependency optimizer crashes on startup when the project path contains a
space (`TypeError: Cannot read properties of undefined (reading 'imports')`),
and the parent folder "The Melt" has one. Keeping the real path space-free is
the fix. Run npm from either path; symlink resolution lands on the real one.

## Layout

| File | What it does |
| --- | --- |
| `src/config.js` | Palette, fonts, camera stops, and all copy/menu/location data |
| `src/main.js` | Renderer, layout, frame loop, hover raycast, WebGL fallback |
| `src/core/cameraRig.js` | Scroll → stop interpolation, pointer/tilt parallax |
| `src/core/text.js` | troika `Text` defaults + font preloading |
| `src/scene/room.js` | The box room, pendants, and the three-light-per-stop rig |
| `src/scene/wordmark.js` | Extruded "EM" + script overlay |
| `src/scene/phin.js` | Phin filter, glass, looping drip, steam |
| `src/scene/menuWall.js` | Letterboard menu with hover tilt/glow |
| `src/scene/about.js`, `locations.js` | The two text stops |

## Notes for future edits

**Fonts are Anton + Pacifico, not Archivo Black.** Archivo Black's static TTF is
missing the Vietnamese precomposed glyphs the menu depends on — `ữ ạ ỉ ố ế` —
so `Cà Phê Sữa Đá`, `Bạc Xỉu` and `Cà Phê Muối` would render as tofu. Anton
covers the full set. If you swap the display face, check glyph coverage against
every string in `config.js` before shipping.

**The "EM" is hand-drawn geometry, not a font.** `wordmark.js` builds two
straight-edged `THREE.Shape`s and extrudes them, so the hero keeps a real
extruded edge and a heavy *extended* proportion that Anton (condensed) doesn't
have. The letters live in nested groups on purpose: the inner group carries the
recentring offset in letter units, the outer carries the scale. Put both on one
object and the offset goes unscaled, throwing the wordmark off-centre.

**Lighting is three lights per stop**, not one. The pendant alone rakes across
the wordmark's camera-facing surfaces at a grazing angle and leaves them nearly
black; the frontal fill is what makes cream read as cream.

**Accessibility / robustness**

- `prefers-reduced-motion` disables camera drift, parallax, and steam. The
  coffee drip keeps running — it's the one thing the brief keeps alive.
- No WebGL → a static 2D hero with the real location list (`showFallback`).
- The canvas is sized from its own measured box via `ResizeObserver`, and
  `setSize(w, h, false)` leaves the CSS box alone.

**Dev handle.** In dev only, `window.__em` exposes `{renderer, scene, camera,
rig, menu, phin, wordmark, step}`. `step(dt, elapsed)` runs exactly one frame,
which makes the scene testable without relying on `requestAnimationFrame`. It is
stripped from production builds by `import.meta.env.DEV`.
