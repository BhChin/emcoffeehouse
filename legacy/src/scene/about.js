import * as THREE from 'three';
import { PALETTE, ABOUT_LINES, STOPS, STOP_INDEX } from '../config.js';
import { makeText, syncText } from '../core/text.js';

const Z = STOPS[STOP_INDEX.about].target[2];

/**
 * The quiet stop. Three stacked lines of grotesque, with the hashtag in orange
 * script drifting slightly closer to the camera so it separates on parallax.
 */
export async function buildAbout(scene) {
  const group = new THREE.Group();
  group.position.z = Z;

  const lines = ABOUT_LINES.map((text, i) =>
    makeText({
      text,
      size: 1.5,
      color: PALETTE.cream,
      letterSpacing: 0.02,
      position: [0, 3.6 - i * 2.05, 0],
    })
  );
  group.add(...lines);

  const tag = makeText({
    text: '#BeInTheMoment',
    script: true,
    size: 1.85,
    color: PALETTE.orange,
    position: [0, -3.4, 3.4],
    rotation: [0, 0, -0.06],
  });
  group.add(tag);

  await Promise.all([...lines, tag].map(syncText));
  scene.add(group);

  function layout(portrait) {
    group.scale.setScalar(portrait ? 0.6 : 1);
  }

  return { group, tag, layout };
}
