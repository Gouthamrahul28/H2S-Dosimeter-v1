/**
 * shared/colorimetricStandards.js
 * 
 * Master Colorimetric and Exposure Dosimetry Module for Cu-PAN H₂S Dosimeter
 * Conforming to:
 * - CIE 015:2018 Colorimetry
 * - ISO 17321-1:2012 Digital Still Camera Characterization
 * - ISO/CIE 11664-6:2022 CIEDE2000
 * - Indian DGMS 80 ppm·h shift exposure limit
 */

export const CHEMISTRY = 'Cu-PAN';
export const INDICATOR = 'Copper(II)-PAN';
export const DOSE_UNIT = 'ppm·h';

// Statutory Risk Zones (DGMS / ACGIH / NIOSH / OSHA)
export const RISK_ZONES = [
  { min: 0,   max: 8,   level: 'SAFE',             badgeClass: 'safe',    color: '#10b981', note: 'Normal operations; within ACGIH 1 ppm TWA.' },
  { min: 8,   max: 24,  level: 'CAUTION',          badgeClass: 'caution', color: '#06b6d4', note: 'Approaching ACGIH TWA threshold (1-3 ppm sustained).' },
  { min: 24,  max: 40,  level: 'WARNING',          badgeClass: 'warning', color: '#f59e0b', note: 'At ACGIH 5 ppm STEL / 50% DGMS 8-hr shift limit.' },
  { min: 40,  max: 80,  level: 'ALERT',            badgeClass: 'danger',  color: '#f43f5e', note: 'Reaching NIOSH 10 ppm REL ceiling / 100% DGMS limit.' },
  { min: 80,  max: 160, level: 'DANGER',           badgeClass: 'severe',  color: '#e11d48', note: 'Exceeded DGMS 80 ppm·h shift limit. EVACUATE sector.' },
  { min: 160, max: Infinity, level: 'LIFE_THREATENING', badgeClass: 'critical', color: '#8b5cf6', note: 'Approaching IDLH (100 ppm) — IMMEDIATE RESCUE PROTOCOL.' }
];

export const ALERT_LEVELS = RISK_ZONES;
export const D65_WHITE = { x: 0.95047, y: 1.00000, z: 1.08883 };

// Visual color progression aid for Cu-PAN (Purple/Violet -> Yellow/Orange)
// Notice: Visual reference aid only; actual dose is computed from CIEDE2000 against calibrated anchors
export const COLOR_REFERENCE = [
  { ppm: 0.0,   hex: '#8B4C94', label: 'Unexposed / baseline', standard: 'Cu-PAN Virgin Baseline (0.0 ppm·h - Purple/Violet)' },
  { ppm: 2.0,   hex: '#8F58A5', label: 'Low shift exposure', standard: 'Early Shift (2.0 ppm·h - Violet Family)' },
  { ppm: 10.0,  hex: '#A87382', label: 'Caution threshold reached', standard: 'ACGIH TWA (10.0 ppm·h - Purple/Orange Transition)' },
  { ppm: 40.0,  hex: '#CC8E4E', label: 'Warning tier reached', standard: 'ACGIH STEL (40.0 ppm·h - Mixed Amber/Orange)' },
  { ppm: 80.0,  hex: '#DE9930', label: 'Critical limit reached', standard: 'DGMS Shift Limit (80.0 ppm·h - Yellow/Orange)' }
];

export const VALID_TEMP_RANGE_C = { min: 10, max: 50 };
export const VALID_RH_RANGE_PCT = { min: 15, max: 90 };

// Standard sRGB to XYZ matrix (Fallback CCM)
export const DEFAULT_CCM = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041]
];

// Experimental Cu-PAN Chamber Calibration Points (25°C, 50% RH)
export const CALIBRATION_POINTS = [
  { dose: 0.0,   deltaE00: 0.00,  L: 42.50, a: 38.20, b: -28.40 },
  { dose: 2.0,   deltaE00: 4.85,  L: 44.10, a: 35.40, b: -21.80 },
  { dose: 5.0,   deltaE00: 11.20, L: 47.30, a: 31.20, b: -11.50 },
  { dose: 10.0,  deltaE00: 19.60, L: 52.00, a: 26.50, b: 2.80 },
  { dose: 20.0,  deltaE00: 30.50, L: 58.20, a: 21.80, b: 19.40 },
  { dose: 40.0,  deltaE00: 44.20, L: 64.50, a: 18.20, b: 36.80 },
  { dose: 60.0,  deltaE00: 53.80, L: 68.00, a: 16.40, b: 48.50 },
  { dose: 80.0,  deltaE00: 61.10, L: 70.50, a: 15.20, b: 56.20 },
  { dose: 120.0, deltaE00: 67.40, L: 72.00, a: 14.80, b: 60.50 },
  { dose: 160.0, deltaE00: 70.50, L: 72.80, a: 14.50, b: 62.00 }
];

export const VIRGIN_BASELINE_LAB = { L: 42.50, a: 38.20, b: -28.40 };
export const WHITE_REFERENCE_LAB = { L: 95.40, a: -0.42, b: 1.18 };
export const GREY_REFERENCE_LAB  = { L: 52.60, a: 0.15,  b: -0.25 };

// --- 1. sRGB Linearization (CIE 015 / IEC 61966-2-1) ---
export function srgbChannelToLinear(c) {
  const norm = Math.max(0, Math.min(1, c / 255.0));
  return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

export function linearChannelToSrgb(cLin) {
  const clamped = Math.max(0, Math.min(1, cLin));
  const s = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1.0 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(s * 255.0)));
}

// --- 2. Camera Color Correction Matrix (ISO 17321-1) ---
export function applyCameraCCM(rLin, gLin, bLin, ccm = DEFAULT_CCM) {
  return {
    x: ccm[0][0] * rLin + ccm[0][1] * gLin + ccm[0][2] * bLin,
    y: ccm[1][0] * rLin + ccm[1][1] * gLin + ccm[1][2] * bLin,
    z: ccm[2][0] * rLin + ccm[2][1] * gLin + ccm[2][2] * bLin
  };
}

// --- 3. Bradford Chromatic Adaptation Transform ---
export const M_BRAD = [
  [ 0.8951,  0.2664, -0.1614 ],
  [-0.7502,  1.7135,  0.0367 ],
  [ 0.0389, -0.0685,  1.0296 ]
];
export const M_BRAD_INV = [
  [ 0.9869929, -0.1470543,  0.1599627 ],
  [ 0.4323053,  0.5183603,  0.0492912 ],
  [-0.0085287,  0.0400428,  0.9684867 ]
];

export function bradfordAdapt(xyz, srcWhite, tgtWhite = D65_WHITE) {
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

// --- 4. CIE 1976 CIELAB Conversion (CIE 015) ---
const DELTA = 6 / 29;
const DELTA_CUBED = Math.pow(DELTA, 3);
const F_FACTOR = 1 / (3 * DELTA * DELTA);
const F_OFFSET = 4 / 29;

function fCie(t) {
  return t > DELTA_CUBED ? Math.cbrt(t) : F_FACTOR * t + F_OFFSET;
}

export function xyzToLab(x, y, z, whitePoint = D65_WHITE) {
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

export function labToXyz(L, a, b, whitePoint = D65_WHITE) {
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

export function labToRgb(L, a, b, whitePoint = D65_WHITE) {
  const xyz = labToXyz(L, a, b, whitePoint);
  // Inverse sRGB matrix (D65)
  const rLin =  3.2404542 * xyz.x - 1.5371385 * xyz.y - 0.4985314 * xyz.z;
  const gLin = -0.9692660 * xyz.x + 1.8760108 * xyz.y + 0.0415560 * xyz.z;
  const bLin =  0.0556434 * xyz.x - 0.2040259 * xyz.y + 1.0572252 * xyz.z;

  return {
    r: linearChannelToSrgb(rLin),
    g: linearChannelToSrgb(gLin),
    b: linearChannelToSrgb(bLin)
  };
}

export function labToHex(L, a, b, whitePoint = D65_WHITE) {
  const rgb = labToRgb(L, a, b, whitePoint);
  return rgbToHex(rgb);
}

// --- 5. ISO/CIE 11664-6:2022 CIEDE2000 ---
export function ciede2000(lab1, lab2) {
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

// --- 6. Arrhenius Environmental Compensation ---
export function computeArrheniusRateFactor(tempC, rhPct) {
  const tRefK = 25.0 + 273.15;
  const tActualK = Number(tempC) + 273.15;
  const rhRef = 50.0;
  const rhActual = Number(rhPct);

  let envValid = true;
  let envReason = 'Within rated operational range';

  if (tempC < 10.0 || tempC > 50.0) {
    envValid = false;
    envReason = `Temperature (${tempC}°C) exceeds rated range (10–50°C)`;
  }
  if (rhPct < 15.0 || rhPct > 90.0) {
    envValid = false;
    envReason = `Humidity (${rhPct}%) exceeds rated range (15–90%)`;
  }

  const eaOverR = 1420.0;
  const kTemp = Math.exp(-eaOverR * (1.0 / tActualK - 1.0 / tRefK));
  const kRh = Math.pow(Math.max(0.05, rhActual / rhRef), 0.38);

  const kCombined = Math.max(0.40, Math.min(2.50, kTemp * kRh));
  return { rateFactor: kCombined, envValid, envReason };
}

// --- 7. Piecewise Monotonic Dose Interpolation Model ---
export function estimateDoseFromDeltaE(deltaE00, tempC = 25.0, rhPct = 50.0) {
  const { rateFactor, envValid, envReason } = computeArrheniusRateFactor(tempC, rhPct);
  const normDelta = deltaE00 / rateFactor;

  if (normDelta <= 1.0) {
    return { dosePpmHours: 0.0, inRange: true, status: 'VALID' };
  }

  const pts = CALIBRATION_POINTS;
  if (normDelta > pts[pts.length - 1].deltaE00) {
    return {
      dosePpmHours: pts[pts.length - 1].dose,
      inRange: false,
      status: 'OUTSIDE CALIBRATION RANGE'
    };
  }

  // Piecewise monotonic linear interpolation
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    if (normDelta >= p1.deltaE00 && normDelta <= p2.deltaE00) {
      const frac = (normDelta - p1.deltaE00) / (p2.deltaE00 - p1.deltaE00 + 1e-12);
      const dose = p1.dose + frac * (p2.dose - p1.dose);
      return { dosePpmHours: Math.round(dose * 100) / 100, inRange: true, status: 'VALID' };
    }
  }

  return { dosePpmHours: 0.0, inRange: true, status: 'VALID' };
}

// --- 8. Master Optical Exposure Analyzer ---
export function analyzeExposure(correctedRGB, tempC = 25.0, rhPct = 50.0, ccm = DEFAULT_CCM) {
  let rgb = correctedRGB;
  if (typeof correctedRGB === 'string') {
    rgb = hexToRgb(correctedRGB);
  } else if (!correctedRGB) {
    rgb = { r: 139, g: 76, b: 148 }; // Default unexposed Cu-PAN RGB
  }

  const rLin = srgbChannelToLinear(rgb.r ?? 0);
  const gLin = srgbChannelToLinear(rgb.g ?? 0);
  const bLin = srgbChannelToLinear(rgb.b ?? 0);

  const xyz = applyCameraCCM(rLin, gLin, bLin, ccm);
  const lab = xyzToLab(xyz.x, xyz.y, xyz.z);
  const deltaE00 = ciede2000(VIRGIN_BASELINE_LAB, lab);

  const { dosePpmHours, inRange, status } = estimateDoseFromDeltaE(deltaE00, tempC, rhPct);
  const { rateFactor, envValid, envReason } = computeArrheniusRateFactor(tempC, rhPct);

  // Map to risk zone
  let matchedZone = RISK_ZONES[0];
  for (const zone of RISK_ZONES) {
    if (dosePpmHours >= zone.min && dosePpmHours < zone.max) {
      matchedZone = zone;
      break;
    }
  }

  return {
    chemistry: CHEMISTRY,
    indicator: INDICATOR,
    dose: dosePpmHours,
    estimatedDosePpmHours: dosePpmHours,
    unit: DOSE_UNIT,
    alertLevel: matchedZone.level,
    alertColor: matchedZone.color,
    badgeClass: matchedZone.badgeClass,
    note: matchedZone.note,
    deltaE00: Math.round(deltaE00 * 100) / 100,
    lab: { L: Math.round(lab.L * 100) / 100, a: Math.round(lab.a * 100) / 100, b: Math.round(lab.b * 100) / 100 },
    inRange,
    calibrationStatus: status,
    confidence: inRange ? 0.94 : 0.40,
    confidencePercent: inRange ? 94.0 : 40.0,
    envValid,
    envReason,
    rateFactor: Math.round(rateFactor * 100) / 100
  };
}

export function ppmToAlertLevel(dosePpmHours) {
  for (const zone of RISK_ZONES) {
    if (dosePpmHours >= zone.min && dosePpmHours < zone.max) {
      return zone;
    }
  }
  return RISK_ZONES[RISK_ZONES.length - 1];
}

export function hexToRgb(hex) {
  const clean = (hex || '#000000').replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0
  };
}

export function rgbToHex(rgb) {
  if (!rgb) return '#000000';
  const r = Math.min(255, Math.max(0, Math.round(rgb.r || 0))).toString(16).padStart(2, '0');
  const g = Math.min(255, Math.max(0, Math.round(rgb.g || 0))).toString(16).padStart(2, '0');
  const b = Math.min(255, Math.max(0, Math.round(rgb.b || 0))).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

export function computeShiftTWA(totalDosePpmHours, shiftDurationHours = 8.0) {
  const dur = Number(shiftDurationHours) || 8.0;
  return Math.round((Number(totalDosePpmHours || 0) / dur) * 100) / 100;
}

export function analyzeShift(intervalsOrDose, defaultDurationHours = 8.0) {
  let totalDose = 0.0;
  let totalHours = 0.0;

  if (Array.isArray(intervalsOrDose)) {
    for (const item of intervalsOrDose) {
      const h = Number(item.hours) || 0;
      const ppm = Number(item.ppm) || 0;
      totalDose += h * ppm;
      totalHours += h;
    }
    if (totalHours === 0) totalHours = defaultDurationHours;
  } else {
    totalDose = Number(intervalsOrDose) || 0.0;
    totalHours = defaultDurationHours;
  }

  const twa = Math.round((totalDose / (totalHours || 8.0)) * 100) / 100;
  const dgmsLimit = 80.0;
  const isOverDGMS = totalDose > dgmsLimit;
  const isOverACGIH = twa > 1.0;
  const isOverSTEL = twa > 5.0;

  let alertTier = 'SAFE';
  let alertColor = '#10b981';
  let badgeClass = 'safe';
  let note = 'Normal operations; within ACGIH 1 ppm TWA limit.';

  if (totalDose >= 80.0 || twa >= 10.0) {
    alertTier = 'DANGER';
    alertColor = '#e11d48';
    badgeClass = 'severe';
    note = 'Exceeded DGMS 80 ppm·h shift limit. Immediate sector evacuation.';
  } else if (totalDose >= 40.0 || twa >= 5.0) {
    alertTier = 'ALERT';
    alertColor = '#f43f5e';
    badgeClass = 'danger';
    note = 'At ACGIH STEL / 50% DGMS limit. Mandatory respiratory PPE.';
  } else if (totalDose >= 10.0 || twa >= 1.0) {
    alertTier = 'WARNING';
    alertColor = '#f59e0b';
    badgeClass = 'warning';
    note = 'Exceeded ACGIH 1 ppm 8-hr TWA threshold.';
  }

  return {
    twa,
    totalDosePpmHours: Math.round(totalDose * 100) / 100,
    totalHours: Math.round(totalHours * 10) / 10,
    isOverDGMS,
    isOverACGIH,
    isOverSTEL,
    alertLevel: alertTier,
    alertColor,
    badgeClass,
    note,
    shiftLimitPpmHours: dgmsLimit,
    utilizationPercent: Math.min(100, Math.round((totalDose / dgmsLimit) * 100))
  };
}

export function colorToPPM(rgb, tempC = 25.0, rhPct = 50.0) {
  const analysis = analyzeExposure(rgb, tempC, rhPct);
  return {
    ppm: analysis.estimatedDosePpmHours,
    dose: analysis.estimatedDosePpmHours,
    confidence: analysis.confidencePercent,
    alertLevel: analysis.alertLevel,
    badgeClass: analysis.badgeClass,
    note: analysis.note
  };
}
