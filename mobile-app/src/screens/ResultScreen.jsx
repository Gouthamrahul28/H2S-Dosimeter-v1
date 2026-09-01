import React, { useState } from 'react';
import {
  RotateCcw,
  UserPlus,
  Cpu,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Droplets,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Camera,
  Clock,
  QrCode,
  XCircle,
  ShieldCheck,
  Zap
} from 'lucide-react';
import StripLifecycleModal from '../components/StripLifecycleModal';

export default function ResultScreen({ result, workerData, onRetryCapture, onNextWorker, isDemoMode }) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);

  if (!result) return null;

  const {
    readingId,
    workerId = workerData?.workerId || 'W1023',
    shiftId,
    chemistry = 'Cu-PAN',
    indicator = 'Copper(II)-PAN',
    stripBatch = 'CUPAN-BATCH-001',
    cameraProfile = 'mobile_001',
    stripColorRGB = { r: 139, g: 76, b: 148 },
    referenceColorRGB = { r: 250, g: 250, b: 250 },
    greyColorRGB = { r: 128, g: 128, b: 128 },
    correctedColorRGB = { r: 139, g: 76, b: 148 },
    estimatedDosePpmHours = 0.0,
    dose = 0.0,
    unit = 'ppm·h',
    calibration_status = 'VALID',
    calibrationStatus = 'VALID',
    alertLevel = 'SAFE',
    alertNote = 'Within normal occupational limits.',
    alertBadgeClass = 'safe',
    alertColor = '#10b981',
    confidence = 94,
    confidencePercent = 94,
    lab = { L: 42.50, a: 38.20, b: -28.40 },
    deltaE00 = 0.0,
    temperature_c = 25.0,
    ambientTemp = 25.0,
    humidity_percent = 50.0,
    ambientHumidity = 50.0,
    qualityGate = { score: 92 },
    strip = null,
    strip_life = null
  } = result;

  const activeDose = Number(dose || estimatedDosePpmHours || 0.0);
  const activeTemp = Number(temperature_c || ambientTemp || 25.0);
  const activeHumidity = Number(humidity_percent || ambientHumidity || 50.0);
  const activeConfidence = Number(confidencePercent || (confidence > 1 ? confidence : confidence * 100) || 94.0);
  const isOutOfRange = calibration_status === 'OUTSIDE CALIBRATION RANGE' || calibrationStatus === 'OUTSIDE CALIBRATION RANGE';
  const isDanger = ['ALERT', 'DANGER', 'SEVERE', 'LIFE_THREATENING'].includes(alertLevel);
  const shiftPercent = Math.min(100, Math.round((activeDose / 80.0) * 100)); // DGMS 80 ppm·h shift limit

  // Extract authoritative Strip Sensing Capacity metrics
  const stripId = strip?.id || strip_life?.strip_id || workerData?.assignedStripId || 'CUPAN-2026-000123';
  const batchId = strip?.batch_id || stripBatch || 'CUPAN-BATCH-001';
  const cumulativeStripDose = strip_life?.cumulative_dose_ppm_h !== undefined
    ? Number(strip_life.cumulative_dose_ppm_h)
    : Number(strip?.cumulative_dose || activeDose);
  const maxValidatedDose = strip_life?.max_validated_dose_ppm_h !== undefined
    ? strip_life.max_validated_dose_ppm_h
    : (strip?.max_validated_dose || 160.0);

  const lifeRemaining = strip_life?.remaining_percent !== undefined
    ? strip_life.remaining_percent
    : (strip?.life_remaining_percent !== undefined ? strip.life_remaining_percent : 100);
  const lifeUsed = strip_life?.used_percent !== undefined
    ? strip_life.used_percent
    : (strip?.life_used_percent !== undefined ? strip.life_used_percent : 0);

  const stripStatus = strip_life?.status || strip?.status || 'GOOD';
  const statusLabel = strip_life?.status_label || strip?.status_label || (lifeRemaining > 30 ? 'STRIP GOOD' : lifeRemaining > 10 ? 'REPLACE SOON' : 'REPLACE NOW');
  const timeRemaining = strip_life?.time_remaining || strip?.time_remaining_formatted || null;
  const isTimeValidated = !!strip?.active_life_validated || (timeRemaining && !timeRemaining.includes('NOT YET VALIDATED'));

  const isStripLow = lifeRemaining !== null && lifeRemaining <= 30 && lifeRemaining > 10;
  const isStripExhausted = lifeRemaining !== null && (lifeRemaining <= 10 || stripStatus === 'REPLACE_NOW' || stripStatus === 'EXHAUSTED');

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-cyan)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SIH26118 • Cu-PAN DOSIMETER
          </span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
            Exposure Result
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              padding: '4px 8px',
              borderRadius: '6px',
              background: isOutOfRange ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: isOutOfRange ? '#f87171' : '#34d399',
              border: isOutOfRange ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)'
            }}
          >
            {isOutOfRange ? 'OUT OF RANGE' : 'CALIBRATED'}
          </span>
          <span className={`badge badge-${alertBadgeClass}`} style={{ fontSize: '0.75rem', padding: '4px 10px', textTransform: 'uppercase' }}>
            {alertLevel}
          </span>
        </div>
      </div>

      {/* 1. PRIMARY H2S EXPOSURE RESULT CARD */}
      <div
        className="glass-panel"
        style={{
          padding: '22px 20px',
          textAlign: 'center',
          border: isDanger ? '1px solid #f43f5e' : isOutOfRange ? '1px solid #f59e0b' : '1px solid rgba(16, 185, 129, 0.4)',
          background: isDanger
            ? 'radial-gradient(circle at 50% 0%, rgba(244, 63, 94, 0.18) 0%, var(--bg-card) 100%)'
            : isOutOfRange
            ? 'radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.18) 0%, var(--bg-card) 100%)'
            : 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, var(--bg-card) 100%)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>
          Current Scan Exposure
        </span>

        {/* Primary Dose Figure */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px', margin: '8px 0 2px 0' }}>
          <span
            style={{
              fontSize: '3.6rem',
              fontWeight: '900',
              color: isDanger ? 'var(--accent-rose)' : isOutOfRange ? '#f59e0b' : 'var(--accent-emerald)',
              letterSpacing: '-0.04em',
              lineHeight: 1
            }}
          >
            {activeDose.toFixed(1)}
          </span>
          <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
            ppm·h
          </span>
        </div>

        {/* Statutory Shift Utilization Meter */}
        <div style={{ margin: '12px 0 6px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span>DGMS 8-hr Shift Limit (80 ppm·h)</span>
            <strong>{shiftPercent}%</strong>
          </div>
          <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
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
        <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: '600', margin: '8px 0 0 0', lineHeight: 1.4 }}>
          {isOutOfRange ? 'Warning: Sensor response exceeds calibrated experimental domain.' : alertNote}
        </p>
      </div>

      {/* 2. DEDICATED CURRENT Cu-PAN STRIP SENSING CAPACITY CARD */}
      <div
        className="glass-panel"
        style={{
          padding: '18px',
          border: isStripExhausted
            ? '1.5px solid rgba(239, 68, 68, 0.6)'
            : isStripLow
            ? '1.5px solid rgba(245, 158, 11, 0.6)'
            : '1px solid rgba(6, 182, 212, 0.35)',
          background: isStripExhausted
            ? 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.15) 0%, var(--bg-card) 100%)'
            : isStripLow
            ? 'radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.15) 0%, var(--bg-card) 100%)'
            : 'radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.12) 0%, var(--bg-card) 100%)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        {/* Strip Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent-cyan)" />
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                CURRENT Cu-PAN STRIP
              </strong>
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                {stripId} &bull; {batchId}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowReplaceModal(true)}
            className="btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <QrCode size={13} />
            <span>Replace Strip</span>
          </button>
        </div>

        {/* Sensing Capacity Heading */}
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Sensing Life Remaining
          </span>

          <div style={{ margin: '4px 0 8px 0' }}>
            {lifeRemaining !== null ? (
              <span
                style={{
                  fontSize: '2.8rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-mono)',
                  color: isStripExhausted ? '#ef4444' : isStripLow ? '#f59e0b' : '#34d399',
                  lineHeight: 1
                }}
              >
                {lifeRemaining}%
              </span>
            ) : (
              <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#f59e0b' }}>
                NOT YET VALIDATED
              </span>
            )}
          </div>

          {/* Graphical Progress Bar: Remaining vs Used */}
          {lifeRemaining !== null && (
            <div>
              <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${lifeRemaining}%`,
                    height: '100%',
                    background: isStripExhausted ? '#ef4444' : isStripLow ? '#f59e0b' : 'linear-gradient(90deg, #06b6d4 0%, #10b981 100%)',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                <span>Used: <strong style={{ color: 'var(--text-primary)' }}>{lifeUsed}%</strong> ({cumulativeStripDose.toFixed(1)} ppm·h)</span>
                <span>Remaining: <strong style={{ color: isStripExhausted ? '#ef4444' : isStripLow ? '#f59e0b' : '#34d399' }}>{lifeRemaining}%</strong> ({Math.max(0, (maxValidatedDose - cumulativeStripDose)).toFixed(1)} ppm·h)</span>
              </div>
            </div>
          )}
        </div>

        {/* Strip Status Badge & Replacement Recommendation */}
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            background: isStripExhausted
              ? 'rgba(239, 68, 68, 0.18)'
              : isStripLow
              ? 'rgba(245, 158, 11, 0.18)'
              : 'rgba(16, 185, 129, 0.12)',
            border: isStripExhausted
              ? '1px solid rgba(239, 68, 68, 0.35)'
              : isStripLow
              ? '1px solid rgba(245, 158, 11, 0.35)'
              : '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isStripExhausted ? (
              <XCircle size={18} color="#ef4444" />
            ) : isStripLow ? (
              <AlertTriangle size={18} color="#f59e0b" />
            ) : (
              <CheckCircle2 size={18} color="#10b981" />
            )}

            <div>
              <strong
                style={{
                  fontSize: '0.82rem',
                  color: isStripExhausted ? '#f87171' : isStripLow ? '#fbbf24' : '#34d399',
                  display: 'block'
                }}
              >
                {isStripExhausted
                  ? '✕ REPLACE STRIP NOW'
                  : isStripLow
                  ? '⚠ STRIP NEAR END OF LIFE'
                  : '● STRIP GOOD'}
              </strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {isStripExhausted
                  ? 'Cu-PAN sensing capacity exhausted. New scans blocked until replaced.'
                  : isStripLow
                  ? 'Sensing capacity below 30%. Recommend replacing soon.'
                  : 'Sensing capacity optimal for continuous shift monitoring.'}
              </span>
            </div>
          </div>
        </div>

        {/* Time-Based Replacement Info (Decoupled from Sensing Capacity) */}
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
            <Clock size={13} />
            <span>Active wear window:</span>
          </div>
          <strong style={{ color: isTimeValidated ? 'var(--accent-cyan)' : '#f59e0b', fontFamily: 'var(--font-mono)' }}>
            {timeRemaining || 'NOT YET VALIDATED'}
          </strong>
        </div>
      </div>

      {/* Metadata Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div className="glass-panel" style={{ padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <Percent size={13} />
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>Confidence</span>
          </div>
          <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
            {activeConfidence.toFixed(0)}%
          </strong>
        </div>

        <div className="glass-panel" style={{ padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <Thermometer size={13} />
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>Temperature</span>
          </div>
          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            {activeTemp.toFixed(0)}°C
          </strong>
        </div>

        <div className="glass-panel" style={{ padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <Droplets size={13} />
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>Humidity</span>
          </div>
          <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            {activeHumidity.toFixed(0)}%
          </strong>
        </div>
      </div>

      {/* Collapsible Technical / Scientific Analysis View */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <button
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={15} color="var(--accent-cyan)" />
            <span>Cu-PAN Colorimetry & Calibration Trace</span>
          </div>
          {showTechnicalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showTechnicalDetails && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', fontSize: '0.75rem', lineHeight: '1.6' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Chemistry:</span>{' '}
                <strong style={{ color: 'var(--accent-cyan)' }}>{chemistry}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Color Transition:</span>{' '}
                <strong style={{ color: '#fbbf24' }}>Purple &rarr; Yellow/Orange</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Measured &Delta;E₀₀:</span>{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>{deltaE00.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>CIELAB Coordinates:</span>{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  L:{lab.L?.toFixed(1)} a:{lab.a?.toFixed(1)} b:{lab.b?.toFixed(1)}
                </strong>
              </div>
            </div>

            <div style={{ padding: '8px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)' }}>
              Scientific Principle: Cu(II)-PAN + H₂S &rarr; CuS + H-PAN. Strip capacity is calibrated up to {maxValidatedDose} ppm·h based on empirical spline kinetics.
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '8px' }}>
        <button
          onClick={onRetryCapture}
          className="btn-secondary"
          style={{ flex: 1, padding: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <Camera size={16} />
          <span>Scan Again</span>
        </button>

        <button
          onClick={onNextWorker}
          className="btn-primary"
          style={{ flex: 1, padding: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <UserPlus size={16} />
          <span>Next Worker</span>
        </button>
      </div>

      {/* Quick Replacement Modal */}
      <StripLifecycleModal
        workerId={workerId}
        currentStrip={strip}
        isOpen={showReplaceModal}
        onClose={() => setShowReplaceModal(false)}
        onSuccess={() => {
          if (onRetryCapture) onRetryCapture();
        }}
      />
    </div>
  );
}
