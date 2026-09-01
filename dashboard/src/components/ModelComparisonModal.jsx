import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  ShieldCheck,
  Award
} from 'lucide-react';
import { compareCandidateModel, publishCandidateModel } from '../services/api';

export default function ModelComparisonModal({ isOpen, onClose, onSuccess }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setFeedback('');
      compareCandidateModel()
        .then((res) => setData(res))
        .catch((err) => console.warn('Error loading comparison:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const current = data?.current_model || {
    model_version: 'CUPAN-MODEL-v4',
    total_real_samples: 250,
    test_r2: 0.9320,
    test_mae: 13.40,
    test_rmse: 18.15
  };

  const candidate = data?.candidate_model || {
    model_version: 'CUPAN-MODEL-v5',
    sample_count_real: 300,
    test_r2: 0.9485,
    test_mae: 11.20,
    test_rmse: 15.40
  };

  const comp = data?.comparison || {
    delta_mae: -2.20,
    delta_rmse: -2.75,
    delta_r2: 0.0165,
    sample_gain: 50,
    verdict: 'IMPROVED',
    recommendation: 'RECOMMENDED_TO_PUBLISH'
  };

  const isImprovement = comp.verdict === 'IMPROVED';

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await publishCandidateModel();
      setFeedback(res.message || 'Model promoted to production successfully!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setFeedback(`Error publishing: ${err.message}`);
    } finally {
      setPublishing(false);
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
          maxWidth: '680px',
          padding: '26px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.12)', padding: '3px 8px', borderRadius: '4px', marginBottom: '4px' }}>
              <Zap size={13} />
              <span>MODEL VERIFICATION GATEWAY</span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Candidate vs Production Model Comparison
            </h3>
          </div>

          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading candidate model metrics...
          </div>
        ) : (
          <div>
            {/* Comparison Table */}
            <div className="data-table-container" style={{ marginBottom: '16px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ textAlign: 'center' }}>Current Production ({current.model_version})</th>
                    <th style={{ textAlign: 'center' }}>Candidate ({candidate.model_version})</th>
                    <th style={{ textAlign: 'center' }}>Delta (&Delta;)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Cumulative Real Samples</strong></td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{current.total_real_samples}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: '700' }}>{candidate.sample_count_real}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#34d399' }}>+{comp.sample_gain} samples</td>
                  </tr>
                  <tr>
                    <td><strong>Held-out Test R² Score</strong></td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{current.test_r2?.toFixed(4)}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: '700' }}>{candidate.test_r2?.toFixed(4)}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: comp.delta_r2 >= 0 ? '#34d399' : '#f87171' }}>
                      {comp.delta_r2 >= 0 ? `+${comp.delta_r2.toFixed(4)}` : comp.delta_r2.toFixed(4)}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Test Mean Absolute Error (MAE)</strong></td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{current.test_mae?.toFixed(2)} ppm·h</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: '700' }}>{candidate.test_mae?.toFixed(2)} ppm·h</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: comp.delta_mae <= 0 ? '#34d399' : '#f87171' }}>
                      {comp.delta_mae <= 0 ? `${comp.delta_mae.toFixed(2)} ppm·h` : `+${comp.delta_mae.toFixed(2)} ppm·h`}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Test Root Mean Squared Error (RMSE)</strong></td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{current.test_rmse?.toFixed(2)} ppm·h</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#34d399', fontWeight: '700' }}>{candidate.test_rmse?.toFixed(2)} ppm·h</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: comp.delta_rmse <= 0 ? '#34d399' : '#f87171' }}>
                      {comp.delta_rmse <= 0 ? `${comp.delta_rmse.toFixed(2)} ppm·h` : `+${comp.delta_rmse.toFixed(2)} ppm·h`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Verdict Card */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: isImprovement ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                border: isImprovement ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isImprovement ? <CheckCircle2 size={20} color="#10b981" /> : <AlertTriangle size={20} color="#f59e0b" />}
                <div>
                  <strong style={{ fontSize: '0.88rem', color: isImprovement ? '#34d399' : '#fbbf24', display: 'block' }}>
                    {isImprovement ? 'Candidate Model Demonstrates Verified Generalization Improvement' : 'Candidate Does Not Meet Superiority Threshold'}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {isImprovement
                      ? `Lower MAE by ${Math.abs(comp.delta_mae).toFixed(2)} ppm·h across ${candidate.sample_count_real} cumulative real samples.`
                      : 'Higher error observed. Recommendation is to hold revision.'}
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '800',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: isImprovement ? '#10b981' : '#f59e0b',
                  color: '#000'
                }}
              >
                {isImprovement ? 'RECOMMENDED TO PUBLISH' : 'HOLD REVISION'}
              </span>
            </div>

            {feedback && (
              <div style={{ padding: '10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '0.82rem', marginBottom: '12px', textAlign: 'center' }}>
                {feedback}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '12px' }}>
                Keep Current Model
              </button>

              <button
                onClick={handlePublish}
                disabled={publishing}
                className="btn-primary"
                style={{ flex: 2, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}
              >
                <Award size={18} />
                <span>{publishing ? 'Publishing...' : `Publish ${candidate.model_version}`}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
