import * as THREE from 'three';
import { PALETTE, MENU_ITEMS, STOPS, STOP_INDEX } from '../config.js';
import { makeText, syncText } from '../core/text.js';

const WALL_Z = STOPS[STOP_INDEX.menu].target[2];

/**
 * Drink names mounted like a cafe letterboard. Each row is its own group so it
 * can tilt toward the camera on hover, with an invisible plane in front acting
 * as the raycast target (troika glyph geometry is a poor hit surface).
 */
export async function buildMenuWall(scene) {
  const group = new THREE.Group();
  group.position.z = WALL_Z;

  // The board itself — a slab a touch lighter than the wall so it reads as an
  // object rather than paint.
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(30, 17, 0.6),
    new THREE.MeshStandardMaterial({ color: '#1B303C', roughness: 0.95, metalness: 0 })
  );
  board.position.z = -1.2;
  group.add(board);

  const heading = makeText({
    text: 'THE MENU',
    size: 0.78,
    color: PALETTE.orange,
    letterSpacing: 0.34,
    position: [0, 6.4, 0.1],
  });
  group.add(heading);

  const rows = [];
  const rowGroups = [];
  const spacing = 2.45;
  const top = 3.9;

  MENU_ITEMS.forEach((item, i) => {
    const row = new THREE.Group();
    row.position.set(0, top - i * spacing, 0);

    const name = makeText({
      text: item.name,
      size: 1.32,
      color: PALETTE.cream,
      position: [0, 0.32, 0.1],
    });
    const note = makeText({
      text: item.note,
      size: 0.42,
      color: PALETTE.cream,
      opacity: 0.42,
      letterSpacing: 0.12,
      position: [0, -0.72, 0.1],
    });
    row.add(name, note);

    // Hover proxy — invisible, but still raycastable.
    const hit = new THREE.Mesh(
      new THREE.PlaneGeometry(20, spacing * 0.92),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.z = 0.4;
    row.add(hit);

    row.userData = { name, note, hit, hover: 0 };
    group.add(row);
    rows.push({ hit, row });
    rowGroups.push(row);
  });

  await Promise.all(
    [heading, ...rowGroups.flatMap((r) => [r.userData.name, r.userData.note])].map(syncText)
  );

  scene.add(group);

  const creamColor = new THREE.Color(PALETTE.cream);
  const orangeColor = new THREE.Color(PALETTE.orange);
  const tmp = new THREE.Color();

  function update(_elapsed, dt, hoveredObject) {
    for (const row of rowGroups) {
      const isHovered = hoveredObject === row.userData.hit;
      const target = isHovered ? 1 : 0;
      // Frame-rate independent approach toward the hover state.
      const k = 1 - Math.exp(-dt * 10);
      row.userData.hover += (target - row.userData.hover) * k;
      const h = row.userData.hover;

      // Tilt toward the camera and lean out of the board.
      row.rotation.x = -h * 0.22;
      row.position.z = h * 1.5;

      tmp.copy(creamColor).lerp(orangeColor, h);
      row.userData.name.color = tmp.getHex();
      row.userData.note.fillOpacity = 0.42 + h * 0.35;
    }
  }

  function layout(portrait) {
    group.scale.setScalar(portrait ? 0.62 : 1);
  }

  return { group, update, layout, hitTargets: rows.map((r) => r.hit) };
}
