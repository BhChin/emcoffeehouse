import * as THREE from 'three';
import { COLORWAYS } from './config.js';

/* ── the cup ───────────────────────────────────────────────────────────────
   Stylised, not photoreal: tapered cylinder body, a teal lid built from a
   skirt + torus roll + cap, and a four-light studio rig. No shadow map — the
   contact shadow is a blurred DOM ellipse, which is both cheaper and softer
   than anything a 1024² shadow map would give us at this size.
   ────────────────────────────────────────────────────────────────────────── */

/* Proportions are derived from three ratios rather than typed in directly, so
   the cup can't drift back into a barrel:
     total height  = 2.2 x top diameter
     top radius    = 1.15 x bottom radius
     lid height    = 12% of total height
   Everything below falls out of those. */
const BODY_R_TOP = 1.0;
const BODY_R_BOTTOM = BODY_R_TOP / 1.15; // ~0.870 — a slight taper, not a cone
const TOTAL_H = 2.2 * (BODY_R_TOP * 2); // 4.4
const LID_H = 0.12 * TOTAL_H; // ~0.528
const BODY_H = TOTAL_H - LID_H; // ~3.872

// The lid only just clears the wall — a wide overhang is what made it read as
// a travel-mug cap.
const LID_R = BODY_R_TOP * 1.06;

/* Texture is the cup's unrolled side, so its aspect must match
   circumference : height or the logo shears. */
const TEX_W = 2048;
const TEX_H = Math.round(
  (TEX_W * BODY_H) / (2 * Math.PI * ((BODY_R_TOP + BODY_R_BOTTOM) / 2))
);

/**
 * The brand SVG paints its mark with `currentColor`, which resolves to black
 * when the file is loaded through `new Image()` — there's no CSS context to
 * inherit from. So we fetch the markup ONCE, then bind a colour per colourway
 * and cache the decoded image. Blob URLs are same-origin, so the canvas stays
 * untainted. The interior highlight paths are rebound to pure white so that,
 * after the material's paper tint multiplies the map, they come out exactly
 * paper-coloured.
 */
let svgTextPromise = null;
const logoCache = new Map();

async function logoImage(logoColor) {
  if (logoCache.has(logoColor)) return logoCache.get(logoColor);
  svgTextPromise ??= fetch('/em-logo.svg').then((res) => {
    if (!res.ok) throw new Error(`logo ${res.status}`);
    return res.text();
  });
  const svg = (await svgTextPromise)
    .replace(/currentColor/g, logoColor)
    .replace(/#F3E8D8/gi, '#FFFFFF');

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    logoCache.set(logoColor, img);
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The wrap: ONE canvas + ONE CanvasTexture for the cup's whole lifetime —
 * colourway switches repaint the same pixels and flag `needsUpdate`, so
 * there's no allocation churn on the hot path.
 *
 * The background is painted WHITE, not paper: the body material's `color`
 * multiplies the map, which is what lets the paper tint tween on the GPU
 * without touching the canvas. (The logo pixels get multiplied by paper too —
 * a few percent darkening on colours this dark, invisible in practice.)
 *
 * Logo layout is re-stacked (mark over wordmark) rather than the asset's
 * horizontal lockup, which would read too wide once curved away from the
 * viewer. Source rectangles are in the SVG's intrinsic 250×125 space.
 */
function createWrap() {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext('2d');

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // CylinderGeometry puts u=0 at +Z (facing camera), so a centred logo would
  // land on the back. Offsetting by half a turn brings it round to the front
  // without rotating the mesh, which keeps the tilt maths independent.
  tex.wrapS = THREE.RepeatWrapping;
  tex.offset.x = 0.5;
  tex.anisotropy = 8;

  function repaint(logo) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    if (logo) {
      const cx = TEX_W / 2;
      const markH = 300;
      const markW = markH * (126 / 120);
      const wordW = 360;
      const wordH = wordW * (68 / 102);
      const gap = 38;
      // Sits a touch above centre — matches how a real cup's print clears the
      // rolled base.
      const top = (TEX_H - (markH + gap + wordH)) / 2 - TEX_H * 0.04;

      ctx.drawImage(logo, 8, 4, 126, 120, cx - markW / 2, top, markW, markH);
      ctx.drawImage(logo, 136, 28, 102, 68, cx - wordW / 2, top + markH + gap, wordW, wordH);
    }
    tex.needsUpdate = true;
  }

  return { tex, repaint };
}

function buildCup(wrapTexture, initial) {
  const cup = new THREE.Group();

  // Three materials for the whole cup, created once and MUTATED on colourway
  // switches — never re-created. `paperMap.color` tints the white-background
  // wrap into the paper colour; `paperPlain` covers the unmapped base pieces;
  // every lid mesh shares `lid`.
  const paperMap = new THREE.MeshStandardMaterial({
    color: initial.paper,
    map: wrapTexture,
    roughness: 0.88,
    metalness: 0,
  });
  const paperPlain = new THREE.MeshStandardMaterial({
    color: initial.paper,
    roughness: 0.88,
    metalness: 0,
  });
  const lidMat = new THREE.MeshStandardMaterial({
    color: initial.lid,
    roughness: 0.52,
    metalness: 0,
  });
  const cream = paperMap;
  const creamPlain = paperPlain;
  const teal = lidMat;

  // Body — open-ended so the wrap texture isn't stretched across the caps.
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(BODY_R_TOP, BODY_R_BOTTOM, BODY_H, 96, 1, true),
    cream
  );
  cup.add(body);

  // Base disc, and the slight lip where the paper rolls under.
  const base = new THREE.Mesh(new THREE.CircleGeometry(BODY_R_BOTTOM, 64), creamPlain);
  base.rotation.x = Math.PI / 2;
  base.position.y = -BODY_H / 2;
  cup.add(base);

  const baseRoll = new THREE.Mesh(
    new THREE.TorusGeometry(BODY_R_BOTTOM - 0.02, 0.03, 12, 64),
    creamPlain
  );
  baseRoll.rotation.x = Math.PI / 2;
  baseRoll.position.y = -BODY_H / 2 + 0.02;
  cup.add(baseRoll);

  // Lid — a three-part stack, local y = 0 at the body's rim. Each piece is
  // placed against the top of the one below so the silhouette never breaks.
  const lid = new THREE.Group();
  lid.position.y = BODY_H / 2;

  // Heights are fractions of LID_H so the lid keeps its 12% share whatever the
  // cup's overall proportions become.
  const SKIRT_BOTTOM = -0.05; // grips down over the wall
  const SKIRT_TOP = LID_H * 0.44;
  const RIM_TUBE = 0.045;

  // (a) Short skirt, barely proud of the wall.
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(LID_R, LID_R - 0.03, SKIRT_TOP - SKIRT_BOTTOM, 96, 1, true),
    teal
  );
  skirt.position.y = (SKIRT_BOTTOM + SKIRT_TOP) / 2;
  lid.add(skirt);

  // (b) The rim lip — a torus proud of the skirt, so the lid has a visible edge
  // rather than reading as one solid block of teal.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(LID_R - RIM_TUBE, RIM_TUBE, 16, 96),
    teal
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = SKIRT_TOP;
  lid.add(rim);

  // Closes the ring the rim leaves open, so you can't see down inside the lid.
  const rimFill = new THREE.Mesh(new THREE.CircleGeometry(LID_R - RIM_TUBE, 64), teal);
  rimFill.rotation.x = -Math.PI / 2;
  rimFill.position.y = SKIRT_TOP;
  lid.add(rimFill);

  // (c) Smaller raised cylinder — the sip-lid dome. Capped, not open-ended.
  const dome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.66, 0.74, LID_H - SKIRT_TOP, 64),
    teal
  );
  dome.position.y = (SKIRT_TOP + LID_H) / 2;
  lid.add(dome);

  cup.add(lid);
  return { cup, mats: { paperMap, paperPlain, lidMat } };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ reducedMotion: boolean }} opts
 * @returns {Promise<object|null>} null when WebGL is unavailable
 */
export async function createCup(canvas, { reducedMotion }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    if (!renderer.getContext()) return null;
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // No tone mapping: the look is flat and graphic, and ACES visibly pulls the
  // brand cream toward yellow and the teal toward grey.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();

  // Long-ish lens, product-shot framing — a wide fov splays the cup's sides.
  // Position and aim are both set in resize(), which runs before first paint.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const initial = COLORWAYS[0];
  const wrap = createWrap();
  try {
    wrap.repaint(await logoImage(initial.logo));
  } catch (err) {
    // A blank paper cup is a perfectly acceptable degradation.
    console.warn('[em] logo texture unavailable, using plain wrap', err);
    wrap.repaint(null);
  }

  const { cup, mats } = buildCup(wrap.tex, initial);

  // The tilt the cup rests at; pointer tracking and the bob are added on top of
  // this, never assigned over it.
  const REST_X = 0.13;
  // ~12° clockwise as seen by the viewer (negative z rotates clockwise about +Z).
  const REST_Z = -THREE.MathUtils.degToRad(12);
  cup.rotation.set(REST_X, 0, REST_Z);

  // Outer group carries the entrance slide so the inner rotations stay clean.
  const rig = new THREE.Group();
  rig.add(cup);
  scene.add(rig);

  // ── studio rig ──────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  scene.add(new THREE.HemisphereLight(0xfff6e9, 0xd8c4ac, 0.75));

  const key = new THREE.DirectionalLight(0xfffaf0, 1.55);
  key.position.set(-3.2, 4.5, 4.2);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(4.5, 0.6, 3);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(1.8, 2.4, -4);
  scene.add(rim);

  // ── pointer ─────────────────────────────────────────────────────────────
  // Normalised to the viewport, not the canvas: the cup should react to the
  // cursor anywhere on the hero, not only when it's over the small canvas box.
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };

  function onPointerMove(e) {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
  }
  if (!reducedMotion) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  }

  // ── resize ──────────────────────────────────────────────────────────────

  // Half-extents of the tilted cup, with a little air. Driving the dolly off
  // these rather than a magic z keeps the framing identical from a tall desktop
  // column to a short mobile band — the cup fills its stage either way.
  // A point (x, y) on the cup lands at x' = x·cos12° + y·sin12°, which puts the
  // extremes at the lid rim (x' ≈ +1.37) and the base's low corner (x' ≈ -0.98).
  // So the shape spans ~1.18 either side of x' ≈ 0.19 — not either side of the
  // axis, which is what LOOK_X below corrects for.
  const FIT_H = 2.62; // half-height incl. the bob and the pointer's x-tilt
  const FIT_W = 1.42; // half-width once LOOK_X has recentred the silhouette
  const MARGIN = 1.08;
  // Aims slightly *below* the cup's midpoint, which lifts it in frame and
  // leaves the bottom of the stage clear for the contact shadow — a floating
  // cup that sits on the shadow reads as standing on it.
  const LOOK_Y = 0.1;
  // Eye and target shift together — a pure lateral dolly, which recentres the
  // tilted cup without skewing the perspective.
  const LOOK_X = 0.12;

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const aspect = w / h;
    camera.aspect = aspect;

    // Fit whichever axis is tighter.
    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const zForHeight = FIT_H / Math.tan(halfFov);
    const zForWidth = FIT_W / (Math.tan(halfFov) * aspect);
    camera.position.set(LOOK_X, 0.5, Math.max(zForHeight, zForWidth) * MARGIN);
    // Re-aim every time: moving the camera without this swings the framing,
    // because the eye sits slightly above the point it looks at.
    camera.lookAt(LOOK_X, LOOK_Y, 0);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // `false` — the stylesheet owns the CSS box; never write inline dimensions.
    renderer.setSize(w, h, false);
    // Repaint immediately: under reduced motion there's no frame loop running
    // to pick the new size up, so the canvas would otherwise go blank.
    renderer.render(scene, camera);
  }
  resize();
  new ResizeObserver(resize).observe(canvas);

  // ── colourways ──────────────────────────────────────────────────────────
  const SPIN_DUR = 0.7;
  const TWEEN_DUR = 0.5;
  const easeOutCubic = (t) => 1 - (1 - t) ** 3;

  // Timed lerps (not per-frame exponential): a switch must *arrive*, and two
  // quick switches must restart cleanly from whatever colour is on screen.
  const cw = {
    t: 1, // colour tween progress
    fromLid: new THREE.Color(initial.lid),
    toLid: new THREE.Color(initial.lid),
    fromPaper: new THREE.Color(initial.paper),
    toPaper: new THREE.Color(initial.paper),
    spinT: 1, // spin progress; 1 = idle
    pendingImg: null, // decoded logo waiting for mid-spin to swap in
  };

  async function setColorway(way) {
    cw.fromLid.copy(mats.lidMat.color);
    cw.fromPaper.copy(mats.paperMap.color);
    cw.toLid.set(way.lid);
    cw.toPaper.set(way.paper);
    cw.t = 0;
    cw.spinT = reducedMotion ? 1 : 0;

    let img = null;
    try {
      img = await logoImage(way.logo);
    } catch {
      /* keep whatever print is on the cup */
    }
    if (reducedMotion) {
      // No frame loop is running: snap everything and paint one frame.
      if (img) wrap.repaint(img);
      cw.t = 1;
      mats.lidMat.color.copy(cw.toLid);
      mats.paperMap.color.copy(cw.toPaper);
      mats.paperPlain.color.copy(cw.toPaper);
      renderer.render(scene, camera);
    } else if (img) {
      // Swapped by step() once the spin has the logo facing away.
      cw.pendingImg = img;
    }
  }

  // ── frame ───────────────────────────────────────────────────────────────
  const BOB_AMPLITUDE = 0.11;
  let bob = 0;
  let spinOffset = 0;

  function step(dt, elapsed) {
    if (!reducedMotion) {
      bob = Math.sin(elapsed * 0.75) * BOB_AMPLITUDE;
      cup.position.y = bob;

      // Frame-rate independent lerp: the 1-(1-k)^(dt*60) form keeps the same
      // settling time at 144Hz as at 60Hz.
      const k = 1 - (1 - 0.055) ** (dt * 60);
      pointer.x += (target.x - pointer.x) * k;
      pointer.y += (target.y - pointer.y) * k;

      // Colourway spin: a full ease-out turn stacked on top of the pointer
      // yaw. At completion the offset is exactly 2π ≡ 0, so resetting to idle
      // is invisible.
      if (cw.spinT < 1) {
        cw.spinT = Math.min(cw.spinT + dt / SPIN_DUR, 1);
        spinOffset = easeOutCubic(cw.spinT) * Math.PI * 2;
        if (cw.spinT >= 1) spinOffset = 0;
      }

      // The print swap hides inside the spin — once the cup has turned far
      // enough that the logo faces away, repainting is invisible.
      if (cw.pendingImg && cw.spinT >= 0.25) {
        wrap.repaint(cw.pendingImg);
        cw.pendingImg = null;
      }

      // Refined, not showy: ±7° yaw at full cursor throw, half that in pitch,
      // and a translation of a few px — the brief's 5–8° envelope.
      cup.rotation.y = pointer.x * 0.122 + spinOffset; // ≈ ±7° + spin
      cup.rotation.x = REST_X + pointer.y * 0.06;
      cup.rotation.z = REST_Z + Math.sin(elapsed * 0.53) * 0.022;
      cup.position.x = pointer.x * 0.05;
    }

    // Colour tween runs even at dt=0 renders so a mid-tween resize stays true.
    if (cw.t < 1) {
      cw.t = Math.min(cw.t + dt / TWEEN_DUR, 1);
      const e = easeOutCubic(cw.t);
      mats.lidMat.color.copy(cw.fromLid).lerp(cw.toLid, e);
      mats.paperMap.color.copy(cw.fromPaper).lerp(cw.toPaper, e);
      mats.paperPlain.color.copy(mats.paperMap.color);
    }

    renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    rig,
    cup,
    mats,
    step,
    setColorway,
    /** 0 at the bottom of the bob, 1 at the top — drives the DOM shadow. */
    get bobNorm() {
      return (bob / BOB_AMPLITUDE + 1) / 2;
    },
    /** The lerped pointer, -1…1 — the DOM parallax reads this so the whole
        hero settles on one shared value instead of running two lerps. */
    get pointer() {
      return { x: pointer.x, y: pointer.y };
    },
    dispose() {
      window.removeEventListener('pointermove', onPointerMove);
      renderer.dispose();
    },
  };
}
