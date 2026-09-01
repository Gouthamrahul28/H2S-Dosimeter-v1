import React, { useState } from 'react';
import {
  Sun,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Info,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import {
  M_BRAD,
  M_BRAD_INV,
  D65_WHITE,
  DEFAULT_CCM,
  srgbChannelToLinear,
  applyCameraCCM,
  bradfordAdapt,
  xyzToLab,
  ciede2000,
  labToHex
} from '@shared/colorimetricStandards';

/**
 * Light Correction / Colour Normalization Information Panel
 * 
 * Technical-information panel exposing Bradford Chromatic Adaptation parameters,
 * White Point Tristimulus vectors, matrix equations, and Before vs After CIELAB metrics.
 */
export default function LightCorrectionPanel({
  readingData,
  rawStripRGB = { r: 168, g: 115, b: 130 },
  rawWhiteRGB = { r: 245, g: 242, b: 235 },
  referenceWhiteXYZ = D65_WHITE,
  correctionStatus = 'APPLIED' // 'APPLIED' | 'NOT_APPLIED' | 'REFERENCE_INVALID'
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract / calculate photometric values from current active reading
  const stripRgb = readingData?.stripColorRGB || rawStripRGB;
  const whiteRgb = readingData?.referenceColorRGB || rawWhiteRGB;

  // 1. Linearize Raw Strip and White Patch
  const stripLin = {
    r: srgbChannelToLinear(stripRgb.r),
    g: srgbChannelToLinear(stripRgb.g),
    b: srgbChannelToLinear(stripRgb.b)
  };
  const whiteLin = {
    r: srgbChannelToLinear(whiteRgb.r),
    g: srgbChannelToLinear(whiteRgb.g),
    b: srgbChannelToLinear(whiteRgb.b)
  };

  // 2. Camera-Specific CCM transform to XYZ
  const rawStripXYZ = applyCameraCCM(stripLin.r, stripLin.g, stripLin.b, DEFAULT_CCM);
  const srcWhiteXYZ = applyCameraCCM(whiteLin.r, whiteLin.g, whiteLin.b, DEFAULT_CCM);

  // 3. Before Adaptation (Unadapted CIELAB against source white)
  const labBefore = xyzToLab(rawStripXYZ.x, rawStripXYZ.y, rawStripXYZ.z, srcWhiteXYZ);

  // 4. Calculate Bradford Cone Responses (LMS)
  const lmsSrc = {
    l: M_BRAD[0][0] * srcWhiteXYZ.x + M_BRAD[0][1] * srcWhiteXYZ.y + M_BRAD[0][2] * srcWhiteXYZ.z,
    m: M_BRAD[1][0] * srcWhiteXYZ.x + M_BRAD[1][1] * srcWhiteXYZ.y + M_BRAD[1][2] * srcWhiteXYZ.z,
    s: M_BRAD[2][0] * srcWhiteXYZ.x + M_BRAD[2][1] * srcWhiteXYZ.y + M_BRAD[2][2] * srcWhiteXYZ.z
  };

  const lmsTgt = {
    l: M_BRAD[0][0] * D65_WHITE.x + M_BRAD[0][1] * D65_WHITE.y + M_BRAD[0][2] * D65_WHITE.z,
    m: M_BRAD[1][0] * D65_WHITE.x + M_BRAD[1][1] * D65_WHITE.y + M_BRAD[1][2] * D65_WHITE.z,
    s: M_BRAD[2][0] * D65_WHITE.x + M_BRAD[2][1] * D65_WHITE.y + M_BRAD[2][2] * D65_WHITE.z
  };

  const dMatrix = {
    d0: lmsSrc.l !== 0 ? lmsTgt.l / lmsSrc.l : 1.0,
    d1: lmsSrc.m !== 0 ? lmsTgt.m / lmsSrc.m : 1.0,
    d2: lmsSrc.s !== 0 ? lmsTgt.s / lmsSrc.s : 1.0
  };

  // 5. After Bradford Adaptation to D65
  const adaptedXYZ = bradfordAdapt(rawStripXYZ, srcWhiteXYZ, D65_WHITE);
  const labAfter = xyzToLab(adaptedXYZ.x, adaptedXYZ.y, adaptedXYZ.z, D65_WHITE);

  // 6. Colour difference caused by illuminant adaptation
  const deltaE00Shift = ciede2000(labBefore, labAfter);

  // Status mapping
  const isApplied = correctionStatus === 'APPLIED';
  const isInvalid = correctionStatus === 'REFERENCE_INVALID';

  return (
    <div
      className="glass-card"
      style={{
        padding: '0',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)'
      }}
    >
      {/* Header Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '16px 20px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: isInvalid ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)',
              border: isInvalid ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(6, 182, 212, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isInvalid ? '#f87171' : 'var(--accent-cyan)'
            }}
          >
            <Sun size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Light Correction / Colour Normalization
              </h4>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: isApplied ? 'rgba(16, 185, 129, 0.18)' : isInvalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(148, 163, 184, 0.18)',
                  color: isApplied ? '#34d399' : isInvalid ? '#f87171' : '#94a3b8',
                  border: isApplied ? '1px solid rgba(16, 185, 129, 0.3)' : isInvalid ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(148, 163, 184, 0.3)'
                }}
              >
                {isApplied ? '● APPLIED' : isInvalid ? '⚠ REFERENCE INVALID' : '● NOT APPLIED'}
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Bradford Chromatic Adaptation (CIE 015 / ISO 17321-1)
            </span>
          </div>
        </div>

        {isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
      </button>

      {/* Expanded Technical Information Panel */}
      {isOpen && (
        <div
          style={{
            padding: '20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(3, 7, 18, 0.65)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            fontSize: '0.78rem'
          }}
        >
          {/* Method & Scientific Rule */}
          <div
            style={{
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <Info size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '2px' }}>
                Metrological Transformation Method: Bradford Chromatic Adaptation
              </strong>
              <span style={{ color: 'var(--text-secondary)', lineHeight: 1.45, display: 'block' }}>
                Correction is executed strictly in linear photometric space via 3×3 matrix multiplication on normalized tristimulus coordinates. The calculation is <strong>never performed directly on gamma-encoded sRGB values</strong> or simplified to naive channel ratios (R/R_white).
              </span>
            </div>
          </div>

          {/* Input White Points */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {/* Source White */}
            <div className="glass-panel" style={{ padding: '12px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                SOURCE WHITE POINT (W_src)
              </span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <div>X_src = <strong style={{ color: 'var(--accent-cyan)' }}>{srcWhiteXYZ.x.toFixed(4)}</strong></div>
                <div>Y_src = <strong style={{ color: 'var(--accent-cyan)' }}>{srcWhiteXYZ.y.toFixed(4)}</strong></div>
                <div>Z_src = <strong style={{ color: 'var(--accent-cyan)' }}>{srcWhiteXYZ.z.toFixed(4)}</strong></div>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Measured from printed White Reference ROI
              </span>
            </div>

            {/* Reference White */}
            <div className="glass-panel" style={{ padding: '12px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                STANDARD TARGET ILLUMINANT (D65)
              </span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <div>X_ref = <strong style={{ color: '#fff' }}>{D65_WHITE.x.toFixed(4)}</strong></div>
                <div>Y_ref = <strong style={{ color: '#fff' }}>{D65_WHITE.y.toFixed(4)}</strong></div>
                <div>Z_ref = <strong style={{ color: '#fff' }}>{D65_WHITE.z.toFixed(4)}</strong></div>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                CIE Standard Illuminant D65 (Daylight 6504K)
              </span>
            </div>
          </div>

          {/* Mathematical Formula Display */}
          <div className="glass-panel" style={{ padding: '14px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--accent-cyan)', display: 'block', marginBottom: '6px' }}>
              CHROMATIC ADAPTATION FORMULATION:
            </span>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.74rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '10px 12px',
                borderRadius: '6px',
                overflowX: 'auto'
              }}
            >
              <div><strong>XYZ_adapted</strong> = M⁻¹ × D × M × XYZ_source</div>
              <div style={{ margin: '6px 0', color: 'var(--text-muted)' }}>
                M = [[0.8951, 0.2664, -0.1614], [-0.7502, 1.7135, 0.0367], [0.0389, -0.0685, 1.0296]]
              </div>
              <div>LMS_source = M × XYZ_source_white</div>
              <div>LMS_reference = M × XYZ_reference_white</div>
              <div>
                D = diag({dMatrix.d0.toFixed(4)}, {dMatrix.d1.toFixed(4)}, {dMatrix.d2.toFixed(4)})
              </div>
            </div>
          </div>

          {/* Before vs After Measured Values */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {/* Before Correction */}
            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)' }}>
                  1. BEFORE CORRECTION
                </span>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    background: labToHex(labBefore.L, labBefore.a, labBefore.b),
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <div>XYZ: [{rawStripXYZ.x.toFixed(3)}, {rawStripXYZ.y.toFixed(3)}, {rawStripXYZ.z.toFixed(3)}]</div>
                <div>L*: <strong>{labBefore.L.toFixed(2)}</strong></div>
                <div>a*: <strong>{labBefore.a.toFixed(2)}</strong></div>
                <div>b*: <strong>{labBefore.b.toFixed(2)}</strong></div>
              </div>
            </div>

            {/* After Correction */}
            <div className="glass-panel" style={{ padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                  2. AFTER CORRECTION (D65)
                </span>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    background: labToHex(labAfter.L, labAfter.a, labAfter.b),
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <div>XYZ: [{adaptedXYZ.x.toFixed(3)}, {adaptedXYZ.y.toFixed(3)}, {adaptedXYZ.z.toFixed(3)}]</div>
                <div>L*: <strong style={{ color: '#fff' }}>{labAfter.L.toFixed(2)}</strong></div>
                <div>a*: <strong style={{ color: '#fff' }}>{labAfter.a.toFixed(2)}</strong></div>
                <div>b*: <strong style={{ color: '#fff' }}>{labAfter.b.toFixed(2)}</strong></div>
              </div>
            </div>
          </div>

          {/* Color Difference Metric */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: 'var(--font-mono)'
            }}
          >
            <span>Illuminant Chromatic Shift (ΔE₀₀):</span>
            <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.88rem' }}>
              {deltaE00Shift.toFixed(2)} ΔE₀₀
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
