# Em Coffee House — loud cream landing site

A single-page site for a Vietnamese coffee shop in San Diego, in a loud
studio-site style (imitating a "Buttermax" reference): a flat cream plate
inside a thin dark frame, a full-width grotesque+script wordmark ("Em" in
Archivo Black + "coffee house" in Pacifico), and a 2.5D photo of the drink
floating in front of the type.

Archived in the repo: `legacy/` (immersive dark room), `legacy-editorial/`
(cream/teal Didone editorial), `legacy-3d-cup/` (the modelled paper cup the
photo replaced).

Vite + vanilla JS. GSAP/ScrollTrigger drives the motion; **Three.js is used for
exactly one element** — the drink — and everything else is DOM and CSS.

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
| `index.html` | The whole page structure — hero, menu, about, locations, footer |
| `src/config.js` | Palette, colourways, and all copy (menu items, locations) |
| `src/style.css` | Everything visual except the drink |
| `src/main.js` | Renders data → markup, boots the drink, runs the frame loop |
| `src/drink.js` | The 2.5D drink: bowed plane, shader, cross-fade, framing |
| `src/motion.js` | GSAP intro timeline + all ScrollTrigger scenes |
| `public/fonts/PacificoSLO.json` | Vara stroke data for the written script |
| `public/drink*.png` | Keyed product photos, one per colourway |
| `public/drink-*-liquid-mask.png` | Per-drink ripple masks |
| `public/em-logo.svg` | Brand mark, recoloured to `currentColor` |
| `public/drink-liquid-mask.png` | Ripple mask — white = liquid, black = rigid |
| `scripts/key-drink.mjs` | Background keyer for product-on-white photos |
| `scripts/make-liquid-mask.mjs` | Generates the liquid mask from the cut-out |

## Notes for future edits

**Interaction envelope:** drink yaw ±10° / pitch ±6°, headline counter-parallax 1–2px, shadow drifts a few px *opposite*
the drink. The DOM parallax reads `cup.pointer` — the cup module's already-lerped
value — so the hero moves as one system instead of running two lerps. All of it
sits behind the single `reducedMotion` flag.

**Archivo Black is the display face and it is LATIN-ONLY.** The Vietnamese
drink names (`Cà Phê Sữa Đá`, `Bạc Xỉu`, `Cà Phê Muối`) are set in **Archivo
700**, which does ship a `vietnamese` subset, as does Pacifico (the script).
Never move a drink name into Archivo Black or it renders as tofu — this is the
third typeface generation with the same trap (Archivo Black now; Bodoni Moda
and DM Sans/Poppins before it; only Fraunces, Anton, Archivo, and Pacifico of
the faces this project has used cover Vietnamese).

**An axis not named in the Google Fonts URL is not in the delivered file**, and
`font-variation-settings` against a missing axis fails *silently* — the type
just renders wrong while the CSS looks correct. Verify with a width probe
(render the same string at both axis extremes; the boxes must differ) before
trusting any axis change. Caveat: axes like Fraunces' `WONK` swap glyph shapes
without changing advance widths for most letters, so probe per-glyph, not per-word.

**Wordmark structure:** grotesque `Em` + script `coffee house` on one line,
spanning ~93vw. The script's resting `rotate(-6deg)` lives on the OUTER span;
GSAP only tweens the INNER one (`.wordmark__script-i`) — same two-element split
as the cup shadow, so the transforms can't collide. The hero's `padding-top` is
9vh because Archivo Black's line box carries ~20% leading above the caps at
this size — at 13vh the ink started a quarter of the way down the plate.

**One tween per element per property.** An earlier version paired a `.to` with
an overlapping `.from` on the same `y`, and the tagline and CTA stuck at their
start offsets. `fromTo` with explicit endpoints is the pattern here.

**The contact shadow is DOM, not WebGL** — a blurred ellipse, cheaper and softer
than a shadow map at this size. It is two nested elements on purpose: the
entrance tween owns the outer, the frame loop's bob tracking owns the inner, so
they can never stomp each other. The outer is centred with flex rather than
`translate(-50%)`, because GSAP rewrites that transform and would bake the
offset to a fixed px value that survives resizes.

**Reduced motion is decided in JS, and JS un-hides the cup.** `#cup` and
`.cup-shadow` are `opacity: 0` in CSS purely so the entrance has something to
fade up from. The stylesheet's reduced-motion block also restores them, but
that's a second, independent evaluation of the same preference — if the two
disagree the cup silently vanishes. `revealStatic()` clears the hidden state
from the same flag that skipped the animation.

**Three.js is a lazy chunk.** It's ~600 kB for one decorative element, while the
page's star is the wordmark, so `drink.js` is behind a dynamic `import()` and the
type reveal never waits on it.

**The hero object is a 2.5D photo, not geometry** (`src/drink.js`). A
64×64 `PlaneGeometry` whose vertices are pushed along Z by
`cos((u - 0.5) * PI) * bulge` (bulge = 18% of plane width) — the glass's
roundness is entirely that bow. A `ShaderMaterial` samples the cut-out photo,
offsets the UV by `(depth - 0.5) * uParallax * pointer` for the 2.5D
separation, and cross-fades two textures. Tilt is hard-clamped to ±10° yaw /
±6° pitch — past ~12° the flat photo reads as flat. Bob is 8px over 4s, with
the px→world conversion recomputed in `resize()` so the amplitude stays 8
*pixels* at any viewport. The modelled paper cup it replaced is in
`legacy-3d-cup/`.

The DOM still uses the old `#cup` / `.cup-stage` / `.cup-shadow` names; they
host the drink now. `motion.js` selectors depend on them, so they were left
alone deliberately.

**Alpha handling is premultiplied end to end.** Textures are `NoColorSpace`
and nothing lights the material, so the photo reaches the canvas untouched.
The cross-fade mixes in *premultiplied* space — mixing straight-alpha RGB
drags the transparent side's undefined colour into the edge and fringes it.
`alphaTest` 0.05 is applied as a `discard`.

**`public/drink.png` is a machine-keyed stopgap, not a hand cut.** The supplied
photo had no alpha channel (PNG colorType 2) — the background was never
removed. `scripts/key-drink.mjs` floods the backdrop inward from the border
(connected-component, *not* a global colour key: the foam, lychee and specular
highlights are near-white too and a global key punches holes through them),
ramps alpha across the antialiased edge, decontaminates partial pixels with
`c = (c_obs - bg(1-a))/a` to kill the white fringe, and crops to the subject.
Replace them with proper cuts whenever they exist.

**All five drinks share one plane**, so the keyer normalises every cut to the
same 496x912 (aspect 0.5439) — padding with transparency, never scaling, so
each drink keeps its real proportions. Pass the target aspect as argv[4] and a
downscale width as argv[5]; the raw crops are ~1300px tall for a ~500px render,
which is ~1.3MB each of detail nobody sees. A drink at a different aspect would
stretch, because the plane takes its aspect from the FIRST texture only.

**Each drink carries its own mask.** The foam/ice line differs per drink, so
`mask` travels with `img` in COLORWAYS and is swapped in `setColorway`. Safe to
swap mid-transition because ripples are cleared on switch, so nothing is alive
to see the change.

**The "stir" transition is split across GL and DOM, on purpose.** The brief
called for the whole hero to render through a fullscreen quad with the DOM text
kept underneath for a11y only. That can't work here: the giant Archivo Black +
Pacifico wordmark IS the design, and rendering it into GL means rasterising it
to a ~17 MB texture, rebuilt on every resize, losing subpixel crispness and the
GSAP intro. So:

- **GL half** (`src/drink.js`): the drink canvas composites through the ripple
  shader — two render targets (A = outgoing art, B = incoming), displacement,
  ring highlight, reveal. Both targets carry the *same pose* and differ only in
  texture, so the drink keeps bobbing and tilting mid-transition.
- **DOM half** (`stirPage()` in `main.js`): the incoming plate colour is washed
  across the page by an animated `radial-gradient` painted straight onto
  `.page`, using the same 0.9s ease-out. `--ink` hands off at 40%.

Net effect matches the intent — one wavefront from the click point carrying the
new theme — and the type stays real, crisp and visible rather than being a
hidden a11y shadow.

Details worth keeping:

- **Idle bypasses the composite entirely.** `step()` returns after one direct
  render unless a stir is active; the 3-pass path only runs for 0.9s.
- **The ring highlight is multiplied by alpha.** Unscaled it paints a bright
  arc across the transparent canvas and the stage's rectangular edges show.
- **`uCenter` is routinely outside 0..1** — the chips sit outside the drink's
  canvas, so the wave legitimately enters from off-stage. Don't "fix" it.
- **The stir is NOT skipped when the incoming texture matches the current one.**
  Only `/drink.png` is authored, so every colourway resolves to the same art —
  but the palette still changes and the stir is what carries it.
- **The wash kick-off must not live in `requestAnimationFrame`.**
  `withoutTransition()` already flushes, so the 0px base is committed; setting
  the target synchronously right after is what starts the transition. A rAF
  hand-off silently no-ops wherever rAF is throttled.
- **Reduced motion re-specifies `:root`'s transition in longhand.** The blanket
  `transition-duration: 0.01ms !important` would otherwise snap the theme and
  leave no transition at all; the brief wants a 0.4s colour crossfade, which
  isn't motion. The shorthand form loses — use longhands.

**Liquid ripple wake (`src/drink.js`).** Ported from the reference
preview: emitted ripple POINTS with ages, not an accumulated offset field. An
accumulated field smears the whole photo — glass rim, foam and garnish
included — which is exactly the failure this replaced. Ring buffer of 16,
throttled to one emission per 50ms while the cursor is over the drink AND
moving.

**`public/drink-liquid-mask.png` is what makes it legal.** The offset is
multiplied by the mask, so only the liquid interior moves and the silhouette
stays pixel-rigid. Generated by `scripts/make-liquid-mask.mjs` (erode the
cut-out alpha 6% of width inward, drop the top 18% where foam and garnish sit,
feather 8px). **If the mask fails to load the ripple is disabled entirely** —
running unmasked is worse than running not at all.

At rest every ripple age exceeds `uLife`, the shader loop skips them all, and
the frame is *byte-identical* to the plain photo. That is a regression test
worth keeping: render with `uAmp` forced to 0 and diff — it must be 0 bytes.

Tuning: `uAmp` 0.012 (down from the reference 0.022, since the effect is now
confined to the liquid), crest tint 0.275 (half the reference, the drink is
already bright), and `uLife` 1.2 with 44px spacing — the reference 1.8s/dense
spacing left too many rings lingering after the gesture. `?debug=1` mounts sliders.

There is deliberately **no ambient/whole-hero warp**. An earlier version had a
hero-wide wave sim; it was removed. Rest state must be perfectly still.

**Ripple stutter: it was never frame drops.** `step()` costs 0.009ms
(0.05% of the 16.7ms budget). Three separate causes, all fixed:

1. **The ring buffer was recycled mid-life.** 16 slots x 50ms throttle = 0.8s
   of history against a 1.8s life, so every ring was overwritten at 44% of its
   life while still at 31% amplitude and popped out of existence ~20x/sec.
   RIPPLES is 20 with 44px distance-based spacing, giving ~3.5s of coverage
   against a 1.2s life. **Keep RIPPLES x spacing >= uLife x speed** or the pop
   comes back.
2. **Emission was time-throttled**, so ring spacing scaled with cursor speed
   (measured 13px apart slow, 130px fast). Now distance-based along the
   segment travelled each frame, every 24px, with the remainder carried across
   frames so spacing stays even through a frame boundary. Measured after:
   44px slow vs 35px fast.
3. **pointermove forced a layout every event** via getBoundingClientRect — at
   250Hz+ poll rates. The rect is cached (refreshed on scroll/resize) and the
   handlers now only store x/y; all measurement and emission happens in the
   frame loop. Measured after: 0 rect calls per 60 moves.

**One ticker for the page.** GSAP already runs a rAF loop for the intro and
every ScrollTrigger; the drink used to run a second one, and two loops alias
into visible jitter. `onTick()` in motion.js wraps `gsap.ticker` and everything
rides it. Age advance uses a clamped-then-smoothed dt so one long frame can't
jump every ring's phase at once.

**The hero script writes itself with Vara + Pacifico.** A normal webfont
is filled OUTLINES — there is no centreline to trace, so it can only be wiped
or have its contour drawn. Vara is the exception: its fonts ship each glyph as
ordered pen strokes (ductus). Pacifico is deliberate — it is the script face
the design already uses, so no fourth typeface enters the system.

**Vara draws a SPACE as a literal horizontal bar**, which renders as
"coffee_house". script-write.js suppresses it by SHAPE (flat sliver: height
< 6px and width > 8x height) rather than by index, so it still works if the
text changes. Every letterform is roughly as tall as it is wide, so nothing
else matches. This is a Vara quirk, not a font one — it happened with Satisfy
too.

**Vara wraps to the SVG rendered width**, so the container is deliberately
2400px wide to force one line; the ink is then measured and CSS-scaled to span
"Em" to ~94vw. Never size that container to fit — it will wrap mid-phrase.
Multiple Vara text objects are NOT an option for splitting words: each gets
its own line.

The container is absolutely positioned so the injected SVG can never resize
the h1 (no layout shift), stroke is currentColor so drink colourways recolour
it, and weight lives entirely in `strokeWidth` (3.4) since the glyphs are
strokes, not fills.

**Colourways** live as data in `config.js` (`COLORWAYS`). Each carries an `img`
plus a `plate`/`ink` page palette. Only `/drink.png` is authored; the others
fall back to it and log once (`DRINK_FALLBACK`) — drop a real cut-out at the
named path and it lights up with no code change. `house` deliberately equals
the stylesheet's resting palette. `--plate` and `--ink` are registered with
`@property` so assigning them *interpolates* instead of snapping; an
unregistered custom property is just a token and jumps.

**Dev handle.** In dev only, `window.__em` exposes `{cup, canvas,
reducedMotion}`. `cup.step(dt, elapsed)` runs exactly one frame, so the scene
can be posed deterministically and read back with `gl.readPixels` — useful
where screenshots aren't available. Stripped from production by
`import.meta.env.DEV`.

## `legacy/`

The previous design — an immersive dim room you scrolled *through*, with an
extruded "EM" and a camera walking between four stops — is archived there. It
shares no code with the current site.
