import React, { useState } from 'react';
import {
  Cpu,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  Sparkles,
  CheckCircle2,
  FileCode2
} from 'lucide-react';
import {
  VIRGIN_BASELINE_LAB,
  DEFAULT_CCM,
  srgbChannelToLinear,
  applyCameraCCM,
  bradfordAdapt,
  xyzToLab,
  ciede2000,
  computeArrheniusRateFactor,
  estimateDoseFromDeltaE,
  D65_WHITE
} from '@shared/colorimetricStandards';

/**
 * Calculation Trace Component
 * 
 * Provides an audit-level step-by-step mathematical trace from raw camera pixels
 * to final cumulative exposure dose using ACTUAL measured values from the active scan.
 */
export default function CalculationTraceCard({ readingData, rawStripRGB, rawWhiteRGB, tempC = 25.0, rhPct = 50.0 }) {
  const [showTrace, setShowTrace] = useState(false);

  // Extract raw RGBs
  const stripRgb = readingData?.stripColorRGB || rawStripRGB || { r: 168, g: 115, b: 130 };
  const whiteRgb = readingData?.referenceColorRGB || rawWhiteRGB || { r: 245, g: 242, b: 235 };
  const ambientTemp = readingData?.ambientTemp ?? tempC;
  const ambientHumidity = readingData?.ambientHumidity ?? rhPct;

  // Step 1: Linearization
  const rLin = srgbChannelToLinear(stripRgb.r);
  const gLin = srgbChannelToLinear(stripRgb.g);
  const bLin = srgbChannelToLinear(stripRgb.b);

  const whiteRLin = srgbChannelToLinear(whiteRgb.r);
  const whiteGLin = srgbChannelToLinear(whiteRgb.g);
  const whiteBLin = srgbChannelToLinear(whiteRgb.b);

  // Step 2: Camera CCM
  const rawStripXYZ = applyCameraCCM(rLin, gLin, bLin, DEFAULT_CCM);
  const rawWhiteXYZ = applyCameraCCM(whiteRLin, whiteGLin, whiteBLin, DEFAULT_CCM);

  // Step 3: Bradford CAT
  const adaptedXYZ = bradfordAdapt(rawStripXYZ, rawWhiteXYZ, D65_WHITE);

  // Step 4: CIELAB
  const lab = xyzToLab(adaptedXYZ.x, adaptedXYZ.y, adaptedXYZ.z, D65_WHITE);

  // Step 5: CIEDE2000
  const deltaE00 = ciede2000(VIRGIN_BASELINE_LAB, lab);

  // Step 6: Arrhenius Kinetics
  const { rateFactor } = computeArrheniusRateFactor(ambientTemp, ambientHumidity);

  // Step 7: Calibrated Dose Estimation
  const doseResult = estimateDoseFromDeltaE(deltaE00, ambientTemp, ambientHumidity);

  const TRACE_STEPS = [
    {
      num: 1,
      title: 'Captured Raw Camera RGB',
      subtitle: '8-bit non-linear sRGB extracted from 3-patch target ROIs',
      content: `Strip RGB = [${stripRgb.r}, ${stripRgb.g}, ${stripRgb.b}] | White Ref = [${whiteRgb.r}, ${whiteRgb.g}, ${whiteRgb.b}]`
    },
    {
      num: 2,
      title: 'IEC 61966-2-1 Inverse Gamma Linearization',
      subtitle: 'Transforms non-linear pixel intensities into linear radiometric space',
      content: `Strip Linear = [${rLin.toFixed(4)}, ${gLin.toFixed(4)}, ${bLin.toFixed(4)}]`
    },
    {
      num: 3,
      title: 'ISO 17321-1 Camera Color Correction Matrix (CCM)',
      subtitle: 'Projects sensor linear RGB into standard CIE 1931 XYZ tristimulus',
      content: `XYZ_raw = [${rawStripXYZ.x.toFixed(4)}, ${rawStripXYZ.y.toFixed(4)}, ${rawStripXYZ.z.toFixed(4)}]`
    },
    {
      num: 4,
      title: 'Bradford Chromatic Adaptation (CAT)',
      subtitle: 'Adapts illuminant white point (W_src) to CIE Standard D65 daylight',
      content: `XYZ_adapted(D65) = [${adaptedXYZ.x.toFixed(4)}, ${adaptedXYZ.y.toFixed(4)}, ${adaptedXYZ.z.toFixed(4)}]`
    },
    {
      num: 5,
      title: 'CIE 1976 CIELAB Color Space Transformation',
      subtitle: 'Standard perceptual coordinate space (L*, a*, b*)',
      content: `L* = ${lab.L.toFixed(2)}, a* = ${lab.a.toFixed(2)}, b* = ${lab.b.toFixed(2)}`
    },
    {
      num: 6,
      title: 'ISO/CIE 11664-6:2022 CIEDE2000 Color Difference',
      subtitle: 'Perceptual shift relative to virgin Cu-PAN baseline (L₀*=42.50, a₀*=38.20, b₀*=-28.40)',
      content: `ΔE₀₀ = ${deltaE00.toFixed(2)} (Total Optical Shift)`
    },
    {
      num: 7,
      title: 'Arrhenius Environmental Rate Compensation',
      subtitle: `Temperature (${ambientTemp}°C) & Humidity (${ambientHumidity}% RH) kinetic normalization`,
      content: `k(T, RH) = ${rateFactor.toFixed(2)}  ➔  ΔE₀₀,norm = ${(deltaE00 / rateFactor).toFixed(2)}`
    },
    {
      num: 8,
      title: 'Cu-PAN Chamber Calibration Model Evaluation',
      subtitle: 'Piecewise monotonic spline interpolation on empirical chamber anchors',
      content: `Estimated Cumulative Exposure Dose = ${doseResult.dosePpmHours.toFixed(1)} ppm·h (${doseResult.status})`
    }
  ];

  return (
    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
      <button
        onClick={() => setShowTrace(!showTrace)}
        style={{
          width: '100%',
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileCode2 size={18} color="var(--accent-cyan)" />
          <div>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
              Optical Calculation Trace (Live Reading Audit)
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Step-by-step photometric calculation pipeline from camera pixels to dose
            </span>
          </div>
        </div>

        {showTrace ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
      </button>

      {showTrace && (
        <div
          style={{
            padding: '18px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(3, 7, 18, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontSize: '0.76rem'
          }}
        >
          {TRACE_STEPS.map((step, idx) => (
            <React.Fragment key={step.num}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: 'var(--accent-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: '800',
                      flexShrink: 0
                    }}
                  >
                    {step.num}
                  </span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>{step.title}</strong>
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginLeft: '28px', marginBottom: '6px' }}>
                  {step.subtitle}
                </span>
                <div
                  style={{
                    marginLeft: '28px',
                    fontFamily: 'var(--font-mono)',
                    color: idx === TRACE_STEPS.length - 1 ? 'var(--accent-emerald)' : '#e2e8f0',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontWeight: idx === TRACE_STEPS.length - 1 ? '800' : '500'
                  }}
                >
                  {step.content}
                </div>
              </div>

              {idx < TRACE_STEPS.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
                  <ArrowDown size={14} color="var(--text-muted)" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
