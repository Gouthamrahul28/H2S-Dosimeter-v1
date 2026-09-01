import React, { useState } from 'react';
import { QrCode, Layers, CheckCircle2, AlertTriangle, ShieldCheck, X, Sparkles, RefreshCw } from 'lucide-react';
import { activateStrip, replaceStrip } from '../services/api';

/**
 * Strip Activation and Replacement Modal
 * 
 * Allows field technicians to scan / enter a new disposable Cu-PAN strip serial,
 * validate batch integrity with the backend, and reset the active wear life countdown.
 */
export default function StripLifecycleModal({ workerId, currentStrip, isOpen, onClose, onSuccess }) {
  const [stripId, setStripId] = useState('');
  const [batchId, setBatchId] = useState('CUPAN-BATCH-001');
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerateSerial = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const newSerial = `CUPAN-2026-${randomNum}`;
    setStripId(newSerial);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!stripId.trim()) {
      setError('Please scan or enter a Cu-PAN strip identifier.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        workerId,
        stripId: stripId.trim().toUpperCase(),
        batchId: batchId.trim(),
        qrCodePayload: `QR-${stripId.trim().toUpperCase()}`
      };

      const res = currentStrip ? await replaceStrip(payload) : await activateStrip(payload);

      if (res.success) {
        if (onSuccess) onSuccess(res.strip);
        onClose();
      } else {
        setError(res.message || 'Failed to activate strip.');
      }
    } catch (err) {
      setError(err.message || 'Network error during strip activation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px'
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '24px',
          background: 'var(--bg-card-solid)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}
            >
              <QrCode size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                {currentStrip ? 'Replace Cu-PAN Strip' : 'Activate Cu-PAN Strip'}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Worker: <strong style={{ color: 'var(--accent-cyan)' }}>{workerId}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              color: 'var(--accent-rose)',
              fontSize: '0.78rem',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              STRIP IDENTIFIER / QR CODE
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                required
                placeholder="e.g. CUPAN-2026-000123"
                value={stripId}
                onChange={(e) => setStripId(e.target.value)}
                className="input-control"
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                onClick={handleGenerateSerial}
                className="btn-secondary"
                title="Generate new test serial"
                style={{ padding: '8px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
              >
                <Sparkles size={14} /> New
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              BATCH IDENTIFIER
            </label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="input-control"
              style={{ width: '100%', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              <option value="CUPAN-BATCH-001">CUPAN-BATCH-001 (Validated 120h Wear Life)</option>
              <option value="CUPAN-BATCH-002">CUPAN-BATCH-002 (Unvalidated Prototype)</option>
              <option value="CUPAN-BATCH-003-RECALLED">CUPAN-BATCH-003-RECALLED (Recalled)</option>
            </select>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.45
            }}
          >
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
              Lifecycle Rule:
            </strong>
            Activating a new disposable strip archives all historical exposure scans under the previous strip and starts a fresh active wear replacement countdown.
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ flex: 1, padding: '10px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span>{loading ? 'Activating...' : 'Activate Strip'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
