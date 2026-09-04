/**
 * H2S-SafeTrack: Lead(II) Acetate Calibration Data & Safety Standards
 * 
 * Chemocassette Reaction:
 * Pb(CH3COO)2 + H2S (g) -> PbS (insoluble brownish-black precipitate) + 2 CH3COOH
 * 
 * Chemistry: Exclusively Lead(II) Acetate Trihydrate.
 */

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorLab {
  L: number;
  a: number;
  b: number;
}

export type SafetyAlertLevel =
  | 'SAFE'
  | 'SAFE / TRACE'
  | 'SAFE - TRACE'
  | 'CAUTION'
  | 'WARNING / EXCEEDS PEL'
  | 'WARNING'
  | 'DANGER'
  | 'CRITICAL HAZARD - EVACUATE'
  | 'CRITICAL HAZARD';

export interface CalibrationAnchor {
  id: number;
  name: string;
  h2sPpm: number;
  ppmRangeMin: number;
  ppmRangeMax: number;
  hex: string;
  rgb: ColorRGB;
  lab: ColorLab;
  opticalDensityRange: [number, number];
  nominalOpticalDensity: number;
  deltaERange: [number, number];
  nominalDeltaE: number;
  ehsStatus: SafetyAlertLevel;
  badgeClass: 'safe' | 'trace' | 'caution' | 'warning' | 'danger' | 'critical';
  oshaAcgihGuidance: string;
  recommendedAction: string;
}

export const PRISTINE_UNEXPOSED_PAPER_LAB: ColorLab = Object.freeze({
  L: 97.0,
  a: -0.4,
  b: 3.9,
});

export const REFERENCE_WHITE_STANDARD_LAB: ColorLab = Object.freeze({
  L: 98.0,
  a: 0.0,
  b: 1.0,
});

export const D65_WHITE_POINT = Object.freeze({
  X: 95.047,
  Y: 100.000,
  Z: 108.883,
  Xn: 95.047,
  Yn: 100.000,
  Zn: 108.883,
});

/**
 * 6 Empirical Calibration Anchors for Lead(II) Acetate Chemocassette Badges
 * Expanded dynamic range: 0.0 to 100.0+ ppm (Baseline through NIOSH IDLH)
 */
export const LEAD_ACETATE_CALIBRATION_ANCHORS: readonly CalibrationAnchor[] = Object.freeze([
  {
    id: 1,
    name: 'Baseline / Pristine',
    h2sPpm: 0.0,
    ppmRangeMin: 0.0,
    ppmRangeMax: 0.9,
    hex: '#FAF7F0',
    rgb: { r: 250, g: 247, b: 240 },
    lab: { L: 97.0, a: -0.4, b: 3.9 },
    opticalDensityRange: [0.01, 0.05],
    nominalOpticalDensity: 0.02,
    deltaERange: [0.0, 4.0],
    nominalDeltaE: 1.5,
    ehsStatus: 'SAFE',
    badgeClass: 'safe',
    oshaAcgihGuidance: 'Within normal atmospheric background (< 1.0 ppm).',
    recommendedAction: 'Safe to proceed. Normal shift monitoring routine.',
  },
  {
    id: 2,
    name: 'Trace Yellowing',
    h2sPpm: 3.0,
    ppmRangeMin: 1.0,
    ppmRangeMax: 4.9,
    hex: '#DECBA4',
    rgb: { r: 222, g: 203, b: 164 },
    lab: { L: 81.5, a: 2.1, b: 21.8 },
    opticalDensityRange: [0.08, 0.25],
    nominalOpticalDensity: 0.15,
    deltaERange: [15.0, 30.0],
    nominalDeltaE: 22.0,
    ehsStatus: 'SAFE / TRACE',
    badgeClass: 'trace',
    oshaAcgihGuidance: 'Below OSHA 10 ppm 8-hr TWA. Actionable trace H2S detected.',
    recommendedAction: 'Inspect localized valves and seals. Continue routine check.',
  },
  {
    id: 3,
    name: 'Cautionary Caramel',
    h2sPpm: 7.5,
    ppmRangeMin: 5.0,
    ppmRangeMax: 9.9,
    hex: '#B8894A',
    rgb: { r: 184, g: 137, b: 74 },
    lab: { L: 59.8, a: 10.4, b: 39.5 },
    opticalDensityRange: [0.30, 0.55],
    nominalOpticalDensity: 0.40,
    deltaERange: [42.0, 58.0],
    nominalDeltaE: 50.0,
    ehsStatus: 'CAUTION',
    badgeClass: 'caution',
    oshaAcgihGuidance: 'Exceeds ACGIH 1.0 ppm TWA. Approaching OSHA 10.0 ppm PEL.',
    recommendedAction: 'Increase ventilation immediately. Alert shift buddy. Stand by with respirator.',
  },
  {
    id: 4,
    name: 'Warning (PEL Breach)',
    h2sPpm: 15.0,
    ppmRangeMin: 10.0,
    ppmRangeMax: 19.9,
    hex: '#7A4B22',
    rgb: { r: 122, g: 75, b: 34 },
    lab: { L: 36.4, a: 14.8, b: 28.6 },
    opticalDensityRange: [0.70, 1.05],
    nominalOpticalDensity: 0.82,
    deltaERange: [65.0, 78.0],
    nominalDeltaE: 70.0,
    ehsStatus: 'WARNING / EXCEEDS PEL',
    badgeClass: 'warning',
    oshaAcgihGuidance: 'OSHA 8-hour Permissible Exposure Limit (10.0 ppm PEL) breached.',
    recommendedAction: 'CEASE WORK IMMEDIATELY. Evacuate sector upwind or don positive-pressure SCBA.',
  },
  {
    id: 5,
    name: 'Danger (Ceiling Breach)',
    h2sPpm: 35.0,
    ppmRangeMin: 20.0,
    ppmRangeMax: 49.9,
    hex: '#382012',
    rgb: { r: 56, g: 32, b: 18 },
    lab: { L: 16.2, a: 8.5, b: 12.0 },
    opticalDensityRange: [1.15, 1.60],
    nominalOpticalDensity: 1.35,
    deltaERange: [82.0, 91.0],
    nominalDeltaE: 86.0,
    ehsStatus: 'DANGER',
    badgeClass: 'danger',
    oshaAcgihGuidance: 'OSHA 20.0 ppm Acceptable Ceiling breached. Strong odor, eye and respiratory irritation.',
    recommendedAction: 'EMERGENCY EVACUATION. Evacuate all personnel immediately. Respiratory protection mandatory.',
  },
  {
    id: 6,
    name: 'IDLH Critical Hazard',
    h2sPpm: 100.0,
    ppmRangeMin: 50.0,
    ppmRangeMax: 100.0,
    hex: '#0F0B09',
    rgb: { r: 15, g: 11, b: 9 },
    lab: { L: 4.2, a: 1.0, b: 1.5 },
    opticalDensityRange: [1.80, 2.50],
    nominalOpticalDensity: 1.95,
    deltaERange: [92.0, 105.0],
    nominalDeltaE: 96.5,
    ehsStatus: 'CRITICAL HAZARD - EVACUATE',
    badgeClass: 'critical',
    oshaAcgihGuidance: 'Approaching/Exceeding 100 ppm IDLH. Severe olfactory fatigue and rapid chemical asphyxiation hazard.',
    recommendedAction: 'LETHAL HAZARD ZONE. Olfactory fatigue risk. Automated facility emergency isolation protocol initiated.',
  },
]);

/**
 * Standard Regulatory Exposure Limits
 */
export const REGULATORY_THRESHOLDS = Object.freeze({
  ACGIH_TWA_PPM: 1.0,      // ACGIH 8-hour Time-Weighted Average
  ACGIH_STEL_PPM: 5.0,     // ACGIH 15-minute Short-Term Exposure Limit
  OSHA_PEL_PPM: 10.0,      // OSHA 8-hour Permissible Exposure Limit
  OSHA_CEILING_PPM: 20.0,  // OSHA Acceptable Ceiling Concentration
  OSHA_PEAK_PPM: 50.0,     // OSHA Max Acceptable Peak
  NIOSH_IDLH_PPM: 100.0,   // Immediately Dangerous to Life or Health
});

/**
 * Maps a calculated H2S concentration (ppm) to its formal alert classification
 */
export function getAlertLevelFromPpm(ppm: number): {
  level: SafetyAlertLevel;
  badgeClass: 'safe' | 'trace' | 'caution' | 'warning' | 'danger' | 'critical';
  bannerText: string;
  actionText: string;
  colorHex: string;
} {
  if (ppm < 1.0) {
    return {
      level: 'SAFE',
      badgeClass: 'safe',
      bannerText: 'SAFE TO WORK',
      actionText: 'Within normal atmospheric background (< 1.0 ppm).',
      colorHex: '#10B981',
    };
  }
  if (ppm < 5.0) {
    return {
      level: 'SAFE / TRACE',
      badgeClass: 'trace',
      bannerText: 'TRACE H2S DETECTED',
      actionText: 'Below OSHA 10 ppm 8-hr TWA. Maintain routine monitoring.',
      colorHex: '#06B6D4',
    };
  }
  if (ppm < 10.0) {
    return {
      level: 'CAUTION',
      badgeClass: 'caution',
      bannerText: 'CAUTION: APPROACHING PEL',
      actionText: 'Exceeds ACGIH 1 ppm TWA. Check ventilation and alert buddy.',
      colorHex: '#F59E0B',
    };
  }
  if (ppm < 20.0) {
    return {
      level: 'WARNING / EXCEEDS PEL',
      badgeClass: 'warning',
      bannerText: 'WARNING: EXCEEDS OSHA PEL',
      actionText: 'OSHA 8-hr PEL (10 ppm) breached. Evacuate sector or don positive-pressure SCBA.',
      colorHex: '#F97316',
    };
  }
  if (ppm < 50.0) {
    return {
      level: 'DANGER',
      badgeClass: 'danger',
      bannerText: 'DANGER: CEILING EXCEEDED',
      actionText: 'OSHA 20 ppm Ceiling breached. Strong odor and eye irritation. Evacuate immediately.',
      colorHex: '#EF4444',
    };
  }
  return {
    level: 'CRITICAL HAZARD - EVACUATE',
    badgeClass: 'critical',
    bannerText: 'CRITICAL HAZARD: EVACUATE (IDLH)',
    actionText: 'Approaching/Exceeding 100 ppm IDLH. Severe olfactory fatigue and rapid toxicity.',
    colorHex: '#DC2626',
  };
}

/**
 * Finds the nearest calibration anchor based on Euclidean distance in CIE L*a*b* space
 */
export function findNearestCalibrationAnchor(lab: ColorLab): CalibrationAnchor {
  let minDistance = Infinity;
  let nearest = LEAD_ACETATE_CALIBRATION_ANCHORS[0];

  for (const anchor of LEAD_ACETATE_CALIBRATION_ANCHORS) {
    const dL = lab.L - anchor.lab.L;
    const da = lab.a - anchor.lab.a;
    const db = lab.b - anchor.lab.b;
    const dist = Math.sqrt(dL * dL + da * da + db * db);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = anchor;
    }
  }

  return nearest;
}
