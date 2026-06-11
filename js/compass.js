
"use strict";
const COMPASS_MATH = (() => {
  // Tilt-compensated compass heading from deviceorientation Euler angles
  // (degrees), 0..360 clockwise from north. Derived from the spec's
  // rotation matrix R = Rz(alpha)·Rx(beta)·Ry(gamma) with the Earth frame
  // x=East, y=North, z=Up:
  //   device top edge (y-axis) in Earth frame: E=-sinA·cosB, N=cosA·cosB
  //   back camera (-z axis) in Earth frame:
  //     E=-(cosA·sinG + sinA·sinB·cosG), N=-sinA·sinG + cosA·sinB·cosG
  // The top-edge vector is what a flat "compass-style" hold points with,
  // but it degenerates when the phone is upright (top points at the sky);
  // the back-camera vector covers exactly that case. For an un-rolled
  // phone both project to the same heading. The camera term is weighted
  // by max(0, sin beta) so that device roll (gamma) cannot leak into the
  // heading while the phone is held flat — flat reads are exact, upright
  // reads use the camera, and the blend is smooth in between.
  function headingFromEuler(alpha, beta, gamma) {
    const d2r = Math.PI / 180;
    const a = (alpha || 0) * d2r, b = (beta || 0) * d2r, g = (gamma || 0) * d2r;
    const cA = Math.cos(a), sA = Math.sin(a);
    const cB = Math.cos(b), sB = Math.sin(b);
    const cG = Math.cos(g), sG = Math.sin(g);
    const topE = -sA * cB,                 topN = cA * cB;
    const camE = -(cA * sG + sA * sB * cG), camN = -sA * sG + cA * sB * cG;
    const w = Math.max(0, sB);
    let heading = Math.atan2(topE + w * camE, topN + w * camN);
    if (heading < 0) heading += 2 * Math.PI;
    return heading * 180 / Math.PI;
  }

  // Compensate for UI rotation: screen-up direction = device-top heading
  // + screen angle (screen.orientation.angle: 90 when the device is
  // turned counter-clockwise into landscape, so screen-up = device right
  // edge = device-top + 90°).
  function applyScreenAngle(heading, screenAngle) {
    return ((heading + (screenAngle || 0)) % 360 + 360) % 360;
  }

  // Exponential smoothing on the unit circle (no 359→0 jump artifacts).
  function makeSmoother(factor = 0.25) {
    let sx = null, sy = null;
    return function smooth(headingDeg) {
      const r = headingDeg * Math.PI / 180;
      const x = Math.sin(r), y = Math.cos(r);
      if (sx === null) { sx = x; sy = y; }
      else { sx += factor * (x - sx); sy += factor * (y - sy); }
      return (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360;
    };
  }

  return { headingFromEuler, applyScreenAngle, makeSmoother };
})();
if (typeof module !== "undefined") module.exports.COMPASS_MATH = COMPASS_MATH;
