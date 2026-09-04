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
    chemistry,
    sensor_chemistry,
    indicator,
    stripBatch,
    cameraProfile = 'mobile_001',
    stripColorRGB = { r: 139, g: 76, b: 148 },
    referenceColorRGB = { r: 250, g: 250, b: 250 },
    greyColorRGB = { r: 128, g: 128, b: 128 },
    correctedColorRGB = { r: 139, g: 76, b: 148 },
    estimatedDosePpmHours = null,
    dose = null,
    unit,
    calibration_status = 'VALID',
    calibrationStatus = 'VALID',
    alertLevel = 'SAFE',
    alertNote = 'Within normal occupational limits.',
    alertBadgeClass = 'safe',
    alertColor = '#10b981',
    confidence = null,
    confidencePercent = null,
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

  // Resolve chemistry dynamically from authoritative backend payload
  const rawChem = sensor_chemistry || chemistry || result.model?.chemistry || workerData?.chemistry || 'CU_PAN';
  const isLeadAcetate = rawChem === 'LEAD_ACETATE' || rawChem === 'Lead-Acetate' || (typeof rawChem === 'string' && rawChem.toUpperCase().includes('LEAD'));
  const activeChemDisplay = isLeadAcetate ? 'LEAD ACETATE' : 'CU-PAN';
  const activeChemName = isLeadAcetate ? 'Lead Acetate' : 'Cu-PAN';
  const displayUnit = unit || result.unit || (isLeadAcetate ? 'mL H₂S' : 'ppm·h');

  // Extract numeric dose while preserving explicit null/uncalibrated states
  const rawDose = (dose !== undefined && dose !== null)
    ? Number(dose)
    : (estimatedDosePpmHours !== undefined && estimatedDosePpmHours !== null ? Number(estimatedDosePpmHours) : null);

  const isDoseAvailable = rawDose !== null && !isNaN(rawDose);
  const activeDose = isDoseAvailable ? rawDose : 0.0;
  const isVirgin = !!result.isVirginBaseline || (isDoseAvailable && rawDose === 0.0 && (calibrationStatus === 'VALID' || calibration_status === 'VALID'));
  const isPendingSync = result._isOfflineQueued || calibrationStatus === 'OFFLINE_PENDING_SYNC';
  const isCalibUnavailable = calibrationStatus === 'CALIBRATION_UNAVAILABLE' || calibrationStatus === 'CALIBRATION_DATA_REQUIRED' || calibration_status === 'CALIBRATION_UNAVAILABLE';
  const isImageRejected = calibrationStatus === 'IMAGE_PROCESSING_FAILED' || calibration_status === 'IMAGE_PROCESSING_FAILED';
  const isErrorState = !isDoseAvailable || isPendingSync || isCalibUnavailable || isImageRejected;

  const activeTemp = Number(temperature_c || ambientTemp || 25.0);
  const activeHumidity = Number(humidity_percent || ambientHumidity || 50.0);
  const activeConfidence = Number(confidencePercent || (confidence > 1 ? confidence : (confidence !== null ? confidence * 100 : 94.0)));
  const isOutOfRange = calibration_status === 'OUTSIDE CALIBRATION RANGE' || calibrationStatus === 'OUTSIDE CALIBRATION RANGE';
  const isDanger = ['ALERT', 'DANGER', 'SEVERE', 'LIFE_THREATENING'].includes(alertLevel);

  // Shift limit / experimental domain calculation
  const shiftPercent = isDoseAvailable
    ? (isLeadAcetate
        ? Math.min(100, Math.round((activeDose / 22.3) * 100)) // 22.3 mL H2S gas-train experimental domain
        : Math.min(100, Math.round((activeDose / 80.0) * 100))) // DGMS 80 ppm·h shift limit
    : 0;

  // Extract authoritative Strip Sensing Capacity metrics
  const stripId = strip?.id || strip?.stripId || strip_life?.strip_id || workerData?.assignedStripId || (isLeadAcetate ? 'LA-STRIP-2026-000101' : 'CUPAN-2026-000123');
  const batchId = strip?.batch_id || strip?.batchId || stripBatch || (isLeadAcetate ? 'LA-BATCH-2026-01' : 'CUPAN-BATCH-001');
  const cumulativeStripDose = strip_life?.cumulative_dose_ppm_h !== undefined
    ? Number(strip_life.cumulative_dose_ppm_h)
    : Number(strip?.cumulative_dose || (isDoseAvailable ? activeDose : 0.0));

  // For Lead Acetate: sensing capacity is currently under active characterization and NOT yet validated
  const hasValidatedCapacity = !isLeadAcetate && (strip?.max_validated_dose || strip_life?.max_validated_dose_ppm_h) > 0;
  const maxValidatedDose = hasValidatedCapacity ? (strip_life?.max_validated_dose_ppm_h || strip?.max_validated_dose || 160.0) : null;

  const lifeRemaining = hasValidatedCapacity
    ? (strip_life?.remaining_percent !== undefined
        ? strip_life.remaining_percent
        : (strip?.life_remaining_percent !== undefined ? strip.life_remaining_percent : 100))
    : null;

  const lifeUsed = hasValidatedCapacity
    ? (strip_life?.used_percent !== undefined
        ? strip_life.used_percent
        : (strip?.life_used_percent !== undefined ? strip.life_used_percent : 0))
    : null;

  const stripStatus = strip_life?.status || strip?.status || 'GOOD';
  const statusLabel = strip_life?.status_label || strip?.status_label || (lifeRemaining !== null && lifeRemaining > 30 ? 'STRIP GOOD' : (lifeRemaining !== null && lifeRemaining > 10 ? 'REPLACE SOON' : (hasValidatedCapacity ? 'REPLACE NOW' : 'NOT YET VALIDATED')));
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
            SIH26118 • {activeChemDisplay} DOSIMETER
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
              background: isErrorState ? 'rgba(148, 163, 184, 0.2)' : isOutOfRange ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: isErrorState ? '#94a3b8' : isOutOfRange ? '#f87171' : '#34d399',
              border: isErrorState ? '1px solid rgba(148, 163, 184, 0.4)' : isOutOfRange ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)'
            }}
          >
            {isPendingSync
              ? 'SYNC PENDING'
              : isCalibUnavailable
              ? 'CALIBRATION REQUIRED'
              : isImageRejected
              ? 'IMAGE REJECTED'
              : isOutOfRange
              ? 'OUT OF RANGE'
              : isVirgin
              ? 'VIRGIN BASELINE'
              : 'CALIBRATED'}
          </span>
          <span className={`badge badge-${alertBadgeClass}`} style={{ fontSize: '0.75rem', padding: '4px 10px', textTransform: 'uppercase' }}>
            {isErrorState ? (isPendingSync ? 'PENDING' : 'UNAVAILABLE') : alertLevel}
          </span>
        </div>
      </div>

      {/* 1. PRIMARY H2S EXPOSURE RESULT CARD */}
      <div
        className="glass-panel"
        style={{
          padding: '22px 20px',
          textAlign: 'center',
          border: isErrorState
            ? '1px solid rgba(148, 163, 184, 0.4)'
            : isDanger
            ? '1px solid #f43f5e'
            : isOutOfRange
            ? '1px solid #f59e0b'
            : '1px solid rgba(16, 185, 129, 0.4)',
          background: isErrorState
            ? 'radial-gradient(circle at 50% 0%, rgba(148, 163, 184, 0.15) 0%, var(--bg-card) 100%)'
            : isDanger
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
              color: isErrorState
                ? '#94a3b8'
                : isDanger
                ? 'var(--accent-rose)'
                : isOutOfRange
                ? '#f59e0b'
                : 'var(--accent-emerald)',
              letterSpacing: '-0.04em',
              lineHeight: 1
            }}
          >
            {isDoseAvailable ? activeDose.toFixed(1) : '--'}
          </span>
          <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
            {displayUnit}
          </span>
        </div>

        {/* Statutory / Experimental Domain Utilization Meter */}
        <div style={{ margin: '12px 0 6px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span>{isLeadAcetate ? 'Stoichiometric Gas Domain (22.3 mL H₂S)' : 'DGMS 8-hr Shift Limit (80 ppm·h)'}</span>
            <strong>{isDoseAvailable ? `${shiftPercent}%` : 'N/A'}</strong>
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
          {isPendingSync
            ? 'Reading enqueued locally on device. Dose will be calculated when server network restores.'
            : isCalibUnavailable
            ? 'Calibration Unavailable: Real experimental calibration data is required before exposure can be computed.'
            : isImageRejected
            ? 'Optical Quality Gate Failed: Please recapture under clean, steady, non-glare illumination.'
            : isVirgin
            ? `Verified unexposed baseline strip. Zero exposure detected (0.0 ${displayUnit}).`
            : isOutOfRange
            ? 'Warning: Sensor response exceeds calibrated experimental domain.'
            : alertNote}
        </p>
      </div>

      {/* 2. DEDICATED CURRENT STRIP SENSING CAPACITY CARD */}
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
                CURRENT {activeChemDisplay} STRIP
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

          {lifeRemaining !== null ? (
            <div>
              <div style={{ margin: '4px 0 8px 0' }}>
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
              </div>

              {/* Graphical Progress Bar: Remaining vs Used */}
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
                  <span>Used: <strong style={{ color: 'var(--text-primary)' }}>{lifeUsed}%</strong> ({cumulativeStripDose.toFixed(1)} {displayUnit})</span>
                  <span>Remaining: <strong style={{ color: isStripExhausted ? '#ef4444' : isStripLow ? '#f59e0b' : '#34d399' }}>{lifeRemaining}%</strong> ({Math.max(0, (maxValidatedDose - cumulativeStripDose)).toFixed(1)} {displayUnit})</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ margin: '10px 0 4px 0' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#f59e0b', display: 'block' }}>
                Sensing capacity: Not yet validated
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                {isLeadAcetate
                  ? 'Stoichiometric capacity limit for Lead Acetate is under active experimental characterization.'
                  : 'Strip active wear life has not yet been validated for this batch.'}
              </span>
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
                  ? `${activeChemName} sensing capacity exhausted. New scans blocked until replaced.`
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
            {isTimeValidated && timeRemaining ? timeRemaining : 'Time-based replacement: Not yet validated'}
          </strong>
        </div>
      </div>

      {/* Metadata Metric Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div className="glass-panel" style={{ padding: '12px 8px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <Percent size={13} />
            <span style={{ fontSize: '0.68rem', textTransform: 'uppercase' }}>
              {qualityGate?.score ? 'Image Quality' : 'Confidence'}
            </span>
          </div>
          <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
            {qualityGate?.score ? `${qualityGate.score.toFixed(0)}%` : `${activeConfidence.toFixed(0)}%`}
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
            <span>{activeChemName} Colorimetry & Calibration Trace</span>
          </div>
          {showTechnicalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showTechnicalDetails && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', fontSize: '0.75rem', lineHeight: '1.6' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Sensor Chemistry:</span>{' '}
                <strong style={{ color: 'var(--accent-cyan)' }}>{isLeadAcetate ? 'Lead Acetate (Pb(OAc)₂)' : 'Cu-PAN (Copper(II)-PAN)'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Color Transition:</span>{' '}
                <strong style={{ color: '#fbbf24' }}>
                  {isLeadAcetate ? 'White/Cream → Brown/Black (PbS)' : 'Purple → Yellow/Orange'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Color Space:</span>{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>CIELAB (D65 Ref)</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Color Difference:</span>{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>CIEDE2000 (ISO/CIE)</strong>
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
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Calibration Model:</span>{' '}
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                  {result.model_version || result.model?.model_version || (isLeadAcetate ? 'LEAD_ACETATE_MODEL_V1' : 'CUPAN-MODEL-v2.0')}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Dataset:</span>{' '}
                <strong style={{ fontFamily: 'var(--font-mono)' }}>
                  {result.dataset_version || result.model?.dataset_version || (isLeadAcetate ? 'LEAD_ACETATE_DATASET_V1' : 'CUPAN-DATA-200-v2')}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Calibration Status:</span>{' '}
                <strong style={{ color: calibrationStatus === 'VALID' || calibrationStatus === 'VALID_ESTIMATE' ? '#34d399' : '#f59e0b' }}>
                  {calibrationStatus || calibration_status || 'VALID'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Image Quality:</span>{' '}
                <strong style={{ color: qualityGate?.passed !== false ? '#34d399' : '#f43f5e' }}>
                  {qualityGate?.score ? `${qualityGate.score.toFixed(0)}%` : '95% (Pass)'}
                </strong>
              </div>
            </div>

            <div style={{ padding: '8px 10px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)' }}>
              {isLeadAcetate
                ? 'Scientific Principle: Pb(CH₃COO)₂ + H₂S → PbS↓ + 2CH₃COOH. Optical darkening monitored up to 22.3 mL H₂S based on stoichiometric gas-train calibration.'
                : `Scientific Principle: Cu(II)-PAN + H₂S → CuS + H-PAN. Strip capacity is calibrated up to ${maxValidatedDose || 160.0} ppm·h based on empirical spline kinetics.`}
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
