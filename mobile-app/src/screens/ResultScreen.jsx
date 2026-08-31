import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Layers,
  ChevronRight,
  Sun,
  Droplet
} from 'lucide-react';

/**
 * Helper to convert {r, g, b} to CSS rgb string and hex code
 */
function toRgbString(rgb) {
  if (!rgb) return 'rgb(128, 128, 128)';
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function toHex(rgb) {
  if (!rgb) return '#808080';
  const r = Math.min(255, Math.max(0, rgb.r)).toString(16).padStart(2, '0');
  const g = Math.min(255, Math.max(0, rgb.g)).toString(16).padStart(2, '0');
  const b = Math.min(255, Math.max(0, rgb.b)).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

export default function ResultScreen({ result, workerData, onRetryCapture, onNextWorker }) {
  if (!result) return null;

  const {
    readingId,
    workerId,
    shiftId,
    stripColorRGB,
    referenceColorRGB,
    correctedColorRGB,
    expiryPatchStatus,
    estimatedDosePpmHours,
    calibrationCurveVersion,
    createdAt
  } = result;

  const isOverThreshold = estimatedDosePpmHours > 40.0; // High shift exposure alert
  const isExpired = expiryPatchStatus === 'expired';
  const isUnreadable = expiryPatchStatus === 'unreadable';

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#06b6d4', letterSpacing: '0.05em' }}>
            READING LOGGED
          </span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f8fafc' }}>
            Shift Exposure Summary
          </h2>
        </div>
        <span className="badge badge-cyan" style={{ fontFamily: 'var(--font-mono)' }}>
          {calibrationCurveVersion || 'v1'}
        </span>
      </div>

      {/* Hero Dose Metric Card */}
      <div
        className="glass-panel"
        style={{
          padding: '20px',
          textAlign: 'center',
          border: isOverThreshold ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
          background: isOverThreshold
            ? 'radial-gradient(circle at 50% 0%, rgba(244, 63, 94, 0.15) 0%, rgba(26, 36, 58, 0.85) 100%)'
            : 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.15) 0%, rgba(26, 36, 58, 0.85) 100%)'
        }}
      >
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Estimated Shift Exposure
        </span>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px', margin: '8px 0' }}>
          <span
            style={{
              fontSize: '3.2rem',
              fontWeight: '900',
              fontFamily: 'var(--font-main)',
              color: isOverThreshold ? '#fb7185' : '#34d399',
              letterSpacing: '-0.03em',
              lineHeight: 1
            }}
          >
            {estimatedDosePpmHours}
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#94a3b8' }}>
            ppm·hours
          </span>
        </div>

        {/* Threshold Status Banner */}
        {isOverThreshold ? (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#fecdd3'
            }}
          >
            <ShieldAlert size={18} color="#fb7185" />
            <span style={{ fontSize: '0.82rem', fontWeight: '600' }}>
              High Exposure Alert — Notify Safety Supervisor
            </span>
          </div>
        ) : (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#a7f3d0'
            }}
          >
            <ShieldCheck size={18} color="#34d399" />
            <span style={{ fontSize: '0.82rem', fontWeight: '600' }}>
              Within Standard Permissible Shift Limit
            </span>
          </div>
        )}
      </div>

      {/* Expiry Patch Status Card */}
      <div className="glass-panel" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>
              Wristband Shelf-Life Status
            </span>
            <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>
              Chemical Expiry Patch
            </strong>
          </div>

          <div>
            {expiryPatchStatus === 'valid' && (
              <span className="badge badge-valid">
                <CheckCircle2 size={13} /> Valid / Active
              </span>
            )}
            {expiryPatchStatus === 'expired' && (
              <span className="badge badge-expired">
                <XCircle size={13} /> Expired Patch
              </span>
            )}
            {expiryPatchStatus === 'unreadable' && (
              <span className="badge badge-unreadable">
                <AlertTriangle size={13} /> Unreadable
              </span>
            )}
          </div>
        </div>

        {isUnreadable && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#fbbf24', background: 'rgba(245,158,11,0.1)', padding: '8px', borderRadius: '6px' }}>
            Warning: The expiry patch could not be read clearly due to lighting or alignment. Please retake the photo.
          </div>
        )}

        {isExpired && (
          <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#fb7185', background: 'rgba(244,63,94,0.1)', padding: '8px', borderRadius: '6px' }}>
            Action Required: This wristband is past its shelf life. Issue a replacement dosimeter before next shift.
          </div>
        )}
      </div>

      {/* Optical Color Normalization Matrix */}
      <div className="glass-panel" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Layers size={16} color="#06b6d4" />
          <strong style={{ fontSize: '0.85rem', color: '#f8fafc', letterSpacing: '0.02em' }}>
            COLOR EXTRACTION & CORRECTION
          </strong>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {/* Reference Patch */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Reference</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: toRgbString(referenceColorRGB),
                margin: '0 auto 6px auto',
                border: '2px solid rgba(255,255,255,0.3)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
              }}
            />
            <div style={{ fontSize: '0.7rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
              {toHex(referenceColorRGB)}
            </div>
          </div>

          {/* Raw Strip */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Raw Strip</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: toRgbString(stripColorRGB),
                margin: '0 auto 6px auto',
                border: '2px solid rgba(255,255,255,0.3)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
              }}
            />
            <div style={{ fontSize: '0.7rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#f8fafc' }}>
              {toHex(stripColorRGB)}
            </div>
          </div>

          {/* Corrected Strip */}
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
            <span style={{ fontSize: '0.7rem', color: '#38bdf8', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Corrected</span>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: toRgbString(correctedColorRGB),
                margin: '0 auto 6px auto',
                border: '2px solid #06b6d4',
                boxShadow: '0 0 10px rgba(6, 182, 212, 0.5)'
              }}
            />
            <div style={{ fontSize: '0.7rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
              {toHex(correctedColorRGB)}
            </div>
          </div>
        </div>
      </div>

      {/* Reading Metadata Audit Card */}
      <div className="glass-panel" style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#94a3b8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span>Worker ID:</span>
          <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{workerId}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span>Shift ID:</span>
          <strong style={{ color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>{shiftId}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span>Reading Ref ID:</span>
          <span style={{ color: '#64748b', fontFamily: 'var(--font-mono)' }}>{readingId?.slice(-8) || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Timestamp:</span>
          <span>{new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
        <button
          className="btn-primary"
          onClick={onNextWorker}
        >
          <UserPlus size={18} />
          <span>Scan Next Worker</span>
        </button>

        <button
          className="btn-secondary"
          onClick={onRetryCapture}
        >
          <RotateCcw size={16} />
          <span>Retake Photo for This Shift</span>
        </button>
      </div>
    </div>
  );
}
