import * as THREE from 'three';
import { STOPS, prefersReducedMotion } from '../config.js';

const MAX_INDEX = STOPS.length - 1;
const WHEEL_SCALE = 0.0016; // one comfortable wheel notch ≈ a fifth of a stop
const TOUCH_SCALE = 0.006;

/**
 * Scroll doesn't scroll a document — it walks the camera through the room's
 * stops. Position and look-at are interpolated between stops, then a small
 * lerped parallax offset is layered on top from pointer / device tilt.
 */
export function createCameraRig(camera, dom) {
  const reduced = prefersReducedMotion();

  const state = {
    progress: 0,
    target: 0,
    // Normalised pointer, -1..1 on each axis.
    pointer: new THREE.Vector2(),
    pointerTarget: new THREE.Vector2(),
    hasScrolled: false,
    usingTilt: false,
  };

  const listeners = new Set();
  const onChange = (fn) => listeners.add(fn);
  const emit = () => listeners.forEach((fn) => fn(state));

  const positions = STOPS.map((s) => new THREE.Vector3(...s.position));
  const targets = STOPS.map((s) => new THREE.Vector3(...s.target));

  const posA = new THREE.Vector3();
  const lookA = new THREE.Vector3();

  function setTarget(value, { user = true } = {}) {
    state.target = THREE.MathUtils.clamp(value, 0, MAX_INDEX);
    if (user && !state.hasScrolled) {
      state.hasScrolled = true;
      emit();
    }
  }

  function goToStop(index) {
    setTarget(index);
  }

  // --- input -------------------------------------------------------------
  dom.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      setTarget(state.target + e.deltaY * WHEEL_SCALE);
    },
    { passive: false }
  );

  let touchY = null;
  dom.addEventListener(
    'touchstart',
    (e) => {
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  dom.addEventListener(
    'touchmove',
    (e) => {
      if (touchY == null) return;
      const y = e.touches[0].clientY;
      setTarget(state.target + (touchY - y) * TOUCH_SCALE);
      touchY = y;
    },
    { passive: true }
  );
  dom.addEventListener('touchend', () => {
    touchY = null;
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') setTarget(state.target + 1);
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') setTarget(state.target - 1);
    else if (e.key === 'Home') setTarget(0);
    else if (e.key === 'End') setTarget(MAX_INDEX);
    else return;
    e.preventDefault();
  });

  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      state.pointerTarget.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1
      );
    });

    // Recentre when the pointer leaves the window. Without this the room stays
    // frozen at whatever deflection the cursor last had — and a browser that
    // reports a stale (0,0) position on load would park it hard in the corner
    // before the user has touched anything.
    const recentre = () => state.pointerTarget.set(0, 0);
    document.addEventListener('pointerleave', recentre);
    window.addEventListener('blur', recentre);

    // Device tilt on mobile, when the platform hands it over without a prompt.
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null && e.beta == null) return;
      state.usingTilt = true;
      state.pointerTarget.set(
        THREE.MathUtils.clamp((e.gamma ?? 0) / 35, -1, 1),
        THREE.MathUtils.clamp(((e.beta ?? 45) - 45) / 35, -1, 1)
      );
    });
  }

  // --- per-frame ---------------------------------------------------------
  function update(dt, elapsed) {
    // Exponential smoothing keeps the glide identical at 30 or 144fps.
    state.progress += (state.target - state.progress) * (1 - Math.exp(-dt * 3.4));

    const i = Math.min(Math.floor(state.progress), MAX_INDEX - 1);
    const f = THREE.MathUtils.clamp(state.progress - i, 0, 1);
    // Smoothstep between stops so arrivals settle instead of stopping dead.
    const e = f * f * (3 - 2 * f);

    posA.copy(positions[i]).lerp(positions[i + 1], e);
    lookA.copy(targets[i]).lerp(targets[i + 1], e);

    if (!reduced) {
      state.pointer.lerp(state.pointerTarget, 1 - Math.exp(-dt * 2.6));

      const px = state.pointer.x;
      const py = state.pointer.y;

      posA.x += px * 1.5;
      // The sine adds a slow breathing bob so the room is never fully static.
      posA.y += -py * 0.9 + Math.sin(elapsed * 0.22) * 0.18;
      // Shifting the look-at further than the camera yields a few degrees of
      // rotation — enough for parallax, never enough to feel like an orbit.
      lookA.x -= px * 2.6;
      lookA.y += py * 1.6;
    }

    camera.position.copy(posA);
    camera.lookAt(lookA);
  }

  // Slow auto-drift for reduced-motion-free touch devices without tilt.
  function enableAutoDrift() {
    if (reduced || state.usingTilt) return;
    let t = 0;
    const tick = () => {
      if (state.usingTilt) return;
      t += 0.004;
      state.pointerTarget.set(Math.sin(t) * 0.5, Math.cos(t * 0.8) * 0.3);
      requestAnimationFrame(tick);
    };
    tick();
  }

  return { state, update, goToStop, onChange, enableAutoDrift, reduced, maxIndex: MAX_INDEX };
}
