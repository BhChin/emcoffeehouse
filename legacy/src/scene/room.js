import * as THREE from 'three';
import { PALETTE, ROOM, STOPS } from '../config.js';

/**
 * A single inverted box the camera lives inside. One material, one draw call —
 * the moodiness comes entirely from light falloff, not from geometry.
 */
export function buildRoom(scene) {
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.width, ROOM.height, ROOM.depth),
    new THREE.MeshStandardMaterial({
      color: PALETTE.navy,
      roughness: 1,
      metalness: 0,
      side: THREE.BackSide,
    })
  );
  shell.position.z = ROOM.centerZ;
  scene.add(shell);

  // Ambient keeps the corners reading as dark navy rather than dead black.
  scene.add(new THREE.AmbientLight(PALETTE.cream, 0.55));

  const lamps = [];
  STOPS.forEach((stop, i) => {
    const z = stop.target[2];

    // Key: the pendant itself, hanging above. Distance-limited so each pool of
    // light dies before it reaches the next stop — that's what sells the depth.
    const lamp = new THREE.PointLight(PALETTE.lamp, 420, 50, 2);
    lamp.position.set(0, 11, z + 3);
    scene.add(lamp);
    lamps.push(lamp);
    scene.add(buildPendant(lamp.position));

    // Fill: a soft warm light sitting between the camera and the content. The
    // pendant alone rakes across the wordmark's front faces at a grazing angle
    // and leaves them nearly black — this is what actually makes cream read as
    // cream. Kept dim and wide so it lifts surfaces without flattening them.
    const fill = new THREE.PointLight(PALETTE.cream, 160, 55, 2);
    // Offset only at the hero, where the orange rim on the far side balances
    // it. At the reading stops an off-centre fill visibly darkens one wall and
    // makes centred text look lopsided.
    fill.position.set(i === 0 ? -4 : 0, 3, z + 15);
    scene.add(fill);

    if (i === 0) {
      // The hero gets one extra rim from the opposite side so the extrusion's
      // side walls catch a little orange.
      const rim = new THREE.PointLight(PALETTE.orange, 50, 40, 2);
      rim.position.set(13, -4, z + 8);
      scene.add(rim);
    }
  });

  return { shell, lamps };
}

// A little cafe pendant: cord, shade, and an additive glow blob standing in for
// bloom so we can skip a postprocessing pass entirely.
function buildPendant(position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 6, 6),
    new THREE.MeshBasicMaterial({ color: '#0C161D' })
  );
  cord.position.y = 3 + 3;
  group.add(cord);

  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 1.5, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color: PALETTE.orange,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  shade.position.y = 3.4;
  group.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshBasicMaterial({ color: PALETTE.lamp })
  );
  bulb.position.y = 2.9;
  group.add(bulb);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: PALETTE.lamp,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.scale.setScalar(9);
  glow.position.y = 2.9;
  group.add(glow);

  return group;
}

let cachedGlow = null;
export function glowTexture() {
  if (cachedGlow) return cachedGlow;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cachedGlow = new THREE.CanvasTexture(canvas);
  cachedGlow.colorSpace = THREE.SRGBColorSpace;
  return cachedGlow;
}
