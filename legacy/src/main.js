import * as THREE from 'three';
import {
  PALETTE,
  MENU_ITEMS,
  LOCATIONS,
  ABOUT_LINES,
  prefersReducedMotion,
} from './config.js';
import { preloadFonts, collectCharacters } from './core/text.js';
import { createCameraRig } from './core/cameraRig.js';
import { buildRoom } from './scene/room.js';
import { buildWordmark } from './scene/wordmark.js';
import { buildPhin } from './scene/phin.js';
import { buildMenuWall } from './scene/menuWall.js';
import { buildAbout } from './scene/about.js';
import { buildLocations } from './scene/locations.js';
import { createOverlay, showFallback } from './ui/overlay.js';

const canvas = document.getElementById('scene');

function createRenderer() {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    // A context is only really proven once we can read it back.
    if (!renderer.getContext()) return null;
    return renderer;
  } catch {
    return null;
  }
}

const renderer = createRenderer();
if (!renderer) {
  showFallback();
} else {
  start(renderer).catch((err) => {
    console.error('[em] scene failed to start', err);
    showFallback();
  });
}

async function start(renderer) {
  const reducedMotion = prefersReducedMotion();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // No tone mapping on purpose: the look is flat and graphic, not photographic,
  // and ACES pulls the brand cream and orange noticeably off-hue.
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.navy);
  // Fog does the heavy lifting for depth: distant stops sink into the room.
  scene.fog = new THREE.Fog(PALETTE.navy, 26, 76);

  const camera = new THREE.PerspectiveCamera(
    52,
    window.innerWidth / window.innerHeight,
    0.1,
    260
  );

  // Preload every glyph the site uses — including the Vietnamese diacritics —
  // so nothing pops in mid-scroll.
  await preloadFonts(
    collectCharacters([
      'EM',
      'cà phê',
      'THE MENU',
      'FIND YOUR EM',
      '#BeInTheMoment',
      'poured slow, seven days a week',
      ...MENU_ITEMS.flatMap((m) => [m.name, m.note]),
      ...LOCATIONS.flatMap((l) => [l.city, l.address]),
      ...ABOUT_LINES,
    ])
  );

  buildRoom(scene);
  const [wordmark, menu, about, locations] = await Promise.all([
    buildWordmark(scene),
    buildMenuWall(scene),
    buildAbout(scene),
    buildLocations(scene),
  ]);
  const phin = buildPhin(scene, { reducedMotion });

  const rig = createCameraRig(camera, canvas);
  const overlay = createOverlay({ onStop: (i) => rig.goToStop(i) });
  rig.onChange((state) => {
    if (state.hasScrolled) overlay.hideCue();
  });

  // Touch devices that never report tilt still get gentle movement.
  if (window.matchMedia('(pointer: coarse)').matches) {
    setTimeout(() => rig.enableAutoDrift(), 1200);
  }

  // --- hover ------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2(-2, -2);
  let hovered = null;

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointerNDC.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1
    );
  });
  canvas.addEventListener('pointerleave', () => pointerNDC.set(-2, -2));

  // --- layout -----------------------------------------------------------
  function applyLayout() {
    // Measure the canvas, not the window: CSS owns the element's box, and the
    // window can report a size before the canvas has actually been laid out.
    const w = canvas.clientWidth || window.innerWidth || 1;
    const h = canvas.clientHeight || window.innerHeight || 1;
    const portrait = w < 720 && h > w;

    // Hero scales with viewport width so "EM" never runs off the edges.
    const heroScale = portrait ? 0.5 : Math.min(1, w / 1180);
    wordmark.group.scale.setScalar(Math.max(0.42, heroScale));
    // The phin hangs below the wordmark's baseline; clearing it matters more
    // than matching the hero scale exactly, so it gets its own floor.
    phin.group.scale.setScalar(Math.max(0.85, heroScale * 1.15));
    phin.group.position.y = portrait ? -8.2 : -11.2;

    menu.layout(portrait);
    about.layout(portrait);
    locations.layout(portrait);

    camera.aspect = w / h;
    camera.fov = portrait ? 64 : 52;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // `false` — never write inline width/height onto the canvas; the stylesheet
    // already stretches it to the viewport.
    renderer.setSize(w, h, false);
  }

  applyLayout();
  window.addEventListener('resize', applyLayout);
  // Catches the case where the canvas is measured after first paint (embedded
  // panes, late font layout) — a window resize event never fires for that.
  new ResizeObserver(applyLayout).observe(canvas);

  // --- loop -------------------------------------------------------------
  const clock = new THREE.Clock();
  let lastStopReported = -1;

  // One frame's worth of work, split out from the rAF driver so it can also be
  // stepped deterministically (tests, and any environment that throttles rAF).
  function step(dt, elapsed) {
    rig.update(dt, elapsed);

    // Only raycast when the menu wall is the stop in view — no reason to pay
    // for it during the hero or locations.
    const nearMenu = Math.abs(rig.state.progress - 1) < 0.6;
    if (nearMenu && pointerNDC.x > -1.5) {
      raycaster.setFromCamera(pointerNDC, camera);
      const hit = raycaster.intersectObjects(menu.hitTargets, false)[0];
      hovered = hit ? hit.object : null;
    } else {
      hovered = null;
    }
    canvas.style.cursor = hovered ? 'pointer' : '';

    menu.update(elapsed, dt, hovered);
    phin.update(elapsed);

    if (!reducedMotion) {
      // The script word breathes very slightly against the static EM.
      wordmark.script.rotation.z = -0.13 + Math.sin(elapsed * 0.5) * 0.012;
      about.tag.position.y = -3.4 + Math.sin(elapsed * 0.7) * 0.09;
    }

    const nearest = Math.round(rig.state.progress);
    if (nearest !== lastStopReported) {
      lastStopReported = nearest;
      overlay.setActiveStop(nearest);
    }

    renderer.render(scene, camera);
  }

  function frame() {
    step(Math.min(clock.getDelta(), 0.05), clock.getElapsedTime());
    requestAnimationFrame(frame);
  }

  frame();
  overlay.hideLoader();

  // Dev-only handle so the scene can be driven and sampled from the console.
  if (import.meta.env.DEV) {
    window.__em = { renderer, scene, camera, rig, menu, phin, wordmark, applyLayout, step };
  }
}
