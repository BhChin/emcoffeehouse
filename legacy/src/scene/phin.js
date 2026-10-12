import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { glowTexture } from './room.js';

/**
 * A toy-like phin filter dripping into a glass of cà phê sữa đá.
 * Everything is low-poly with matte materials — no PBR realism, and the whole
 * assembly is a handful of cylinders so it costs nothing to keep on screen.
 */
export function buildPhin(scene, { reducedMotion }) {
  const group = new THREE.Group();
  group.position.set(0, -8.6, 2);

  const metal = new THREE.MeshStandardMaterial({
    color: '#C9BCA6',
    roughness: 0.65,
    metalness: 0.15,
    flatShading: true,
  });
  const coffeeMat = new THREE.MeshStandardMaterial({
    color: PALETTE.coffee,
    roughness: 0.5,
    metalness: 0,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: PALETTE.cream,
    roughness: 0.75,
    metalness: 0,
  });

  // --- glass -------------------------------------------------------------
  const glassH = 3.2;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 0.9, glassH, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: PALETTE.cream,
      roughness: 0.25,
      metalness: 0,
      transparent: true,
      opacity: 0.17,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  glass.position.y = glassH / 2;
  group.add(glass);

  // Condensed milk sits under the coffee — the signature two-tone layer.
  const creamLayer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.86, 0.85, 20),
    creamMat
  );
  creamLayer.position.y = 0.45;
  group.add(creamLayer);

  const coffee = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.95, 1.7, 20), coffeeMat);
  coffee.position.y = 1.72;
  group.add(coffee);

  // --- phin filter -------------------------------------------------------
  const phin = new THREE.Group();
  phin.position.y = glassH + 0.05;

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.12, 20), metal);
  phin.add(saucer);

  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.82, 1.25, 20), metal);
  chamber.position.y = 0.68;
  phin.add(chamber);

  const grounds = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 18), coffeeMat);
  grounds.position.y = 1.28;
  phin.add(grounds);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.02, 0.42, 20), metal);
  lid.position.y = 1.55;
  phin.add(lid);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), metal);
  knob.position.y = 1.85;
  phin.add(knob);

  group.add(phin);

  // --- the drop ----------------------------------------------------------
  // Falls from the underside of the saucer to the coffee surface, on a loop.
  const dropTop = glassH - 0.05;
  const dropBottom = 2.6;
  const drop = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.MeshStandardMaterial({ color: PALETTE.coffee, roughness: 0.35 })
  );
  drop.scale.set(1, 1.35, 1);
  group.add(drop);

  // Ripple where it lands.
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.32, 18),
    new THREE.MeshBasicMaterial({
      color: '#5A3A14',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 2.58;
  group.add(ripple);

  // --- steam -------------------------------------------------------------
  // Skipped entirely under reduced motion: it exists only to move.
  const wisps = [];
  if (!reducedMotion) {
    const steamMat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: PALETTE.cream,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const wisp = new THREE.Sprite(steamMat.clone());
      wisp.scale.setScalar(1.6 + i * 0.35);
      wisp.userData.offset = i * 0.9;
      wisp.userData.sway = 0.28 + i * 0.11;
      group.add(wisp);
      wisps.push(wisp);
    }
  }

  scene.add(group);

  const DRIP_PERIOD = 2.4;

  function update(elapsed) {
    // Drip runs even under reduced motion — it's the one thing we keep alive.
    const t = (elapsed % DRIP_PERIOD) / DRIP_PERIOD;
    if (t < 0.62) {
      const fall = t / 0.62;
      drop.visible = true;
      // Ease in like gravity rather than a linear slide.
      drop.position.y = dropTop - (dropTop - dropBottom) * fall * fall;
      drop.scale.y = 1.35 + fall * 0.5;
    } else {
      drop.visible = false;
    }

    const splash = t < 0.62 ? 0 : (t - 0.62) / 0.38;
    ripple.material.opacity = splash > 0 ? 0.5 * (1 - splash) : 0;
    const r = 1 + splash * 1.8;
    ripple.scale.set(r, r, r);

    for (const wisp of wisps) {
      const life = ((elapsed * 0.18 + wisp.userData.offset) % 1);
      wisp.position.y = 3.4 + life * 4.2;
      wisp.position.x = Math.sin((elapsed + wisp.userData.offset) * 0.6) * wisp.userData.sway;
      // Fade in at the base, out at the top, so wisps never pop.
      wisp.material.opacity = 0.09 * Math.sin(life * Math.PI);
    }
  }

  return { group, update };
}
