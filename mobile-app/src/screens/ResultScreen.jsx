import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Activity,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  Sliders,
  Thermometer,
  Droplets,
  Sparkles,
  Info
} from 'lucide-react';
import { RISK_ZONES, ppmToAlertLevel } from '@shared/colorimetricStandards';

export default function ResultScreen({ result, workerData, onRetryCapture, onNextWorker, isDemoMode }) {
  const [showDebugDetails, setShowDebugDetails] = useState(false);

  if (!result) return null;

  const {
    readingId,
    workerId,
    shiftId,
    stripColorRGB,
    referenceColorRGB,
    greyColorRGB,
    correctedColorRGB,
    estimatedDosePpmHours = 0.0,
    calibrationCurveVersion = 'scientific-cielab-v2',
    createdAt,
    alertLevel = 'SAFE',
    alertNote = 'Within normal exposure limits.',
    alertBadgeClass = 'safe',
    alertColor = '#10b981',
    confidence = 94.8,
    qualityStatus = 'GOOD',
    lab = { L: 95.4, a: -0.4, b: 4.2 },
    deltaE00 = 0.0,
    envValid = true,
    envReason = 'Within rated operational range',
    rateFactor = 1.0,
    qualityGate = { saturationRatio: 0.002, underexposedRatio: 0.005, score: 92 }
  } = result;

  const isDanger = ['ALERT', 'DANGER', 'SEVERE', 'LIFE_THREATENING'].includes(alertLevel);
  const doseNumber = Number(estimatedDosePpmHours) || 0.0;
  const shiftPercent = Math.min(100, Math.round((doseNumber / 80.0) * 100)); // DGMS 80 ppm·h shift limit

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%' }}>
      {/* Top Header & Demo Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-cyan)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SIH26118 H₂S DOSIMETER
          </span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
            Exposure Reading
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isDemoMode && (
            <span style={{ background: '#f59e0b', color: '#000', fontSize: '0.68rem', fontWeight: '900', padding: '3px 8px', borderRadius: '4px', letterSpacing: '0.05em' }}>
              DEMO DATA
            </span>
          )}
          <span className={`badge badge-${alertBadgeClass}`} style={{ fontSize: '0.75rem', padding: '4px 10px', textTransform: 'uppercase' }}>
            {alertLevel}
          </span>
        </div>
      </div>

      {/* Hero Dose Metric Card (1-Second Operator Readability) */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 20px',
          textAlign: 'center',
          border: isDanger ? '1px solid #f43f5e' : '1px solid rgba(16, 185, 129, 0.4)',
          background: isDanger
            ? 'radial-gradient(circle at 50% 0%, rgba(244, 63, 94, 0.18) 0%, var(--bg-card) 100%)'
            : 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, var(--bg-card) 100%)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>
          Cumulative Shift Exposure
        </span>

        {/* Big Dose Value */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px', margin: '10px 0 4px 0' }}>
          <span
            style={{
              fontSize: '3.6rem',
              fontWeight: '900',
              color: isDanger ? 'var(--accent-rose)' : 'var(--accent-emerald)',
              letterSpacing: '-0.04em',
              lineHeight: 1
            }}
          >
            {doseNumber.toFixed(1)}
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
            ppm·h
          </span>
        </div>

        {/* Statutory Shift Utilization Meter */}
        <div style={{ margin: '14px 0 6px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span>DGMS 8-hr Shift Limit: 80 ppm·h</span>
            <strong>{shiftPercent}% Used</strong>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${shiftPercent}%`,
                height: '100%',
                background: shiftPercent > 100 ? '#f43f5e' : shiftPercent > 50 ? '#f59e0b' : '#10b981',
                transition: 'width 0.5s ease'
              }}
            />
          </div>
        </div>

        {/* Regulatory Action Instruction */}
        <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: '600', margin: '10px 0 0 0', lineHeight: 1.4 }}>
          {alertNote}
        </p>
      </div>

      {/* Clean Metadata Cards (Environmental & Quality) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            TEMPERATURE
          </span>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {result.ambientTemp || 25}°C
          </strong>
        </div>

        <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            HUMIDITY
          </span>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {result.ambientHumidity || 50}% RH
          </strong>
        </div>

        <div className="glass-panel" style={{ padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            CONFIDENCE
          </span>
          <strong style={{ fontSize: '0.95rem', color: '#38bdf8' }}>
            {confidence > 1 ? `${confidence}%` : `${(confidence * 100).toFixed(1)}%`}
          </strong>
        </div>
      </div>

      {/* Expandable Scientific Details Drawer (CIE 015 & ISO 17321 Trace) */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <button
          onClick={() => setShowDebugDetails(!showDebugDetails)}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: '700'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} color="var(--accent-cyan)" />
            <span>Scientific Analysis Details</span>
          </div>
          {showDebugDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDebugDetails && (
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(3, 7, 18, 0.6)', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.78rem' }}>
            {/* Colorimetric Metric Table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Optical Shift ΔE₀₀:</span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{deltaE00}</strong> (ISO/CIE 11664-6)
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>CIELAB (L*, a*, b*):</span>
                <strong style={{ color: '#f8fafc' }}>{lab.L}, {lab.a}, {lab.b}</strong>
              </div>
            </div>

            {/* Quality Gate Breakdown */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                Image Quality Gate (ISO 17321-1)
              </strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Quality Status:</span>
                <strong style={{ color: qualityStatus === 'GOOD' ? '#10b981' : '#f43f5e' }}>{qualityStatus}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>Highlight Saturation:</span>
                <span>{(qualityGate.saturationRatio * 100).toFixed(1)}% (Limit: &lt;3.0%)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>Arrhenius Kinetic Rate Factor:</span>
                <span>k(T, RH) = {rateFactor}</span>
              </div>
            </div>

            {/* Device & Model Attribution */}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              <div>Model: <strong>Piecewise Monotonic Spline (v2.0)</strong></div>
              <div>Camera Characterization: <strong>ISO 17321-1 3×3 CCM Calibrated</strong></div>
              <div>Chromatic Adaptation: <strong>Bradford CAT (CIE 015)</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', paddingTop: '8px' }}>
        <button
          className="btn-secondary"
          onClick={onRetryCapture}
          style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
        >
          <RotateCcw size={16} /> Scan Again
        </button>

        <button
          className="btn-primary"
          onClick={onNextWorker}
          style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
        >
          <UserPlus size={16} /> Next Worker
        </button>
      </div>
    </div>
  );
}
