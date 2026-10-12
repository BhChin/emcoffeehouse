import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { makeText, syncText } from '../core/text.js';

// The "EM" is drawn as straight-edged shapes rather than loaded from a typeface
// file: two letters of a heavy extended grotesque are cheap to author by hand,
// and it keeps real extrusion (with a bevel) without shipping a font converter.
const H = 1.4; // cap height
const T = 0.34; // stem weight — deliberately fat

function letterE() {
  const w = 1.12;
  const arm = 0.3;
  const midHalf = 0.15;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(w, arm);
  s.lineTo(T, arm);
  s.lineTo(T, H / 2 - midHalf);
  s.lineTo(w * 0.88, H / 2 - midHalf);
  s.lineTo(w * 0.88, H / 2 + midHalf);
  s.lineTo(T, H / 2 + midHalf);
  s.lineTo(T, H - arm);
  s.lineTo(w, H - arm);
  s.lineTo(w, H);
  s.lineTo(0, H);
  s.closePath();
  return { shape: s, width: w };
}

function letterM() {
  const w = 1.62; // extended — the M carries the width of the wordmark
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(T, 0);
  s.lineTo(T, H * 0.6);
  s.lineTo(w / 2, H * 0.16);
  s.lineTo(w - T, H * 0.6);
  s.lineTo(w - T, 0);
  s.lineTo(w, 0);
  s.lineTo(w, H);
  s.lineTo(w - T * 0.92, H);
  s.lineTo(w / 2, H * 0.44);
  s.lineTo(T * 0.92, H);
  s.lineTo(0, H);
  s.closePath();
  return { shape: s, width: w };
}

/**
 * Hero wordmark: extruded EM in cream, with "cà phê" in script overlapping it
 * at a tilt. The two sit at different Z so mouse parallax pulls them apart.
 */
export async function buildWordmark(scene) {
  const group = new THREE.Group();

  const extrude = {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 1,
  };

  // One material shared by both letters.
  const creamMatte = new THREE.MeshStandardMaterial({
    color: PALETTE.cream,
    roughness: 0.82,
    metalness: 0,
  });

  // Two nested groups on purpose: the inner one carries the recentring offset
  // in *letter* units, the outer one carries the scale. Putting both on a
  // single object would leave the offset unscaled and throw the wordmark
  // sideways by the full hero scale factor.
  const glyphs = new THREE.Group();
  const tracking = 0.16;
  let cursor = 0;
  for (const make of [letterE, letterM]) {
    const { shape, width } = make();
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extrude), creamMatte);
    mesh.position.x = cursor;
    glyphs.add(mesh);
    cursor += width + tracking;
  }
  const totalWidth = cursor - tracking;
  glyphs.position.set(-totalWidth / 2, -H / 2, 0);

  const letters = new THREE.Group();
  letters.add(glyphs);
  letters.scale.setScalar(7.6);
  group.add(letters);

  // Script overlay, pushed toward the camera so it parallaxes independently.
  const script = makeText({
    text: 'cà phê',
    script: true,
    size: 3.5,
    color: PALETTE.orange,
    position: [1.6, -2.9, 6.2],
    rotation: [0, 0, -0.13],
  });
  await syncText(script);
  group.add(script);

  scene.add(group);
  return { group, letters, script };
}
