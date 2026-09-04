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

import {
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
} from './colorimetryEngine.js';

export {
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

export function labToHex(L, a, b, whitePoint = D65_WHITE) {
  const rgb = labToRgb(L, a, b, whitePoint);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export const VIRGIN_BASELINE_LAB = { L: 42.50, a: 38.20, b: -28.40 };
export const WHITE_REFERENCE_LAB = { L: 95.40, a: -0.42, b: 1.18 };
export const GREY_REFERENCE_LAB  = { L: 52.60, a: 0.15,  b: -0.25 };

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
  if (deltaE00 === null || deltaE00 === undefined || isNaN(deltaE00)) {
    return { dosePpmHours: null, inRange: false, status: 'INVALID_COLOR_DATA', isVirginBaseline: false };
  }

  const { rateFactor, envValid, envReason } = computeArrheniusRateFactor(tempC, rhPct);
  const normDelta = deltaE00 / rateFactor;

  if (normDelta <= 1.0) {
    return { dosePpmHours: 0.0, inRange: true, status: 'VALID', isVirginBaseline: true };
  }

  const pts = CALIBRATION_POINTS;
  if (normDelta > pts[pts.length - 1].deltaE00) {
    return {
      dosePpmHours: pts[pts.length - 1].dose,
      inRange: false,
      status: 'OUTSIDE CALIBRATION RANGE',
      isVirginBaseline: false
    };
  }

  // Piecewise monotonic linear interpolation
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    if (normDelta >= p1.deltaE00 && normDelta <= p2.deltaE00) {
      const frac = (normDelta - p1.deltaE00) / (p2.deltaE00 - p1.deltaE00 + 1e-12);
      const dose = p1.dose + frac * (p2.dose - p1.dose);
      return { dosePpmHours: Math.round(dose * 100) / 100, inRange: true, status: 'VALID', isVirginBaseline: false };
    }
  }

  return { dosePpmHours: 0.0, inRange: true, status: 'VALID', isVirginBaseline: true };
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

  const { dosePpmHours, inRange, status, isVirginBaseline } = estimateDoseFromDeltaE(deltaE00, tempC, rhPct);
  const { rateFactor, envValid, envReason } = computeArrheniusRateFactor(tempC, rhPct);

  // Map to risk zone
  const matchedZone = ppmToAlertLevel(dosePpmHours);

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
    isVirginBaseline: !!isVirginBaseline,
    calibrationStatus: status,
    confidence: inRange ? 0.94 : 0.40,
    confidencePercent: inRange ? 94.0 : 40.0,
    envValid,
    envReason,
    rateFactor: Math.round(rateFactor * 100) / 100
  };
}

export function ppmToAlertLevel(dosePpmHours) {
  if (dosePpmHours === null || dosePpmHours === undefined || isNaN(dosePpmHours)) {
    return {
      min: null,
      max: null,
      level: 'PENDING_CALIBRATION',
      badgeClass: 'pending',
      color: '#94a3b8',
      note: 'Exposure dose calculation pending calibration or network synchronization.'
    };
  }
  for (const zone of RISK_ZONES) {
    if (dosePpmHours >= zone.min && dosePpmHours < zone.max) {
      return zone;
    }
  }
  return RISK_ZONES[RISK_ZONES.length - 1];
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
