import * as THREE from 'three';
import { COLORWAYS, DRINK_FALLBACK, defaultColorway } from './config.js';

/* ── the 2.5D drink ────────────────────────────────────────────────────────
   A product photo on a plane that bows toward the camera, not a modelled
   glass. The roundness comes from the geometry (cosine bulge across u); the
   depth cue comes from a UV parallax offset driven by the cursor.
   ────────────────────────────────────────────────────────────────────────── */

const SEG = 64;
const PLANE_H = 2.0;
const BULGE_RATIO = 0.18; // of plane WIDTH, per the brief

// Tilt envelope. Past ~12° the flat photo reads as a flat photo, so these are
// hard ceilings, not suggestions.
const MAX_YAW = THREE.MathUtils.degToRad(10);
const MAX_PITCH = THREE.MathUtils.degToRad(6);
const LERP = 0.06;

const BOB_PX = 8;
const BOB_PERIOD = 4;
const FADE_DUR = 0.4; // reduced-motion / no-shader crossfade
const STIR_DUR = 0.9;

const easeOutCubic = (t) => 1 - (1 - t) ** 3;


const VERT = /* glsl */ `
  uniform float uBulge;
  varying vec2 vUv;
  varying float vBow;
  void main() {
    vUv = uv;
    // cos((u - 0.5) * PI): 1 at the horizontal centre, 0 at both edges — the
    // plane bows toward the camera exactly where a cylinder's belly would be.
    float bow = cos((uv.x - 0.5) * 3.141592653589793);
    vBow = bow;
    vec3 p = position;
    p.z += bow * uBulge;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

/* INVARIANT: RIPPLES x EMIT_SPACING_PX / dragSpeed must stay >= uLife, or
   rings get recycled while still bright and pop out of existence (the original
   stutter). At 44px spacing, 20 slots cover 880px of travel — 3.5s at a normal
   ~250px/s drag, comfortably past the 1.2s life, and still clean up to
   ~730px/s. Faster swipes do recycle, but those rings trail far behind the
   cursor. 20 iterations also costs the fragment loop a third less than 32. */
const RIPPLES = 20;
// Distance, not time. A time throttle makes ring spacing scale with cursor
// speed (measured: 13px apart when slow, 130px when fast), which is what read
// as "steppy" — fast strokes became separated beads.
const EMIT_SPACING_PX = 44;
const MAX_EMITS_PER_FRAME = 3;

/* Ripple wake, ported from the reference preview: expanding sin rings with an
   exp() distance falloff and a squared age fade. Emitted points with ages —
   NOT an accumulated offset field, which smeared the whole photo.

   The mask is the load-bearing part. Multiplying the offset by it means the
   glass silhouette, rim, foam and garnish stay pixel-rigid while only the
   liquid interior moves. At rest every age exceeds uLife, off stays exactly
   zero, and the sample point is bit-identical to the plain photo. */
const FRAG = /* glsl */ `
  #define RIPPLES ${RIPPLES}
  uniform sampler2D uMapA;
  uniform sampler2D uMapB;
  uniform sampler2D uDepth;
  uniform sampler2D uMask;
  uniform float uHasMask;
  uniform vec3 uRipple[RIPPLES];   // xy = origin (uv), z = age (s)
  uniform float uAmp;
  uniform float uFreq;
  uniform float uLife;
  uniform float uAspect;
  uniform float uTint;
  uniform float uHasDepth;
  uniform float uMix;
  uniform vec2 uParallax;
  uniform float uAlphaTest;
  varying vec2 vUv;
  varying float vBow;

  void main() {
    // Real depth map when supplied, otherwise the analytic cylinder the
    // geometry already uses — the near belly shifts, the receding edges don't.
    float d = uHasDepth > 0.5 ? texture2D(uDepth, vUv).r : (vBow * 0.5 + 0.5);
    vec2 uv = vUv + (d - 0.5) * uParallax;

    vec2 off = vec2(0.0);
    for (int i = 0; i < RIPPLES; i++) {
      float age = uRipple[i].z;
      if (age >= uLife) continue;
      vec2 v = vUv - uRipple[i].xy;
      vec2 va = v * vec2(uAspect, 1.0);
      float dist = length(va);
      if (dist > 0.5) continue;
      float fade = 1.0 - age / uLife;
      float w = sin(dist * uFreq - age * 7.0) * exp(-dist * 9.0) * fade * fade;
      off += normalize(v + vec2(0.0001)) * w;
    }

    float mask = uHasMask > 0.5 ? texture2D(uMask, vUv).r : 0.0;
    uv += off * uAmp * mask;

    vec4 a = texture2D(uMapA, uv);
    vec4 b = texture2D(uMapB, uv);
    // Cross-fade in PREMULTIPLIED space. Mixing straight-alpha RGB pulls the
    // transparent side's (undefined) colour into the edge and fringes it.
    vec3 pm = mix(a.rgb * a.a, b.rgb * b.a, uMix);
    float al = mix(a.a, b.a, uMix);

    if (al < uAlphaTest) discard;

    // Crest highlight, also masked so it can never light the rim or garnish.
    float sh = clamp(length(off) * 0.55, 0.0, 0.22) * mask;
    pm = pm * (1.0 - sh) + vec3(1.0, 0.98, 0.94) * sh * uTint * al;

    // Textures are NoColorSpace and nothing lights this material, so the photo
    // passes through untouched — what is in the PNG is what reaches the canvas.
    gl_FragColor = vec4(pm, al);
  }
`;

/* ── the stir composite ───────────────────────────────────────────────────
   A wavefront expands from the click point; the incoming drink is revealed
   behind it, and pixels near the front are pushed radially so the reveal
   reads as liquid rather than a wipe. Only runs during a transition — idle
   frames bypass this pass entirely and draw the drink straight to screen.

   Everything here is PREMULTIPLIED: the render targets hold premultiplied
   RGBA (the drink material outputs it), so the mixes below operate on
   premultiplied values and the result stays premultiplied. */
const STIR_FRAG = /* glsl */ `
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform vec2 uCenter;
  uniform float uProgress;
  uniform float uAspect;
  varying vec2 vUv;

  void main() {
    float d = distance((vUv - uCenter) * vec2(uAspect, 1.0), vec2(0.0));

    float radius = uProgress * 1.5;
    float band = 0.14;
    float wave = smoothstep(radius, radius - band, d)
               - smoothstep(radius - band, radius - band * 2.0, d);

    // Displacement dies out as the stir completes, so the drink settles
    // exactly on its undisplaced pose rather than snapping back.
    vec2 dir = normalize(vUv - uCenter + 0.0001);
    vec2 uv = vUv + dir * wave * 0.045 * (1.0 - uProgress);

    vec4 a = texture2D(uTexA, uv);
    vec4 b = texture2D(uTexB, uv);
    float reveal = smoothstep(radius, radius - band, d);

    vec3 pm = mix(a.rgb, b.rgb, reveal);
    float al = mix(a.a, b.a, reveal);

    // The ring is scaled by alpha so the highlight only lights the drink.
    // Unscaled it would paint a bright rectangle-clipped arc across the
    // transparent canvas, and the stage's box edges would show.
    pm += vec3(1.0, 0.97, 0.92) * wave * 0.10 * al;

    gl_FragColor = vec4(pm, al);
  }
`;

const STIR_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Decode-before-show: the caller awaits this, so nothing can pop in. */
function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = 8;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        // The photo must never wrap: a parallax offset at the edge would
        // otherwise pull the opposite side of the glass into frame.
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ reducedMotion: boolean }} opts
 * @returns {Promise<object|null>} null when WebGL is unavailable
 */
export async function createDrink(canvas, { reducedMotion }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    if (!renderer.getContext()) return null;
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  // Long lens: near-orthographic so the photo isn't perspective-warped, but
  // with enough projection that the tilt still foreshortens convincingly.
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);

  // ── textures ────────────────────────────────────────────────────────────
  const texCache = new Map();
  const missing = new Set();

  async function textureFor(way) {
    const url = missing.has(way.img) ? DRINK_FALLBACK : way.img;
    if (texCache.has(url)) return texCache.get(url);
    try {
      const tex = await loadTexture(url);
      texCache.set(url, tex);
      return tex;
    } catch {
      // Not authored yet — remember, so we only 404 once per colourway.
      missing.add(way.img);
      if (url !== DRINK_FALLBACK) {
        console.info(`[em] no art for ${way.id} (${way.img}) — using ${DRINK_FALLBACK}`);
        return textureFor(way);
      }
      return null;
    }
  }

  const initial = defaultColorway();
  const firstTex = await textureFor(initial);
  if (!firstTex) {
    console.warn('[em] drink art failed to load');
    renderer.dispose();
    return null;
  }

  // Optional depth map — absent by design today; the shader falls back to the
  // analytic cylinder.
  let depthTex = null;
  try {
    depthTex = await loadTexture('/drink-depth.png');
  } catch {
    /* procedural fallback */
  }

  // Liquid mask, per drink — each has its own foam/ice line, so the mask has
  // to travel with the photo. Without one the ripple is disabled entirely:
  // warping the rim and garnish is exactly the failure this replaces.
  const maskCache = new Map();
  const maskMissing = new Set();

  async function maskFor(way) {
    const url = maskMissing.has(way.mask) ? COLORWAYS[0].mask : way.mask;
    if (maskCache.has(url)) return maskCache.get(url);
    try {
      const tex = await loadTexture(url);
      maskCache.set(url, tex);
      return tex;
    } catch {
      maskMissing.add(way.mask);
      if (url !== COLORWAYS[0].mask) {
        console.info(`[em] no liquid mask for ${way.id} — using the house mask`);
        return maskFor(way);
      }
      console.warn('[em] no liquid mask at all — ripple disabled to protect the glass edges');
      return null;
    }
  }

  let maskTex = await maskFor(initial);

  const img = firstTex.image;
  const aspect = img.width / img.height;
  const PLANE_W = PLANE_H * aspect;
  const BULGE = PLANE_W * BULGE_RATIO;

  const uniforms = {
    uMapA: { value: firstTex },
    uMapB: { value: firstTex },
    uDepth: { value: depthTex ?? firstTex },
    uHasDepth: { value: depthTex ? 1 : 0 },
    uMix: { value: 0 },
    uParallax: { value: new THREE.Vector2(0, 0) },
    uAlphaTest: { value: 0.05 },
    uBulge: { value: BULGE },
    uMask: { value: null },
    uHasMask: { value: 0 },
    // Reference values, with amp scaled down because the effect is now
    // confined to the liquid instead of covering a whole flat wordmark.
    uRipple: { value: Array.from({ length: RIPPLES }, () => new THREE.Vector3(0, 0, 999)) },
    uAmp: { value: 0.012 },
    uFreq: { value: 30 },
    // Short enough that the wake dies with the gesture rather than lingering.
    uLife: { value: 1.2 },
    uTint: { value: 0.275 }, // half the reference's 0.55 — the drink is bright
    uAspect: { value: aspect },
  };

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PLANE_W, PLANE_H, SEG, SEG),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.FrontSide,
    })
  );

  const cup = new THREE.Group(); // named for the DOM/API it already feeds
  cup.add(mesh);
  const rig = new THREE.Group();
  rig.add(cup);
  // The canvas spans the whole hero (so the ambient wave has a surface to
  // refract), but the drink must still land inside .cup-stage. `placement`
  // carries that offset; `rig` stays free for the entrance tween.
  const placement = new THREE.Group();
  placement.add(rig);
  scene.add(placement);

  uniforms.uMask.value = maskTex;
  uniforms.uHasMask.value = maskTex && !reducedMotion ? 1 : 0;

  // ── ripple wake ─────────────────────────────────────────────────────────
  const ripples = uniforms.uRipple.value;
  let ripHead = 0;


  /** Age every ripple past uLife so the next frame is exactly the rest state. */
  function clearRipples() {
    for (const r of ripples) r.z = 999;
  }
  clearRipples();

  // Decode every colourway's art up front. A stir must never begin against an
  // undecoded texture — the wavefront would reveal an empty target.
  const preloaded = Promise.all(COLORWAYS.map((w) => textureFor(w)));

  // ── stir composite ──────────────────────────────────────────────────────
  // Two targets, allocated once and reused; only a resize rebuilds them.
  const rtOpts = { format: THREE.RGBAFormat, type: THREE.UnsignedByteType, depthBuffer: false };
  let rtA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(1, 1, rtOpts);

  const stirUniforms = {
    uTexA: { value: rtA.texture },
    uTexB: { value: rtB.texture },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uProgress: { value: 0 },
    uAspect: { value: 1 },
  };
  const stirScene = new THREE.Scene();
  const stirCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  stirScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: stirUniforms,
        vertexShader: STIR_VERT,
        fragmentShader: STIR_FRAG,
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
      })
    )
  );

  const stir = { active: false, t: 0, texB: null, onDone: null };

  // ── input ───────────────────────────────────────────────────────────────
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const rangeScale = coarse ? 0.5 : 1; // brief: halve the tilt on mobile
  const pointer = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let tiltEnabled = !reducedMotion;

  // ── liquid input ────────────────────────────────────────────────────────
  // The pointer handlers ONLY store coordinates. Reading layout in a
  // pointermove handler forces a reflow at the mouse's poll rate — 250Hz+ on a
  // gaming mouse — so the rect is cached and every measurement happens in the
  // frame loop instead.
  const ptr = { x: 0, y: 0, has: false };
  const trail = { x: 0, y: 0, has: false, carry: 0 };
  let canvasRect = canvas.getBoundingClientRect();
  const refreshRect = () => { canvasRect = canvas.getBoundingClientRect(); };
  window.addEventListener('scroll', refreshRect, { passive: true });
  window.addEventListener('resize', refreshRect, { passive: true });

  function noteLiquidPointer(clientX, clientY) {
    ptr.x = clientX;
    ptr.y = clientY;
    ptr.has = true;
  }

  /** @returns true if the point was inside the drink and a ripple was laid. */
  function emitAtClient(clientX, clientY) {
    const sx = (clientX - canvasRect.left) / canvasRect.width;
    const sy = (clientY - canvasRect.top) / canvasRect.height;
    if (sx < stageUV.x || sx > stageUV.x + stageUV.w) return false;
    if (sy < stageUV.y || sy > stageUV.y + stageUV.h) return false;
    // Stage-local -> plane UV. The plane only fills 1/MARGIN of the stage, so
    // the pointer has to be scaled about the centre or ripples land offset.
    const u = ((sx - stageUV.x) / stageUV.w - 0.5) * MARGIN + 0.5;
    const v = 1 - (((sy - stageUV.y) / stageUV.h - 0.5) * MARGIN + 0.5);
    ripples[ripHead].set(u, v, 0);
    ripHead = (ripHead + 1) % RIPPLES;
    return true;
  }

  /** Lay ripples along the segment travelled since last frame, spaced by
      DISTANCE. The leftover is carried across frames so spacing stays even
      through a frame boundary instead of restarting each frame. */
  function emitAlongTrail() {
    if (!maskTex || reducedMotion || !visible || !ptr.has) return;
    if (!trail.has) {
      trail.x = ptr.x; trail.y = ptr.y; trail.has = true; trail.carry = 0;
      return;
    }
    const dx = ptr.x - trail.x;
    const dy = ptr.y - trail.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return; // stationary: no ripple, rest state stays still

    const ux = dx / dist;
    const uy = dy / dist;
    let d = EMIT_SPACING_PX - trail.carry;
    let emits = 0;
    while (d <= dist && emits < MAX_EMITS_PER_FRAME) {
      emitAtClient(trail.x + ux * d, trail.y + uy * d);
      emits++;
      d += EMIT_SPACING_PX;
    }
    trail.carry = emits ? dist - (d - EMIT_SPACING_PX) : trail.carry + dist;
    trail.x = ptr.x;
    trail.y = ptr.y;
  }

  function onPointerMove(e) {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
    noteLiquidPointer(e.clientX, e.clientY);
  }
  function onOrient(e) {
    if (e.gamma == null || e.beta == null) return;
    // gamma: left/right tilt, beta: front/back. Clamped well inside the
    // envelope so a phone held at an angle doesn't peg the rotation.
    target.x = THREE.MathUtils.clamp(e.gamma / 35, -1, 1);
    target.y = THREE.MathUtils.clamp((e.beta - 45) / 35, -1, 1);
  }

  // Touch: a finger dragged across the glass stirs it. Capture on the stage so
  // the drag keeps stirring even once it wanders off the box.
  const stageEl = document.querySelector('.cup-stage');
  function onTouchDown(e) {
    stageEl?.setPointerCapture?.(e.pointerId);
    trail.has = false; // don't bridge from wherever the finger last was
  }
  function onTouchMove(e) {
    noteLiquidPointer(e.clientX, e.clientY);
  }
  function onTouchUp(e) {
    stageEl?.releasePointerCapture?.(e.pointerId);
    trail.has = false;
    ptr.has = false;
  }
  if (!reducedMotion) {
    if (coarse) {
      // No permission prompt: if the OS never delivers events (iOS without a
      // gesture-granted permission), the drink simply stays static.
      window.addEventListener('deviceorientation', onOrient, { passive: true });
      stageEl?.addEventListener('pointerdown', onTouchDown, { passive: true });
      stageEl?.addEventListener('pointermove', onTouchMove, { passive: true });
      stageEl?.addEventListener('pointerup', onTouchUp, { passive: true });
      stageEl?.addEventListener('pointercancel', onTouchUp, { passive: true });
    } else {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }
  }

  // Pause both sims when the hero scrolls away — nothing to see, no reason to
  // keep ping-ponging targets.
  let io = null;
  const heroEl = document.querySelector('.hero');
  if (heroEl && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { threshold: 0 }
    );
    io.observe(heroEl);
  }

  // ── fit ─────────────────────────────────────────────────────────────────
  const MARGIN = 1.14;
  let pxPerWorld = 1;
  let bobWorld = 0;
  // The drink's box within the canvas, in UV — the stir field's domain.
  let stageUV = { x: 0, y: 0, w: 1, h: 1 };
  let sceneRT = new THREE.WebGLRenderTarget(4, 4, {
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
  });

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const a = w / h;
    camera.aspect = a;
    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;

    // The drink is framed against .cup-stage, not against the canvas, which
    // now spans the whole hero. Fall back to the canvas if the stage is gone.
    const stageEl = document.querySelector('.cup-stage');
    /* Measured in HERO space, never from the canvas's own client rect.
       hero-bean.js translates and scales this canvas to push the drink off
       screen during the takeover, so reading canvas.getBoundingClientRect()
       here folds that push into `placement` and strands the drink once the
       transform returns to zero — that is the "scroll back to the top and the
       drink is in the wrong place" bug.

       The canvas is inset:0 on the hero, so its untransformed box IS the hero's
       content box: origin (0,0), size clientWidth/Height. The stage is measured
       as a delta between two client rects, which cancels both scroll position
       and the pin's fixed positioning while still honouring the stage's own
       translateX(-50%) — offsetLeft would miss that translate and put the drink
       half a stage-width to the right. */
    const heroEl = canvas.closest('.hero') || canvas.parentElement;
    const heroRect = heroEl.getBoundingClientRect();
    const cr = { left: 0, top: 0 };
    let sr;
    if (stageEl) {
      const s = stageEl.getBoundingClientRect();
      sr = { left: s.left - heroRect.left, top: s.top - heroRect.top,
             width: s.width, height: s.height };
    } else {
      sr = { left: 0, top: 0, width: w, height: h };
    }
    const sw = sr.width || w;
    const sh = sr.height || h;

    // Distance that would fit the plane to the STAGE box, exactly as before.
    const zH = PLANE_H / 2 / Math.tan(halfFov);
    const zW = PLANE_W / 2 / (Math.tan(halfFov) * (sw / sh));
    const stageDist = Math.max(zH, zW) * MARGIN + BULGE;
    const stageVisibleH = 2 * Math.tan(halfFov) * stageDist;

    // Then widen the frustum to the canvas while holding world-per-pixel
    // constant, so the drink keeps the on-screen size it had in the stage.
    const worldPerPx = stageVisibleH / sh;
    const dist = (worldPerPx * h) / (2 * Math.tan(halfFov));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    // Slide the drink from the canvas centre to the stage centre.
    placement.position.set(
      (sr.left + sw / 2 - (cr.left + w / 2)) * worldPerPx,
      -(sr.top + sh / 2 - (cr.top + h / 2)) * worldPerPx,
      0
    );

    // Screen-space amplitudes (the brief specifies the bob in px) need the
    // world-per-pixel scale at the plane.
    pxPerWorld = 1 / worldPerPx;
    bobWorld = BOB_PX / pxPerWorld;
    stageUV = { x: (sr.left - cr.left) / w, y: (sr.top - cr.top) / h, w: sw / w, h: sh / h };

    const dpr = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);

    // Targets match the drawing buffer, at the same capped DPR.
    const tw = Math.max(1, Math.round(w * dpr));
    const th = Math.max(1, Math.round(h * dpr));
    if (rtA.width !== tw || rtA.height !== th) {
      rtA.setSize(tw, th);
      rtB.setSize(tw, th);
      sceneRT.setSize(tw, th);
    }
    stirUniforms.uAspect.value = w / h;
  
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
  resize();
  // Observe BOTH: the canvas spans the hero, but a media-query change can move
  // or resize .cup-stage without the canvas changing at all — and the drink is
  // aimed at the stage. Watching only the canvas leaves it stranded mid-page.
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const stageForFit = document.querySelector('.cup-stage');
  if (stageForFit) ro.observe(stageForFit);
  // A pure MOVE fires neither observer, so re-fit on viewport changes too.
  window.addEventListener('resize', resize, { passive: true });

  /* ...and a move with no viewport change fires nothing at all. The stage is
     positioned in vh against a wordmark whose height depends on a web font, so
     it slides when the font lands (and on every HMR edit) while keeping its
     size — leaving the drink rendered at its old spot.

     Compares LAYOUT offsets, not a client rect. A client rect also changes with
     scroll position and whenever ScrollTrigger pins or unpins the hero, so this
     would re-fit on essentially every frame of the hero takeover — burning work
     and, worse, re-measuring while the canvas is mid-transform. offsetLeft/Top
     move only when the layout actually moves, which is the only case this is
     here to catch. */
  let lastLeft = stageForFit ? stageForFit.offsetLeft : 0;
  let lastTop = stageForFit ? stageForFit.offsetTop : 0;
  function watchStagePosition() {
    if (!stageForFit) return;
    const l = stageForFit.offsetLeft;
    const t = stageForFit.offsetTop;
    if (Math.abs(l - lastLeft) > 0.5 || Math.abs(t - lastTop) > 0.5) {
      lastLeft = l;
      lastTop = t;
      resize();
    }
  }

  // ── transitions ─────────────────────────────────────────────────────────
  const fade = { t: 1, active: false };

  /** Finish an in-flight stir immediately — no queuing, no three-way blend. */
  function settleStir() {
    if (!stir.active) return;
    uniforms.uMapA.value = stir.texB;
    stir.active = false;
    stir.t = 1;
    stirUniforms.uProgress.value = 0;
    stir.onDone?.();
    stir.onDone = null;
  }

  /** Plain crossfade — reduced motion, and the path used when the caller
      gives no origin point (keyboard selection). */
  function crossfade(tex) {
    if (fade.active) {
      uniforms.uMapA.value = uniforms.uMapB.value;
      uniforms.uMix.value = 0;
    }
    if (tex === uniforms.uMapA.value) {
      fade.active = false;
      fade.t = 1;
      return;
    }
    uniforms.uMapB.value = tex;
    uniforms.uMix.value = 0;
    fade.t = 0;
    fade.active = true;
    pump();
  }

  /**
   * @param {object} way      colourway
   * @param {{x:number,y:number}} [origin] click point in canvas UV space
   *        (0,0 = bottom-left). Omit for a plain crossfade.
   */
  async function setColorway(way, origin) {
    const tex = await textureFor(way);
    if (!tex) return;

    settleStir();
    // A new drink arrives with a still surface. This also means no ripple is
    // alive during the transition, so swapping the mask below can't be seen.
    clearRipples();

    const nextMask = await maskFor(way);
    if (nextMask) {
      maskTex = nextMask;
      uniforms.uMask.value = nextMask;
      uniforms.uHasMask.value = reducedMotion ? 0 : 1;
    }

    if (reducedMotion || !origin) {
      crossfade(tex);
      return;
    }

    // Deliberately NOT skipped when the incoming texture matches the current
    // one. Only /drink.png is authored today, so every colourway resolves to
    // the same art — but the *palette* still changes, and the stir is what
    // carries it. Bailing here would mean the ripple never plays at all.
    stir.texB = tex;
    stirUniforms.uCenter.value.set(origin.x, origin.y);
    stirUniforms.uProgress.value = 0;
    stir.t = 0;
    stir.active = true;
    pump();
  }

  // Under reduced motion main.js never starts a frame loop, and a crossfade
  // still needs frames. This drives just enough of them, then stops.
  let pumping = false;
  function pump() {
    if (pumping || !reducedMotion) return;
    pumping = true;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(dt, now / 1000);
      if (fade.active || stir.active) requestAnimationFrame(tick);
      else pumping = false;
    };
    requestAnimationFrame(tick);
  }

  // ── frame ───────────────────────────────────────────────────────────────
  let bob = 0;
  let simAccum = 0;
  let emitTimer = 0;
  let simHalfRate = false;
  let smoothDt = 1 / 60;
  let visible = true;
  let frameEma = 8;

  function step(dt, elapsed) {
    watchStagePosition();

    // Frame-cost EMA. If we're consistently missing the budget, the ambient
    // sim halves its update rate before anything visible is sacrificed.
    // NOTE: dt is the frame *interval*, which is ~16.7ms on a healthy 60fps
    // display — not the frame's cost. The threshold must sit above that or the
    // sim degrades permanently while everything is actually fine.
    if (dt > 0) {
      frameEma += (dt * 1000 - frameEma) * 0.05;
      if (!simHalfRate && frameEma > 22) simHalfRate = true; // below ~45fps
      else if (simHalfRate && frameEma < 18) simHalfRate = false;
    }

    if (!reducedMotion) {
      bob = Math.sin((elapsed / BOB_PERIOD) * Math.PI * 2) * bobWorld;
      cup.position.y = bob;

      if (tiltEnabled) {
        // Frame-rate independent form of a 0.06 lerp.
        const k = 1 - (1 - LERP) ** (dt * 60);
        pointer.x += (target.x - pointer.x) * k;
        pointer.y += (target.y - pointer.y) * k;
      }

      cup.rotation.y = pointer.x * MAX_YAW * rangeScale;
      cup.rotation.x = pointer.y * MAX_PITCH * rangeScale;

      // Parallax is in UV units and deliberately tiny: this is a photo, and
      // over-shifting it smears the garnish instead of separating it.
      uniforms.uParallax.value.set(pointer.x * 0.012, -pointer.y * 0.008);
    }

    if (fade.active) {
      fade.t = Math.min(fade.t + dt / FADE_DUR, 1);
      // smoothstep: no visible seam at either end of the cross-fade
      uniforms.uMix.value = fade.t * fade.t * (3 - 2 * fade.t);
      if (fade.t >= 1) {
        uniforms.uMapA.value = uniforms.uMapB.value;
        uniforms.uMix.value = 0;
        fade.active = false;
      }
    }

    // Emission happens HERE, not in the pointer handler, so ring spacing is a
    // function of distance travelled rather than of how often the mouse polls.
    // Age the ripples after: once every age passes uLife the shader's loop
    // skips them all, off is exactly vec2(0), and the render is bit-identical
    // to the plain photo — that is the rest-state guarantee.
    if (!reducedMotion && visible) {
      emitAlongTrail();
      // Clamped then smoothed. A single long frame would otherwise advance
      // every ring's phase at once, which reads as one hitch across the whole
      // wake rather than as a dropped frame.
      const raw = Math.min(dt, 1 / 30);
      smoothDt += (raw - smoothDt) * 0.25;
      for (const r of ripples) if (r.z < 900) r.z += smoothDt;
    }

    const dest = null;

    if (!stir.active) {
      renderer.setRenderTarget(dest);
      renderer.render(scene, camera);
    } else {
      stir.t = Math.min(stir.t + dt / STIR_DUR, 1);
      stirUniforms.uProgress.value = easeOutCubic(stir.t);

      // Both targets carry the SAME pose and differ only in texture, so the
      // drink keeps bobbing and tilting through the transition.
      const prevA = uniforms.uMapA.value;
      renderer.setRenderTarget(rtA);
      renderer.clear();
      renderer.render(scene, camera);

      uniforms.uMapA.value = stir.texB;
      renderer.setRenderTarget(rtB);
      renderer.clear();
      renderer.render(scene, camera);
      uniforms.uMapA.value = prevA;

      renderer.setRenderTarget(dest);
      renderer.clear();
      renderer.render(stirScene, stirCam);

      if (stir.t >= 1) settleStir();
    }

    renderer.setRenderTarget(null);
  }

  return {
    renderer,
    scene,
    camera,
    rig,
    cup,
    mesh,
    uniforms,
    step,
    setColorway,
    stirUniforms,
    /** Resolves once every colourway's art is decoded. */
    preloaded,
    get stirring() {
      return stir.active;
    },
    /** 0 at the bottom of the bob, 1 at the top — drives the DOM shadow. */
    get bobNorm() {
      return bobWorld ? (bob / bobWorld + 1) / 2 : 0.5;
    },
    /** The lerped pointer, -1…1 — the DOM parallax reads this so the whole
        hero settles on one shared value instead of running two lerps. */
    get pointer() {
      return { x: pointer.x, y: pointer.y };
    },
    dispose() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('deviceorientation', onOrient);
      texCache.forEach((t) => t.dispose());
      depthTex?.dispose();
      rtA.dispose();
      rtB.dispose();
      sceneRT.dispose();
      io?.disconnect();
      mesh.geometry.dispose();
      mesh.material.dispose();
      renderer.dispose();
    },
  };
}
