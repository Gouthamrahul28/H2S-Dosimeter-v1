import React, { useState } from 'react';
import {
  X,
  FlaskConical,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { addCalibrationData, approvePendingCalibrationData } from '../services/api';

export default function AddCalibrationDataModal({ isOpen, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'batch'
  const [formData, setFormData] = useState({
    sample_id: '',
    dose_ppm_h: '',
    h2s_ppm: '',
    exposure_minutes: '60',
    temperature_c: '25.0',
    humidity_percent: '50.0',
    L: '47.30',
    a: '31.20',
    b: '-11.50',
    delta_e00: '11.20',
    strip_batch: 'CUPAN-BATCH-002',
    notes: 'Chamber validation run'
  });

  const [batchText, setBatchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const sample = {
        sample_id: formData.sample_id || `REAL_LAB_${Date.now()}`,
        chemistry: 'Cu-PAN',
        strip_batch: formData.strip_batch,
        dose_ppm_h: parseFloat(formData.dose_ppm_h),
        h2s_ppm: parseFloat(formData.h2s_ppm || formData.dose_ppm_h),
        exposure_minutes: parseFloat(formData.exposure_minutes || 60),
        temperature_c: parseFloat(formData.temperature_c),
        humidity_percent: parseFloat(formData.humidity_percent),
        L: parseFloat(formData.L),
        a: parseFloat(formData.a),
        b: parseFloat(formData.b),
        delta_e00: parseFloat(formData.delta_e00),
        source: 'REAL',
        notes: formData.notes
      };

      const res = await addCalibrationData(sample);
      if (res.success && res.accepted_count > 0) {
        // Automatically approve and merge into cumulative master dataset
        const approveRes = await approvePendingCalibrationData();
        setFeedback({
          type: 'success',
          message: `Sample validated & merged into ${approveRes.new_dataset_version}! Cumulative Real Samples: ${approveRes.cumulative_sample_count}`
        });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1600);
      } else {
        setFeedback({
          type: 'error',
          message: `Sample rejected: ${res.rejected_samples?.[0]?.errors?.join(', ') || 'Validation error'}`
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error submitting sample' });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      // Parse CSV / JSON
      let samples = [];
      if (batchText.trim().startsWith('[')) {
        samples = JSON.parse(batchText);
      } else {
        // Simple CSV parse
        const lines = batchText.trim().split('\n');
        lines.forEach((line, idx) => {
          if (idx === 0 && line.toLowerCase().includes('dose')) return; // Header
          const parts = line.split(',').map((p) => p.trim());
          if (parts.length >= 7) {
            samples.push({
              sample_id: parts[0] || `REAL_BATCH_${Date.now()}_${idx}`,
              chemistry: 'Cu-PAN',
              dose_ppm_h: parseFloat(parts[1]),
              temperature_c: parseFloat(parts[2] || 25),
              humidity_percent: parseFloat(parts[3] || 50),
              L: parseFloat(parts[4]),
              a: parseFloat(parts[5]),
              b: parseFloat(parts[6]),
              delta_e00: parseFloat(parts[7] || 10),
              source: 'REAL'
            });
          }
        });
      }

      if (samples.length === 0) {
        throw new Error('No valid samples parsed from input');
      }

      const res = await addCalibrationData(samples);
      if (res.success && res.accepted_count > 0) {
        const approveRes = await approvePendingCalibrationData();
        setFeedback({
          type: 'success',
          message: `Approved ${res.accepted_count} samples (${res.rejected_count} rejected). Master now has ${approveRes.cumulative_sample_count} real samples.`
        });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1800);
      } else {
        setFeedback({
          type: 'error',
          message: `All ${samples.length} samples were rejected during validation checks.`
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error parsing batch data' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          position: 'relative'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FlaskConical size={20} color="var(--accent-cyan)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Add Real Calibration Data
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Ingests laboratory chamber measurements into the cumulative Master Dataset
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '6px' }}>
          <button
            onClick={() => setActiveTab('single')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '0.8rem',
              fontWeight: '700',
              borderRadius: '4px',
              border: 'none',
              background: activeTab === 'single' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'single' ? '#000' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Single Sample Form
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '0.8rem',
              fontWeight: '700',
              borderRadius: '4px',
              border: 'none',
              background: activeTab === 'batch' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'batch' ? '#000' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Batch CSV / JSON Upload
          </button>
        </div>

        {/* Quality Banner */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '16px',
            fontSize: '0.75rem',
            color: '#34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShieldCheck size={16} />
          <span>Only validated experimental samples with confirmed Cu-PAN chemistry will enter the Master Dataset.</span>
        </div>

        {/* Form Body */}
        {activeTab === 'single' ? (
          <form onSubmit={handleSingleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Sample ID (Optional)</label>
                <input
                  type="text"
                  name="sample_id"
                  placeholder="e.g. REAL_CHAMBER_251"
                  value={formData.sample_id}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Cu-PAN Batch</label>
                <input
                  type="text"
                  name="strip_batch"
                  value={formData.strip_batch}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Dose (ppm·h) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  name="dose_ppm_h"
                  placeholder="e.g. 15.0"
                  value={formData.dose_ppm_h}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Temp (°C) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  name="temperature_c"
                  value={formData.temperature_c}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Humidity (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  name="humidity_percent"
                  value={formData.humidity_percent}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>L* *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  name="L"
                  value={formData.L}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>a* *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  name="a"
                  value={formData.a}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>b* *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  name="b"
                  value={formData.b}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
              <div>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>ΔE₀₀ *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  name="delta_e00"
                  value={formData.delta_e00}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>
            </div>

            {feedback && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: feedback.type === 'success' ? '#34d399' : '#f87171',
                  border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                {feedback.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '10px' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 2, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Plus size={16} />
                <span>{loading ? 'Validating & Merging...' : 'Add to Master Dataset'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="input-label" style={{ fontSize: '0.75rem' }}>Paste CSV lines (sample_id, dose, temp, rh, L, a, b, deltaE)</label>
              <textarea
                rows={6}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder="REAL_251, 15.0, 25.0, 50.0, 53.20, 25.40, 5.80, 21.30&#10;REAL_252, 25.0, 25.0, 50.0, 57.10, 21.80, 16.50, 32.40"
                className="input-control"
                style={{ fontFamily: 'monospace', fontSize: '0.75rem', width: '100%' }}
              />
            </div>

            {feedback && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: feedback.type === 'success' ? '#34d399' : '#f87171',
                  border: feedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                {feedback.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '10px' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 2, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Upload size={16} />
                <span>{loading ? 'Validating Batch...' : 'Validate & Ingest Batch'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
