import * as THREE from 'three';
import { PALETTE, LOCATIONS, STOPS, STOP_INDEX } from '../config.js';
import { makeText, syncText } from '../core/text.js';

const Z = STOPS[STOP_INDEX.locations].target[2];

/**
 * Final stop: five real shops, left-aligned as a list, with a small orange
 * rule beside each city so the column has some rhythm.
 */
export async function buildLocations(scene) {
  const group = new THREE.Group();
  group.position.z = Z;

  const texts = [];

  const heading = makeText({
    text: 'FIND YOUR EM',
    size: 0.78,
    color: PALETTE.orange,
    letterSpacing: 0.34,
    position: [0, 6.6, 0],
  });
  group.add(heading);
  texts.push(heading);

  const tickMat = new THREE.MeshBasicMaterial({ color: PALETTE.orange });
  const tickGeo = new THREE.PlaneGeometry(0.5, 0.09);

  const spacing = 2.35;
  const top = 4.0;
  const left = -8.4;

  LOCATIONS.forEach((loc, i) => {
    const y = top - i * spacing;

    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.position.set(left - 1.1, y + 0.35, 0);
    group.add(tick);

    const city = makeText({
      text: loc.city,
      size: 1.05,
      color: PALETTE.cream,
      anchorX: 'left',
      position: [left, y + 0.35, 0],
    });
    const address = makeText({
      text: loc.address,
      size: 0.44,
      color: PALETTE.cream,
      opacity: 0.45,
      letterSpacing: 0.1,
      anchorX: 'left',
      position: [left, y - 0.5, 0],
    });
    group.add(city, address);
    texts.push(city, address);
  });

  const outro = makeText({
    text: 'poured slow, seven days a week',
    script: true,
    size: 0.95,
    color: PALETTE.orange,
    position: [0, -6.4, 2.2],
  });
  group.add(outro);
  texts.push(outro);

  await Promise.all(texts.map(syncText));
  scene.add(group);

  function layout(portrait) {
    group.scale.setScalar(portrait ? 0.66 : 1);
  }

  return { group, layout };
}
