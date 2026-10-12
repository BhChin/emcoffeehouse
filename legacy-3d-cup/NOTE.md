The procedurally-modelled Three.js paper cup, replaced 2026-07-28 by the 2.5D photo drink (src/drink.js). Kept for the geometry/lighting reference.


## Notes moved out of the main README

**The cup's framing is computed, not hand-tuned.** `resize()` solves for the
camera distance that fits `FIT_W`/`FIT_H` at the current aspect, so the cup
fills its stage identically on a tall desktop column and a square mobile band.
The cup is tilted 12° clockwise, which means a point `(x, y)` lands at
`x·cos12° + y·sin12°` — putting the extremes at the lid rim (`x' ≈ +1.37`) and
the base's low corner (`x' ≈ -0.98`). So the silhouette spans ~1.18 either side
of `x' ≈ 0.19`, *not* either side of the axis, which is what `LOOK_X` corrects.
`LOOK_Y` sits slightly low so the cup floats above its shadow rather than
resting on it. `FIT_H` carries the bob and the pointer's x-tilt on top of the
static height — at 1.80 the peak of the bob left only 1.7% headroom.


**The lid is a three-part stack** — skirt cylinder, torus rim, then a smaller
raised cylinder for the sip dome — each placed against the top of the one
below. Check the silhouette after any change to it: an earlier version used a
`thetaLength` sphere cap for the dome, whose rim radius is a function of the
angle, so it floated free of the skirt and opened a visible hole. A row-by-row
alpha scan of the render is the quickest way to catch that.


**`u=0` faces the camera.** `CylinderGeometry` starts its UV wrap at +Z, so a
logo drawn at the centre of the wrap texture lands on the *back* of the cup.
`map.offset.x = 0.5` brings it round to the front without rotating the mesh.

