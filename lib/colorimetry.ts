/**
 * H2S-SafeTrack: Mathematical Colorimetry & Computer Vision Pipeline
 * 
 * Lead(II) Acetate Chemocassette Colorimetric Engine:
 * - Concentric Fiducial Reticle Segmentation (Outer Reference White Ring, Inner Pb(Ac)2 Disk)
 * - 5% Specular Glare & 5% Shadow Rejection Filter
 * - Gamma sRGB Decoding to Linear RGB
 * - Linear RGB to CIE XYZ (D65)
 * - Bradford Chromatic Adaptation Transform (Normalizes Field Lighting to Standard D65)
 * - CIE XYZ to CIE L*a*b* (1976 Standard)
 * - Optical Density (OD) Calculation
 * - CIEDE2000 (Delta E 00) against Pristine Unexposed Lead Acetate Paper
 * - Monotonic Piecewise Cubic Hermite Interpolating Polynomial (PCHIP) Exposure Mapping
 * 
 * Chemistry: Exclusively Lead(II) Acetate Trihydrate.
 */

import {
  ColorRGB,
  ColorLab,
  PRISTINE_UNEXPOSED_PAPER_LAB,
  D65_WHITE_POINT,
  LEAD_ACETATE_CALIBRATION_ANCHORS,
  CalibrationAnchor,
  findNearestCalibrationAnchor,
  getAlertLevelFromPpm,
  SafetyAlertLevel,
} from './calibrationData';

export interface CIE_XYZ {
  X: number;
  Y: number;
  Z: number;
}

export interface ColorimetryResult {
  rawSampleRGB: ColorRGB;
  rawRefWhiteRGB: ColorRGB;
  adaptedSampleRGB: ColorRGB;
  sampleLab: ColorLab;
  refWhiteLab: ColorLab;
  opticalDensity: number;
  deltaE00: number;
  estimatedPpm: number;
  alertLevel: SafetyAlertLevel;
  badgeClass: 'safe' | 'trace' | 'caution' | 'warning' | 'danger' | 'critical';
  confidenceScore: number;
  nearestAnchor: CalibrationAnchor;
  lightingQuality: 'OPTIMAL' | 'GLARE_DETECTED' | 'UNDEREXPOSED';
  capturedImageSrc?: string;
}

/* =====================================================================
 * 1. SPECULAR GLARE & SHADOW REJECTION PIXEL FILTERING
 * ===================================================================== */

/**
 * Computes standard photometric luminance from linear or sRGB coefficients
 * Y = 0.2126*R + 0.7152*G + 0.0722*B
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface PixelSample {
  r: number;
  g: number;
  b: number;
  lum: number;
}

/**
 * Sorts pixels by luminance, discards top 5% (glare) and bottom 5% (shadows),
 * and computes the median sRGB from the remaining 90% central distribution.
 */
export function filterAndComputeMedianRGB(pixels: PixelSample[]): {
  medianRGB: ColorRGB;
  glareRatio: number;
  underexposedRatio: number;
  sampleCount: number;
} {
  if (pixels.length === 0) {
    return {
      medianRGB: { r: 250, g: 247, b: 240 },
      glareRatio: 0,
      underexposedRatio: 0,
      sampleCount: 0,
    };
  }

  // Sort ascending by luminance
  pixels.sort((a, b) => a.lum - b.lum);

  const total = pixels.length;
  const lowerIndex = Math.floor(total * 0.05);
  const upperIndex = Math.floor(total * 0.95);

  const validSlice = pixels.slice(lowerIndex, upperIndex);
  if (validSlice.length === 0) {
    const mid = pixels[Math.floor(total / 2)];
    return {
      medianRGB: { r: mid.r, g: mid.g, b: mid.b },
      glareRatio: 0,
      underexposedRatio: 0,
      sampleCount: total,
    };
  }

  // Extract component medians for stability against chromatic noise
  const rSorted = validSlice.map((p) => p.r).sort((a, b) => a - b);
  const gSorted = validSlice.map((p) => p.g).sort((a, b) => a - b);
  const bSorted = validSlice.map((p) => p.b).sort((a, b) => a - b);

  const midIdx = Math.floor(validSlice.length / 2);

  // Count extreme saturated pixels (> 250) or deep shadows (< 15)
  const saturatedCount = pixels.filter((p) => p.lum >= 250).length;
  const shadowCount = pixels.filter((p) => p.lum <= 15).length;

  return {
    medianRGB: {
      r: Math.round(rSorted[midIdx]),
      g: Math.round(gSorted[midIdx]),
      b: Math.round(bSorted[midIdx]),
    },
    glareRatio: saturatedCount / total,
    underexposedRatio: shadowCount / total,
    sampleCount: validSlice.length,
  };
}

/**
 * Concentric Fiducial Target Segmenter:
 * Extracts pixels from an ImageData or HTMLCanvasElement given reticle center & radius.
 * - Inner Disk (Active Lead Acetate Substrate): r < 0.45 R
 * - Outer Ring (Inert Reference White Standard): 0.70 R < r < 0.95 R
 */
export function segmentConcentricFiducial(
  imageData: ImageData,
  centerX: number,
  centerY: number,
  radius: number
): {
  samplePixels: PixelSample[];
  refWhitePixels: PixelSample[];
} {
  const { width, height, data } = imageData;
  const samplePixels: PixelSample[] = [];
  const refWhitePixels: PixelSample[] = [];

  const rInnerMax = radius * 0.45;
  const rOuterMin = radius * 0.70;
  const rOuterMax = radius * 0.95;

  const rInnerMaxSq = rInnerMax * rInnerMax;
  const rOuterMinSq = rOuterMin * rOuterMin;
  const rOuterMaxSq = rOuterMax * rOuterMax;

  const xMin = Math.max(0, Math.floor(centerX - radius));
  const xMax = Math.min(width - 1, Math.ceil(centerX + radius));
  const yMin = Math.max(0, Math.floor(centerY - radius));
  const yMax = Math.min(height - 1, Math.ceil(centerY + radius));

  for (let y = yMin; y <= yMax; y++) {
    const dy = y - centerY;
    const dySq = dy * dy;

    for (let x = xMin; x <= xMax; x++) {
      const dx = x - centerX;
      const distSq = dx * dx + dySq;

      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = calculateLuminance(r, g, b);

      if (distSq <= rInnerMaxSq) {
        samplePixels.push({ r, g, b, lum });
      } else if (distSq >= rOuterMinSq && distSq <= rOuterMaxSq) {
        refWhitePixels.push({ r, g, b, lum });
      }
    }
  }

  return { samplePixels, refWhitePixels };
}

/* =====================================================================
 * 2. CHROMATIC ADAPTATION & COLOR CONVERSIONS
 * ===================================================================== */

/**
 * Standard IEC 61966-2-1 Gamma Decoding (sRGB -> Linear RGB [0, 1])
 */
export function srgbToLinear(channel8Bit: number): number {
  const v = Math.max(0, Math.min(255, channel8Bit)) / 255.0;
  return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}

/**
 * Linear RGB to Gamma sRGB (0 - 255)
 */
export function linearToSrgb(linearVal: number): number {
  const v = Math.max(0, Math.min(1, linearVal));
  const srgb = v > 0.0031308 ? 1.055 * Math.pow(v, 1.0 / 2.4) - 0.055 : 12.92 * v;
  return Math.round(Math.max(0, Math.min(255, srgb * 255)));
}

/**
 * Converts sRGB (0-255) to CIE XYZ (0 - 100 scale) using standard sRGB D65 matrix
 */
export function rgbToXyz(rgb: ColorRGB): CIE_XYZ {
  const rLin = srgbToLinear(rgb.r);
  const gLin = srgbToLinear(rgb.g);
  const bLin = srgbToLinear(rgb.b);

  const X = (0.4124564 * rLin + 0.3575761 * gLin + 0.1804375 * bLin) * 100.0;
  const Y = (0.2126729 * rLin + 0.7151522 * gLin + 0.0721750 * bLin) * 100.0;
  const Z = (0.0193339 * rLin + 0.1191920 * gLin + 0.9503041 * bLin) * 100.0;

  return { X, Y, Z };
}

/**
 * Converts CIE XYZ (0 - 100 scale) to Gamma sRGB (0 - 255)
 */
export function xyzToRgb(xyz: CIE_XYZ): ColorRGB {
  const x = xyz.X / 100.0;
  const y = xyz.Y / 100.0;
  const z = xyz.Z / 100.0;

  const rLin = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gLin = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const bLin = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  return {
    r: linearToSrgb(rLin),
    g: linearToSrgb(gLin),
    b: linearToSrgb(bLin),
  };
}

/**
 * Bradford Chromatic Adaptation Transform:
 * Adapts measured sample color under arbitrary ambient illumination (using the badge's outer
 * white reference standard) to standard CIE D65 illuminant (Xn=95.047, Yn=100.0, Zn=108.883).
 */
export function applyBradfordAdaptation(
  sampleXyz: CIE_XYZ,
  sourceWhiteXyz: CIE_XYZ,
  targetWhiteXyz: CIE_XYZ = D65_WHITE_POINT
): CIE_XYZ {
  // Bradford Matrix M_BFD
  // [  0.8951   0.2664  -0.1614 ]
  // [ -0.7502   1.7135   0.0367 ]
  // [  0.0389  -0.0685   1.0296 ]
  const srcRho = 0.8951 * sourceWhiteXyz.X + 0.2664 * sourceWhiteXyz.Y - 0.1614 * sourceWhiteXyz.Z;
  const srcGamma = -0.7502 * sourceWhiteXyz.X + 1.7135 * sourceWhiteXyz.Y + 0.0367 * sourceWhiteXyz.Z;
  const srcBeta = 0.0389 * sourceWhiteXyz.X - 0.0685 * sourceWhiteXyz.Y + 1.0296 * sourceWhiteXyz.Z;

  const tgtRho = 0.8951 * targetWhiteXyz.X + 0.2664 * targetWhiteXyz.Y - 0.1614 * targetWhiteXyz.Z;
  const tgtGamma = -0.7502 * targetWhiteXyz.X + 1.7135 * targetWhiteXyz.Y + 0.0367 * targetWhiteXyz.Z;
  const tgtBeta = 0.0389 * targetWhiteXyz.X - 0.0685 * targetWhiteXyz.Y + 1.0296 * targetWhiteXyz.Z;

  // Scale ratios avoiding division by zero
  const scaleRho = srcRho !== 0 ? tgtRho / srcRho : 1.0;
  const scaleGamma = srcGamma !== 0 ? tgtGamma / srcGamma : 1.0;
  const scaleBeta = srcBeta !== 0 ? tgtBeta / srcBeta : 1.0;

  // Sample cone coordinates
  const sRho = 0.8951 * sampleXyz.X + 0.2664 * sampleXyz.Y - 0.1614 * sampleXyz.Z;
  const sGamma = -0.7502 * sampleXyz.X + 1.7135 * sampleXyz.Y + 0.0367 * sampleXyz.Z;
  const sBeta = 0.0389 * sampleXyz.X - 0.0685 * sampleXyz.Y + 1.0296 * sampleXyz.Z;

  // Adapted cone coordinates
  const aRho = sRho * scaleRho;
  const aGamma = sGamma * scaleGamma;
  const aBeta = sBeta * scaleBeta;

  // Inverse Bradford Matrix M_BFD_INV
  // [  0.9869929  -0.1470543   0.1599627 ]
  // [  0.4323053   0.5183603   0.0492912 ]
  // [ -0.0085287   0.0400428   0.9684867 ]
  const X = 0.9869929 * aRho - 0.1470543 * aGamma + 0.1599627 * aBeta;
  const Y = 0.4323053 * aRho + 0.5183603 * aGamma + 0.0492912 * aBeta;
  const Z = -0.0085287 * aRho + 0.0400428 * aGamma + 0.9684867 * aBeta;

  return {
    X: Math.max(0, X),
    Y: Math.max(0, Y),
    Z: Math.max(0, Z),
  };
}

/**
 * CIE XYZ to CIE L*a*b* (1976 standard, D65 reference white)
 */
export function xyzToLab(xyz: CIE_XYZ, whiteRef: CIE_XYZ = D65_WHITE_POINT): ColorLab {
  const xr = xyz.X / whiteRef.X;
  const yr = xyz.Y / whiteRef.Y;
  const zr = xyz.Z / whiteRef.Z;

  const epsilon = 216.0 / 24389.0; // 0.00885645
  const kappa = 24389.0 / 27.0;    // 903.29629

  const fx = xr > epsilon ? Math.cbrt(xr) : (kappa * xr + 16.0) / 116.0;
  const fy = yr > epsilon ? Math.cbrt(yr) : (kappa * yr + 16.0) / 116.0;
  const fz = zr > epsilon ? Math.cbrt(zr) : (kappa * zr + 16.0) / 116.0;

  const L = Math.max(0, Math.min(100, 116.0 * fy - 16.0));
  const a = 500.0 * (fx - fy);
  const b = 200.0 * (fy - fz);

  return {
    L: Number(L.toFixed(2)),
    a: Number(a.toFixed(2)),
    b: Number(b.toFixed(2)),
  };
}

/**
 * Computes Optical Density (OD):
 * OD = -log10(Y_sample / Y_ref_white)
 */
export function calculateOpticalDensity(ySample: number, yRefWhite: number): number {
  if (yRefWhite <= 0) return 0;
  const ratio = Math.max(0.001, ySample / yRefWhite);
  const od = -Math.log10(ratio);
  return Number(Math.max(0, od).toFixed(3));
}

/* =====================================================================
 * 3. CIEDE2000 COLOR DIFFERENCE ENGINE (ISO/CIE 11664-6:2014)
 * ===================================================================== */

const deg2rad = (deg: number) => (deg * Math.PI) / 180.0;
const rad2deg = (rad: number) => (rad * 180.0) / Math.PI;

/**
 * Exact, zero-dependency implementation of CIEDE2000 Delta E formula
 */
export function ciede2000(lab1: ColorLab, lab2: ColorLab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2.0;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1.0 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1Prime = (1.0 + G) * a1;
  const a2Prime = (1.0 + G) * a2;

  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  let h1Prime = rad2deg(Math.atan2(b1, a1Prime));
  if (h1Prime < 0) h1Prime += 360;

  let h2Prime = rad2deg(Math.atan2(b2, a2Prime));
  if (h2Prime < 0) h2Prime += 360;

  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;

  let deltahPrime = 0;
  if (C1Prime * C2Prime !== 0) {
    const diff = h2Prime - h1Prime;
    if (Math.abs(diff) <= 180) {
      deltahPrime = diff;
    } else if (diff > 180) {
      deltahPrime = diff - 360;
    } else {
      deltahPrime = diff + 360;
    }
  }

  const deltaHPrime = 2.0 * Math.sqrt(C1Prime * C2Prime) * Math.sin(deg22rad(deltahPrime / 2.0));

  const LbarPrime = (L1 + L2) / 2.0;
  const CbarPrime = (C1Prime + C2Prime) / 2.0;

  let hbarPrime = 0;
  if (C1Prime * C2Prime !== 0) {
    const sum = h1Prime + h2Prime;
    if (Math.abs(h1Prime - h2Prime) <= 180) {
      hbarPrime = sum / 2.0;
    } else if (sum < 360) {
      hbarPrime = (sum + 360) / 2.0;
    } else {
      hbarPrime = (sum - 360) / 2.0;
    }
  } else {
    hbarPrime = h1Prime + h2Prime;
  }

  const T =
    1.0 -
    0.17 * Math.cos(deg2rad(hbarPrime - 30)) +
    0.24 * Math.cos(deg2rad(2 * hbarPrime)) +
    0.32 * Math.cos(deg2rad(3 * hbarPrime + 6)) -
    0.20 * Math.cos(deg2rad(4 * hbarPrime - 63));

  const deltaTheta = 30 * Math.exp(-Math.pow((hbarPrime - 275) / 25, 2));
  const CbarPrime7 = Math.pow(CbarPrime, 7);
  const RC = 2.0 * Math.sqrt(CbarPrime7 / (CbarPrime7 + Math.pow(25, 7)));

  const LbarPrimeMinus50Sq = Math.pow(LbarPrime - 50, 2);
  const SL = 1.0 + (0.015 * LbarPrimeMinus50Sq) / Math.sqrt(20 + LbarPrimeMinus50Sq);
  const SC = 1.0 + 0.045 * CbarPrime;
  const SH = 1.0 + 0.015 * CbarPrime * T;
  const RT = -Math.sin(deg2rad(2 * deltaTheta)) * RC;

  const vL = deltaLPrime / SL;
  const vC = deltaCPrime / SC;
  const vH = deltaHPrime / SH;

  const deltaE = Math.sqrt(vL * vL + vC * vC + vH * vH + RT * vC * vH);
  return Number(deltaE.toFixed(2));
}

function deg22rad(deg: number) {
  return (deg * Math.PI) / 180.0;
}

/* =====================================================================
 * 4. PIECEWISE CUBIC HERMITE INTERPOLATING POLYNOMIAL (PCHIP)
 * ===================================================================== */

export class PchipInterpolator {
  private x: number[];
  private y: number[];
  private d: number[];

  constructor(x: number[], y: number[]) {
    if (x.length !== y.length || x.length < 2) {
      throw new Error('PCHIP requires at least 2 distinct data points.');
    }
    // Copy & sort points by x
    const sorted = x
      .map((xv, i) => ({ x: xv, y: y[i] }))
      .sort((a, b) => a.x - b.x);

    this.x = sorted.map((p) => p.x);
    this.y = sorted.map((p) => p.y);
    this.d = this.computeDerivatives(this.x, this.y);
  }

  private computeDerivatives(x: number[], y: number[]): number[] {
    const n = x.length;
    const h: number[] = [];
    const delta: number[] = [];

    for (let i = 0; i < n - 1; i++) {
      h.push(x[i + 1] - x[i]);
      delta.push((y[i + 1] - y[i]) / h[i]);
    }

    const d = new Array(n).fill(0);

    // Endpoints: standard one-sided three-point formula
    d[0] = ((2 * h[0] + h[1]) * delta[0] - h[0] * delta[1]) / (h[0] + h[1]);
    if (Math.sign(d[0]) !== Math.sign(delta[0])) {
      d[0] = 0;
    } else if (Math.sign(delta[0]) !== Math.sign(delta[1]) && Math.abs(d[0]) > Math.abs(3 * delta[0])) {
      d[0] = 3 * delta[0];
    }

    const last = n - 1;
    d[last] = ((2 * h[last - 1] + h[last - 2]) * delta[last - 1] - h[last - 1] * delta[last - 2]) / (h[last - 1] + h[last - 2]);
    if (Math.sign(d[last]) !== Math.sign(delta[last - 1])) {
      d[last] = 0;
    } else if (Math.sign(delta[last - 1]) !== Math.sign(delta[last - 2]) && Math.abs(d[last]) > Math.abs(3 * delta[last - 1])) {
      d[last] = 3 * delta[last - 1];
    }

    // Interior points: harmonic mean ensuring shape-preservation
    for (let i = 1; i < n - 1; i++) {
      if (delta[i - 1] * delta[i] <= 0) {
        d[i] = 0;
      } else {
        const w1 = 2 * h[i] + h[i - 1];
        const w2 = h[i] + 2 * h[i - 1];
        d[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
      }
    }

    return d;
  }

  public interpolate(queryX: number): number {
    const n = this.x.length;
    if (queryX <= this.x[0]) return this.y[0];
    if (queryX >= this.x[n - 1]) {
      // Extrapolate linearly using terminal slope
      const dx = queryX - this.x[n - 1];
      return this.y[n - 1] + dx * this.d[n - 1];
    }

    // Binary search interval
    let low = 0;
    let high = n - 1;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (this.x[mid] > queryX) {
        high = mid;
      } else {
        low = mid;
      }
    }

    const k = low;
    const h = this.x[k + 1] - this.x[k];
    const t = (queryX - this.x[k]) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    // Hermite basis functions
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const val = h00 * this.y[k] + h10 * h * this.d[k] + h01 * this.y[k + 1] + h11 * h * this.d[k + 1];
    return Math.max(0, val);
  }
}

// Instantiate PCHIP Interpolator for Delta E 00 -> H2S ppm mapping
const deltaEAnchors = LEAD_ACETATE_CALIBRATION_ANCHORS.map((a) => a.nominalDeltaE);
const ppmAnchors = LEAD_ACETATE_CALIBRATION_ANCHORS.map((a) => a.h2sPpm);
export const leadAcetatePchip = new PchipInterpolator(deltaEAnchors, ppmAnchors);

/* =====================================================================
 * 5. COMPLETE FULL-FRAME COLORIMETRIC EVALUATION PIPELINE
 * ===================================================================== */

/**
 * Evaluates exposure from raw sample sRGB and outer reference white standard sRGB
 */
export function evaluateLeadAcetateExposure(
  rawSampleRgb: ColorRGB,
  rawRefWhiteRgb: ColorRGB,
  capturedImageSrc?: string
): ColorimetryResult {
  // 1. Convert to CIE XYZ
  const rawSampleXyz = rgbToXyz(rawSampleRgb);
  const rawRefWhiteXyz = rgbToXyz(rawRefWhiteRgb);

  // 2. Perform Bradford Chromatic Adaptation using outer white ring as illuminant reference
  const adaptedSampleXyz = applyBradfordAdaptation(rawSampleXyz, rawRefWhiteXyz);
  const adaptedSampleRgb = xyzToRgb(adaptedSampleXyz);

  // 3. Convert adapted XYZ to standard CIE L*a*b*
  const sampleLab = xyzToLab(adaptedSampleXyz);
  const refWhiteLab = xyzToLab(rawRefWhiteXyz);

  // 4. Compute Optical Density
  const opticalDensity = calculateOpticalDensity(rawSampleXyz.Y, rawRefWhiteXyz.Y);

  // 5. Compute CIEDE2000 Delta E 00 vs pristine unexposed paper baseline
  const deltaE00 = ciede2000(PRISTINE_UNEXPOSED_PAPER_LAB, sampleLab);

  // 6. Monotonic PCHIP + Non-Linear Log-Ratio Optical Density Interpolation (0 to 100+ ppm)
  const pchipPpm = leadAcetatePchip.interpolate(deltaE00);
  let estimatedPpm = pchipPpm;

  // Handle non-linear optical saturation between 20 ppm and 100+ ppm:
  // As deltaE00 approaches saturation (>80), Optical Density continues increasing
  // logarithmically with progressive PbS precipitate formation without clamping at 20 ppm.
  if (opticalDensity >= 0.82) {
    if (opticalDensity >= 1.35) {
      // Anchor 5 (35 ppm) OD ~ 1.35, Anchor 6 (100 ppm) OD ~ 1.95
      const odRatio = (opticalDensity - 1.35) / (1.95 - 1.35);
      const odPpm = 35.0 + Math.max(0, odRatio) * 65.0;
      estimatedPpm = Math.max(pchipPpm, odPpm);
    } else {
      // Anchor 4 (15 ppm) OD ~ 0.82 to Anchor 5 (35 ppm) OD ~ 1.35
      const odRatio = (opticalDensity - 0.82) / (1.35 - 0.82);
      const odPpm = 15.0 + Math.max(0, odRatio) * 20.0;
      estimatedPpm = 0.5 * pchipPpm + 0.5 * odPpm;
    }
  }
  estimatedPpm = Number(Math.min(150.0, Math.max(0.0, estimatedPpm)).toFixed(1));

  // 7. Safety Alert Classification & Guidance
  const alert = getAlertLevelFromPpm(estimatedPpm);

  // 8. Nearest Empirical Anchor Swatch
  const nearestAnchor = findNearestCalibrationAnchor(sampleLab);

  // 9. Environmental Lighting Quality & Confidence Scoring
  // Confidence score based on white reference reflectance and saturation bounds
  const whiteY = rawRefWhiteXyz.Y;
  let lightingQuality: 'OPTIMAL' | 'GLARE_DETECTED' | 'UNDEREXPOSED' = 'OPTIMAL';
  let confidenceScore = 95;

  if (whiteY > 98 || rawRefWhiteRgb.r > 252) {
    lightingQuality = 'GLARE_DETECTED';
    confidenceScore = Math.max(50, 95 - (whiteY - 98) * 4);
  } else if (whiteY < 40 || rawRefWhiteRgb.r < 100) {
    lightingQuality = 'UNDEREXPOSED';
    confidenceScore = Math.max(40, 95 - (40 - whiteY) * 2);
  }

  return {
    rawSampleRGB: rawSampleRgb,
    rawRefWhiteRGB: rawRefWhiteRgb,
    adaptedSampleRGB: adaptedSampleRgb,
    sampleLab,
    refWhiteLab,
    opticalDensity,
    deltaE00,
    estimatedPpm,
    alertLevel: alert.level,
    badgeClass: alert.badgeClass,
    confidenceScore: Math.round(confidenceScore),
    nearestAnchor,
    lightingQuality,
    capturedImageSrc,
  };
}
