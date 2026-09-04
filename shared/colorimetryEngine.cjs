/**
 * shared/colorimetryEngine.cjs
 * 
 * Standardized, Chemistry-Agnostic Colorimetric Core Engine (CommonJS).
 * Conforming strictly to:
 * - CIE 015:2018 Colorimetry (Standard Illuminant D65, 2° Standard Observer)
 * - IEC 61966-2-1:1999 sRGB Default RGB Colour Space (Piecewise Linearization)
 * - ISO 17321-1:2012 Graphic technology and photography — Colour characterization of digital cameras
 * - CIE 015 / Hunt-Pointer-Estevez / Bradford Chromatic Adaptation Transform (CAT)
 * - ISO/CIE 11664-6:2022 CIEDE2000 Total Colour Difference Formula
 * 
 * ZERO chemistry assumptions, ZERO reagent thresholds, ZERO baseline coordinates.
 */

// CIE Standard Illuminant D65 Reference White Point (2° Standard Observer)
const D65_WHITE = Object.freeze({
  x: 0.95047,
  y: 1.00000,
  z: 1.08883
});

// ISO 17321-1 Standard sRGB to CIE XYZ Matrix (D65 Reference)
const DEFAULT_CCM = Object.freeze([
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041]
]);

// Bradford Chromatic Adaptation Transform Cone Response Matrices
const M_BRAD = Object.freeze([
  [ 0.8951,  0.2664, -0.1614 ],
  [-0.7502,  1.7135,  0.0367 ],
  [ 0.0389, -0.0685,  1.0296 ]
]);

const M_BRAD_INV = Object.freeze([
  [ 0.9869929, -0.1470543,  0.1599627 ],
  [ 0.4323053,  0.5183603,  0.0492912 ],
  [-0.0085287,  0.0400428,  0.9684867 ]
]);

/**
 * 1. sRGB Channel Linearization (IEC 61966-2-1)
 */
function srgbChannelToLinear(c) {
  const norm = Math.max(0, Math.min(1, Number(c) / 255.0));
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

/**
 * Inverse sRGB Channel Linearization (IEC 61966-2-1)
 */
function linearChannelToSrgb(cLin) {
  const clamped = Math.max(0, Math.min(1, Number(cLin)));
  const s = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1.0 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(s * 255.0)));
}

function srgbToLinearRgb(rgb) {
  return {
    r: srgbChannelToLinear(rgb.r ?? 0),
    g: srgbChannelToLinear(rgb.g ?? 0),
    b: srgbChannelToLinear(rgb.b ?? 0)
  };
}

function linearToSrgbRgb(linRgb) {
  return {
    r: linearChannelToSrgb(linRgb.r ?? 0),
    g: linearChannelToSrgb(linRgb.g ?? 0),
    b: linearChannelToSrgb(linRgb.b ?? 0)
  };
}

/**
 * 2. Camera Color Correction Matrix (CCM) Application (ISO 17321-1)
 */
function applyCameraCCM(rLin, gLin, bLin, ccm = DEFAULT_CCM) {
  return {
    x: ccm[0][0] * rLin + ccm[0][1] * gLin + ccm[0][2] * bLin,
    y: ccm[1][0] * rLin + ccm[1][1] * gLin + ccm[1][2] * bLin,
    z: ccm[2][0] * rLin + ccm[2][1] * gLin + ccm[2][2] * bLin
  };
}

/**
 * 3. Bradford Chromatic Adaptation Transform (CAT)
 */
function bradfordAdapt(xyz, srcWhite, tgtWhite = D65_WHITE) {
  if (!srcWhite || !tgtWhite) return xyz;

  const diff = Math.hypot(srcWhite.x - tgtWhite.x, srcWhite.y - tgtWhite.y, srcWhite.z - tgtWhite.z);
  if (diff < 1e-4) return xyz;

  const lmsSrc = {
    l: M_BRAD[0][0] * srcWhite.x + M_BRAD[0][1] * srcWhite.y + M_BRAD[0][2] * srcWhite.z,
    m: M_BRAD[1][0] * srcWhite.x + M_BRAD[1][1] * srcWhite.y + M_BRAD[1][2] * srcWhite.z,
    s: M_BRAD[2][0] * srcWhite.x + M_BRAD[2][1] * srcWhite.y + M_BRAD[2][2] * srcWhite.z
  };

  const lmsTgt = {
    l: M_BRAD[0][0] * tgtWhite.x + M_BRAD[0][1] * tgtWhite.y + M_BRAD[0][2] * tgtWhite.z,
    m: M_BRAD[1][0] * tgtWhite.x + M_BRAD[1][1] * tgtWhite.y + M_BRAD[1][2] * tgtWhite.z,
    s: M_BRAD[2][0] * tgtWhite.x + M_BRAD[2][1] * tgtWhite.y + M_BRAD[2][2] * tgtWhite.z
  };

  const gL = lmsSrc.l !== 0 ? lmsTgt.l / lmsSrc.l : 1;
  const gM = lmsSrc.m !== 0 ? lmsTgt.m / lmsSrc.m : 1;
  const gS = lmsSrc.s !== 0 ? lmsTgt.s / lmsSrc.s : 1;

  const lms = {
    l: (M_BRAD[0][0] * xyz.x + M_BRAD[0][1] * xyz.y + M_BRAD[0][2] * xyz.z) * gL,
    m: (M_BRAD[1][0] * xyz.x + M_BRAD[1][1] * xyz.y + M_BRAD[1][2] * xyz.z) * gM,
    s: (M_BRAD[2][0] * xyz.x + M_BRAD[2][1] * xyz.y + M_BRAD[2][2] * xyz.z) * gS
  };

  return {
    x: Math.max(0, M_BRAD_INV[0][0] * lms.l + M_BRAD_INV[0][1] * lms.m + M_BRAD_INV[0][2] * lms.s),
    y: Math.max(0, M_BRAD_INV[1][0] * lms.l + M_BRAD_INV[1][1] * lms.m + M_BRAD_INV[1][2] * lms.s),
    z: Math.max(0, M_BRAD_INV[2][0] * lms.l + M_BRAD_INV[2][1] * lms.m + M_BRAD_INV[2][2] * lms.s)
  };
}

// 4. CIE 1976 CIELAB Conversion Transfer Function Constants (CIE 015)
const DELTA = 6 / 29;
const DELTA_CUBED = Math.pow(DELTA, 3);
const F_FACTOR = 1 / (3 * DELTA * DELTA);
const F_OFFSET = 4 / 29;

function fCie(t) {
  return t > DELTA_CUBED ? Math.cbrt(t) : F_FACTOR * t + F_OFFSET;
}

function xyzToLab(x, y, z, whitePoint = D65_WHITE) {
  const xr = x / whitePoint.x;
  const yr = y / whitePoint.y;
  const zr = z / whitePoint.z;

  const fx = fCie(xr);
  const fy = fCie(yr);
  const fz = fCie(zr);

  return {
    L: Math.max(0, Math.min(100, 116 * fy - 16)),
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

function labToXyz(L, a, b, whitePoint = D65_WHITE) {
  const fy = (L + 16.0) / 116.0;
  const fx = a / 500.0 + fy;
  const fz = fy - b / 200.0;

  const xr = fx > DELTA ? Math.pow(fx, 3) : (fx - F_OFFSET) / F_FACTOR;
  const yr = fy > DELTA ? Math.pow(fy, 3) : (fy - F_OFFSET) / F_FACTOR;
  const zr = fz > DELTA ? Math.pow(fz, 3) : (fz - F_OFFSET) / F_FACTOR;

  return {
    x: xr * whitePoint.x,
    y: yr * whitePoint.y,
    z: zr * whitePoint.z
  };
}

function labToRgb(L, a, b, whitePoint = D65_WHITE) {
  const xyz = labToXyz(L, a, b, whitePoint);
  const rLin =  3.2404542 * xyz.x - 1.5371385 * xyz.y - 0.4985314 * xyz.z;
  const gLin = -0.9692660 * xyz.x + 1.8760108 * xyz.y + 0.0415560 * xyz.z;
  const bLin =  0.0556434 * xyz.x - 0.2040259 * xyz.y + 1.0572252 * xyz.z;

  return {
    r: linearChannelToSrgb(rLin),
    g: linearChannelToSrgb(gLin),
    b: linearChannelToSrgb(bLin)
  };
}

/**
 * 5. ISO/CIE 11664-6:2022 CIEDE2000 Total Colour Difference
 */
function ciede2000(lab1, lab2) {
  const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2.0;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1.0 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7) + 1e-18)));

  const a1p = (1.0 + G) * a1;
  const a2p = (1.0 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const rad2deg = 180.0 / Math.PI;
  const deg2rad = Math.PI / 180.0;

  const h1p = (Math.atan2(b1, a1p) * rad2deg + 360.0) % 360.0;
  const h2p = (Math.atan2(b2, a2p) * rad2deg + 360.0) % 360.0;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0.0;
  if (C1p * C2p !== 0.0) {
    if (Math.abs(h2p - h1p) <= 180.0) {
      dhp = h2p - h1p;
    } else if (h2p - h1p > 180.0) {
      dhp = h2p - h1p - 360.0;
    } else {
      dhp = h2p - h1p + 360.0;
    }
  }
  const dHp = 2.0 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2.0) * deg2rad);

  const Lbarp = (L1 + L2) / 2.0;
  const Cbarp = (C1p + C2p) / 2.0;

  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0.0) {
    if (Math.abs(h1p - h2p) <= 180.0) {
      hbarp = (h1p + h2p) / 2.0;
    } else if (h1p + h2p < 360.0) {
      hbarp = (h1p + h2p + 360.0) / 2.0;
    } else {
      hbarp = (h1p + h2p - 360.0) / 2.0;
    }
  }

  const T = 1.0 - 0.17 * Math.cos((hbarp - 30.0) * deg2rad)
                + 0.24 * Math.cos(2.0 * hbarp * deg2rad)
                + 0.32 * Math.cos((3.0 * hbarp + 6.0) * deg2rad)
                - 0.20 * Math.cos((4.0 * hbarp - 63.0) * deg2rad);

  const LbarMinus50Sq = Math.pow(Lbarp - 50.0, 2);
  const SL = 1.0 + (0.015 * LbarMinus50Sq) / Math.sqrt(20.0 + LbarMinus50Sq);
  const SC = 1.0 + 0.045 * Cbarp;
  const SH = 1.0 + 0.015 * Cbarp * T;

  const dTheta = 30.0 * Math.exp(-Math.pow((hbarp - 275.0) / 25.0, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2.0 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7) + 1e-18));
  const RT = -RC * Math.sin(2.0 * dTheta * deg2rad);

  const termL = dLp / SL;
  const termC = dCp / SC;
  const termH = dHp / SH;

  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * termC * termH);
}

function hexToRgb(hex) {
  const clean = (hex || '#000000').replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0
  };
}

function rgbToHex(rgb) {
  if (!rgb) return '#000000';
  const r = Math.min(255, Math.max(0, Math.round(rgb.r || 0))).toString(16).padStart(2, '0');
  const g = Math.min(255, Math.max(0, Math.round(rgb.g || 0))).toString(16).padStart(2, '0');
  const b = Math.min(255, Math.max(0, Math.round(rgb.b || 0))).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

module.exports = {
  D65_WHITE,
  DEFAULT_CCM,
  M_BRAD,
  M_BRAD_INV,
  srgbChannelToLinear,
  linearChannelToSrgb,
  srgbToLinearRgb,
  linearToSrgbRgb,
  applyCameraCCM,
  bradfordAdapt,
  xyzToLab,
  labToXyz,
  labToRgb,
  ciede2000,
  hexToRgb,
  rgbToHex
};
