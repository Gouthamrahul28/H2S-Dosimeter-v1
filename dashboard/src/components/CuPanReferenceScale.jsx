import React, { useState } from 'react';
import {
  CALIBRATION_POINTS,
  VIRGIN_BASELINE_LAB,
  labToHex,
  labToRgb
} from '@shared/colorimetricStandards';
import { Sparkles, Info, HelpCircle, AlertCircle } from 'lucide-react';

/**
 * Cu-PAN Reference Colour Scale Component
 * 
 * Displays the experimentally calibrated progression:
 * UNEXPOSED → EARLY RESPONSE → MODERATE RESPONSE → HIGH RESPONSE → SATURATED
 * 
 * NOTE: Swatch colors are computed strictly from calibrated CIELAB (L*, a*, b*) coordinates.
 * Uncalibrated regions are explicitly labeled "NOT CALIBRATED".
 */

// Selected primary experimental milestones for the compact reference bar
const CALIBRATED_STAGES = [
  {
    stage: 'UNEXPOSED',
    stageLabel: 'Virgin Baseline',
    sampleId: 'CAL-000-CTRL',
    dose: 0.0,
    doseFormatted: '0.0 ppm·h',
    isCalibrated: true,
    L: 42.50,
    a: 38.20,
    b: -28.40,
    deltaE00: 0.00,
    desc: 'Unexposed Cu(II)-PAN complex matrix (Purple/Violet).'
  },
  {
    stage: 'EARLY RESPONSE',
    stageLabel: 'Early Shift Exposure',
    sampleId: 'CAL-002-TWA',
    dose: 2.0,
    doseFormatted: '2.0 ppm·h',
    isCalibrated: true,
    L: 44.10,
    a: 35.40,
    b: -21.80,
    deltaE00: 4.85,
    desc: 'Initial sulfide interaction; chromatic shift within violet family.'
  },
  {
    stage: 'MODERATE RESPONSE',
    stageLabel: 'Occupational Threshold',
    sampleId: 'CAL-020-PEL',
    dose: 20.0,
    doseFormatted: '20.0 ppm·h',
    isCalibrated: true,
    L: 58.20,
    a: 21.80,
    b: 19.40,
    deltaE00: 30.50,
    desc: 'Partial ligand release; intermediate purple-to-amber transition.'
  },
  {
    stage: 'HIGH RESPONSE',
    stageLabel: 'DGMS Statutory Limit',
    sampleId: 'CAL-080-DGMS',
    dose: 80.0,
    doseFormatted: '80.0 ppm·h',
    isCalibrated: true,
    L: 70.50,
    a: 15.20,
    b: 56.20,
    deltaE00: 61.10,
    desc: 'Extensive CuS formation & H-PAN release (Intense Yellow/Orange).'
  },
  {
    stage: 'SATURATED',
    stageLabel: 'Upper Measured Domain',
    sampleId: 'CAL-160-SAT',
    dose: 160.0,
    doseFormatted: '160.0 ppm·h',
    isCalibrated: true,
    L: 72.80,
    a: 14.50,
    b: 62.00,
    deltaE00: 70.50,
    desc: 'Maximum characterized reaction limit in chamber calibration.'
  },
  {
    stage: 'UNCALIBRATED',
    stageLabel: 'Beyond Measured Range',
    sampleId: 'OUT-OF-BOUNDS',
    dose: null,
    doseFormatted: 'NOT CALIBRATED',
    isCalibrated: false,
    L: null,
    a: null,
    b: null,
    deltaE00: null,
    desc: 'Gas exposures beyond 160.0 ppm·h are not extrapolated.'
  }
];

export default function CuPanReferenceScale() {
  const [activeStage, setActiveStage] = useState(null);

  return (
    <div
      className="glass-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #f59e0b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Sparkles size={16} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Cu-PAN Reference Colour Scale
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Experimentally calibrated chromatic progression (Hover/tap swatch for ΔE₀₀ & CIELAB coordinates)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <Info size={13} />
          <span>Derived from chamber dataset</span>
        </div>
      </div>

      {/* Horizontal Scrollable Progression Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '6px',
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {CALIBRATED_STAGES.map((pt, idx) => {
          const hex = pt.isCalibrated ? labToHex(pt.L, pt.a, pt.b) : 'transparent';
          const isSelected = activeStage?.stage === pt.stage;

          return (
            <div
              key={pt.stage}
              onClick={() => setActiveStage(isSelected ? null : pt)}
              onMouseEnter={() => setActiveStage(pt)}
              style={{
                minWidth: '150px',
                flex: '1 0 150px',
                background: isSelected ? 'var(--bg-card-hover)' : 'rgba(255, 255, 255, 0.02)',
                border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {/* Swatch & Stage Identifier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '24px',
                    borderRadius: '5px',
                    background: pt.isCalibrated ? hex : 'repeating-linear-gradient(45deg, #1e293b, #1e293b 4px, #334155 4px, #334155 8px)',
                    border: pt.isCalibrated ? '1px solid rgba(255, 255, 255, 0.3)' : '1px dashed #64748b',
                    boxShadow: pt.isCalibrated ? '0 2px 6px rgba(0,0,0,0.3)' : 'none',
                    flexShrink: 0
                  }}
                />
                <div style={{ overflow: 'hidden' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: '800',
                      color: pt.isCalibrated ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      letterSpacing: '0.04em',
                      display: 'block',
                      textTransform: 'uppercase'
                    }}
                  >
                    {pt.stage}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {pt.sampleId}
                  </span>
                </div>
              </div>

              {/* Dose Display */}
              <div>
                <strong
                  style={{
                    fontSize: pt.isCalibrated ? '0.92rem' : '0.78rem',
                    color: pt.isCalibrated ? 'var(--text-primary)' : '#f59e0b',
                    fontFamily: pt.isCalibrated ? 'var(--font-mono)' : 'inherit',
                    display: 'block'
                  }}
                >
                  {pt.doseFormatted}
                </strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block' }}>
                  {pt.stageLabel}
                </span>
              </div>

              {/* Compact Metrics Row */}
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingTop: '6px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>ΔE₀₀: <strong style={{ color: pt.isCalibrated ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>{pt.isCalibrated ? pt.deltaE00.toFixed(1) : '—'}</strong></span>
                <span>L*: <strong style={{ color: pt.isCalibrated ? '#f8fafc' : 'var(--text-muted)' }}>{pt.isCalibrated ? pt.L.toFixed(1) : '—'}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Detail Drawer on Hover/Tap */}
      {activeStage && (
        <div
          style={{
            background: 'rgba(3, 7, 18, 0.6)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 14px',
            fontSize: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '800', color: 'var(--accent-cyan)' }}>{activeStage.stage}:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{activeStage.stageLabel}</strong>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({activeStage.sampleId})</span>
            </div>
            <p style={{ margin: '3px 0 0 0', color: 'var(--text-secondary)' }}>
              {activeStage.desc}
            </p>
          </div>

          {activeStage.isCalibrated ? (
            <div style={{ display: 'flex', gap: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              <div>CIELAB: <strong style={{ color: '#fff' }}>[{activeStage.L.toFixed(2)}, {activeStage.a.toFixed(2)}, {activeStage.b.toFixed(2)}]</strong></div>
              <div>ΔE₀₀: <strong style={{ color: 'var(--accent-cyan)' }}>{activeStage.deltaE00.toFixed(2)}</strong></div>
              <div>True Dose: <strong style={{ color: 'var(--accent-emerald)' }}>{activeStage.doseFormatted}</strong></div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: '700' }}>
              <AlertCircle size={14} />
              <span>Extrapolation is disabled outside calibrated chamber domain.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
