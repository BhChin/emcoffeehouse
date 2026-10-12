import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * The coffee bean that descends through the hero.
 *
 * Owns only the scene and the render loop. It deliberately does NOT know about
 * scroll — it exposes `bean`, `spin` and `shadow`, and hero-bean.js drives
 * them. Keeping the two apart is what lets reduced-motion skip the whole
 * choreography without this module needing to know why.
 *
 * The model is meshopt-compressed (see scripts/optimize-bean.mjs). three ships
 * the decoder inside its own package, so there is nothing to copy into public/
 * and no decoder path to get wrong on deploy.
 */

const MODEL = '/assets/bean-opt.glb';

// Bean units after normalisation: 1.0 = the model's longest axis.
const CAM_Z = 5.2;
const FOV = 32;

export function createBean({ canvas, reducedMotion = false, onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES keeps the ember key from clipping to flat orange on the bean's
  // highlights, which is exactly where the "lit by cafe light" read lives.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  // `bean` is the handle the choreography animates (position/scale/rotation.z).
  // `spin` nests inside it and owns the tumble (rotation.y/x). Two groups, so
  // the scrubbed pose and the continuous tumble can never fight over the same
  // property — one system writes each.
  const bean = new THREE.Group();
  const spin = new THREE.Group();
  bean.add(spin);

  /* The normalised model's extents, filled in once the GLB resolves. Zero until
     then, and every consumer must treat it that way — the choreography runs
     before the model lands. */
  const extents = new THREE.Vector3();
  scene.add(bean);

  /* Lighting has to match the hero's soft daylight, not a studio: the bean
     shares the frame with a photographed drink, and a hard key would read as a
     3D object pasted onto a photo. Cream-dominant, ember only as an accent. */
  // ── lighting: warm key, cream fill, ember accent ────────────────────────
  const key = new THREE.DirectionalLight(0xffc98f, 2.1);
  key.position.set(2.6, 3.0, 2.4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xfff6e8, 1.35);
  fill.position.set(-3.0, 0.4, 1.8);
  scene.add(fill);

  /* Ember, from the front-left and much weaker than it was over the dark
     ground. A back-rim only reads against darkness — on cream it haloes the
     silhouette edge into the page instead of separating from it. Here it just
     warms the shadow side so the bean doesn't go flat grey. */
  const rim = new THREE.PointLight(0xe8762c, 1.15, 14, 2);
  rim.position.set(-1.8, -0.6, 2.0);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0xfff6e8, 0.46));

  /* A neutral environment so the roughness map has something to respond to.
     Held VERY low: with metalness 0 and roughness 1 the env contributes diffuse
     IBL across the whole surface, and at the default it out-lit all four lights
     combined — the bean measured #a95f34 with every light switched off. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.16;
  pmrem.dispose();

  // ── drop shadow ─────────────────────────────────────────────────────────
  /* A soft dark ellipse trailing below the bean, matching how the hero's drink
     photo is grounded. NORMAL blending, not additive: the canvas is transparent
     and composites straight onto the cream page, so an additive sprite would
     brighten the cream instead of darkening it — it would read as a glow, which
     is what this replaces. The warm brown matches --shadow in the stylesheet; a
     neutral grey over cream reads as dirt. */
  const shadowTex = (() => {
    const s = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(92,72,46,1)');
    g.addColorStop(0.42, 'rgba(92,72,46,0.42)');
    g.addColorStop(1, 'rgba(92,72,46,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const shadow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: shadowTex,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      opacity: 0.12,
      // The sprite is a lit-independent billboard; tone mapping would drag its
      // density around as the exposure changes.
      toneMapped: false,
    })
  );
  // Wider than tall, and offset down: a contact-less cast shadow, not a halo.
  // Opacity is driven by hero-bean.js: it fades up as the bean nears the
  // glass, because a shadow with nothing under it reads as a smudge.
  shadow.scale.set(1.25, 0.34, 1);
  shadow.position.set(0.03, -0.5, -0.4);
  shadow.renderOrder = -1;
  bean.add(shadow);

  // ── model ───────────────────────────────────────────────────────────────
  let model = null;
  let disposed = false;

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loaded = loader.loadAsync(MODEL).then((gltf) => {
    if (disposed) return null;
    model = gltf.scene;

    // Normalise: centre on the origin and scale so the longest axis is 1.0, so
    // the choreography's scale numbers mean the same thing no matter what the
    // exporter happened to emit.
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(centre);
    const norm = 1 / Math.max(size.x, size.y, size.z);
    model.position.sub(centre).multiplyScalar(norm);
    model.scale.setScalar(norm);
    /* Normalised extents, published for the choreography. hero-bean.js needs the
       bean's on-screen silhouette to shape the aperture it opens, and deriving
       it from the model beats reading pixels back: a rotated box's projected
       AABB is |R| * extents, which is exact and costs three multiplies instead
       of a 5 MB readPixels every frame. */
    extents.set(size.x * norm, size.y * norm, size.z * norm);

    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = false;
      const m = o.material;
      if (m) {
        // Meshy ships this double-sided; the mesh is closed (verified in
        // scripts/check-mesh-holes.mjs), so back faces are pure overdraw.
        m.side = THREE.FrontSide;
        /* Meshy exports metallicFactor 1. At full metalness a PBR surface has
           no diffuse term at all, so the brown albedo is discarded and the bean
           renders as a mirror tinted by whatever lights are nearby — which is
           why it came out as an orange blob. Coffee is a dielectric. The
           roughness map still applies; only the metallic factor is wrong. */
        m.metalness = 0;
        m.envMapIntensity = 0.55;
      }
    });

    spin.add(model);
    onReady?.();
    return model;
  });

  // ── sizing ──────────────────────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ── render loop ─────────────────────────────────────────────────────────
  // Driven by an explicit render() rather than its own rAF: the scroll scrub
  // decides when the pose changed, and a bean that is not moving does not need
  // to be redrawn. The section is static between scroll events.
  let queued = false;
  function render() {
    if (disposed) return;
    renderer.render(scene, camera);
  }
  /** Coalesce many scroll-driven invalidations into one draw per frame. */
  function invalidate() {
    if (queued || disposed) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  /**
   * Half the world-space extent the camera can see at z = 0.
   *
   * The choreography positions the bean as a FRACTION of this rather than in
   * fixed world units. Height is constant (fov and camera distance are fixed)
   * but width follows the aspect ratio — ±2.34 on a desktop canvas, ±0.69 on a
   * portrait phone. A pose hard-coded in world units sails off the side of a
   * narrow viewport.
   */
  function visibleHalf() {
    const halfH = Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * CAM_Z;
    return { halfH, halfW: halfH * camera.aspect };
  }

  return {
    bean,
    spin,
    shadow,
    extents,
    /* Exposed for inspection and for any future rig work, but hero-bean.js no
       longer writes to either. An earlier flyover dollied the camera over the
       bean, which quietly broke visibleHalf() below — its vh -> world mapping
       holds only while camera distance is fixed. If you move the camera, that
       function and everything expressed in vh through it stop agreeing. */
    camera,
    key,
    renderer,
    loaded,
    resize,
    visibleHalf,
    invalidate,
    render,
    get ready() { return !!model; },
    dispose() {
      disposed = true;
      ro.disconnect();
      envRT.dispose();
      shadowTex.dispose();
      shadow.material.dispose();
      model?.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
            m[k]?.dispose();
          }
          m.dispose();
        }
      });
      renderer.dispose();
    },
  };
}
