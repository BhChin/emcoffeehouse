/* TEMPORARY tuning panel — ?debug=1 in dev only. Delete this file (and the
   dynamic import in main.js) once the values are baked into the uniform
   defaults in drink.js. */
import GUI from 'lil-gui';

export async function mountTuning(drink) {
  const u = drink?.uniforms;
  if (!u?.uRipple) {
    console.info('[em] no ripple pipeline (reduced motion or no mask) — panel skipped');
    return null;
  }
  const gui = new GUI({ title: 'Liquid ripple' });

  gui.add(u.uAmp, 'value', 0, 0.05, 0.001).name('uAmp (reference 0.022)');
  gui.add(u.uFreq, 'value', 8, 70, 1).name('uFreq / rings');
  gui.add(u.uLife, 'value', 0.6, 4, 0.1).name('uLife / settle (s)');
  gui.add(u.uTint, 'value', 0, 1, 0.025).name('crest tint (ref 0.55)');
  gui.add(u.uHasMask, 'value', 0, 1, 1).name('mask on/off (compare)');

  gui
    .add(
      {
        dump: () =>
          console.log(
            `uAmp ${u.uAmp.value}\nuFreq ${u.uFreq.value}\n` +
              `uLife ${u.uLife.value}\nuTint ${u.uTint.value}`
          ),
      },
      'dump'
    )
    .name('log values →  console');

  return gui;
}
