import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  Activity,
  Calendar,
  Layers,
  Thermometer,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import ExposureChart from '../components/ExposureChart';
import ThresholdBadge from '../components/ThresholdBadge';
import { getWorkers, getWorkerReadings, getWorkerCumulativeDose } from '../services/api';

function toRgbString(rgb) {
  if (!rgb) return 'rgb(128,128,128)';
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function toHex(rgb) {
  if (!rgb) return '#808080';
  const r = Math.min(255, Math.max(0, rgb.r)).toString(16).padStart(2, '0');
  const g = Math.min(255, Math.max(0, rgb.g)).toString(16).padStart(2, '0');
  const b = Math.min(255, Math.max(0, rgb.b)).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

export default function WorkerHistory({ initialWorkerId = 'W1023', onBack }) {
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(initialWorkerId);
  const [readings, setReadings] = useState([]);
  const [cumulativeInfo, setCumulativeInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load worker list
  useEffect(() => {
    getWorkers().then((res) => setWorkers(res || [])).catch(console.error);
  }, []);

  // Load readings for selected worker
  const loadWorkerData = async (wId) => {
    setLoading(true);
    try {
      const [readingsData, cumulativeData] = await Promise.all([
        getWorkerReadings(wId),
        getWorkerCumulativeDose(wId)
      ]);
      setReadings(readingsData || []);
      setCumulativeInfo(cumulativeData || null);
    } catch (err) {
      console.error('Error loading worker history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWorkerId) {
      loadWorkerData(selectedWorkerId);
    }
  }, [selectedWorkerId]);

  const currentWorker = workers.find((w) => w.workerId === selectedWorkerId) || {
    workerId: selectedWorkerId,
    name: 'Worker',
    department: 'Operations'
  };

  const totalDose = cumulativeInfo?.totalDosePpmHours || 0;
  const threshold = cumulativeInfo?.thresholdPpmHours || 80;
  const isOver = cumulativeInfo?.overThreshold;
  const percent = Math.min(100, Math.round((totalDose / threshold) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Worker Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            <ArrowLeft size={16} /> Overview
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#f8fafc' }}>
              Worker Exposure Dosimetry Log
            </h1>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Shift-by-shift photometric analysis & exposure accumulation
            </span>
          </div>
        </div>

        {/* Worker Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={16} color="#94a3b8" />
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Select Worker:</span>
          <select
            className="input-control"
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: '600' }}
          >
            {workers.map((w) => (
              <option key={w.workerId} value={w.workerId}>
                {w.workerId} &mdash; {w.name} ({w.department})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Worker Profile & Exposure Summary Header Card */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', alignItems: 'center' }}>
          {/* Worker Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: isOver ? 'rgba(244, 63, 94, 0.2)' : 'rgba(6, 182, 212, 0.15)',
                  border: isOver ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(6, 182, 212, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isOver ? '#fb7185' : '#38bdf8',
                  fontWeight: '800',
                  fontSize: '1.1rem',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {selectedWorkerId}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f8fafc' }}>
                  {currentWorker.name}
                </h2>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  {currentWorker.department}
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Logged Shifts: <strong style={{ color: '#cbd5e1' }}>{readings.length}</strong>
            </span>
          </div>

          {/* Cumulative Dose Metric */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Cumulative Total Dose
              </span>
              <ThresholdBadge
                totalDosePpmHours={totalDose}
                thresholdPpmHours={threshold}
                overThreshold={isOver}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span
                style={{
                  fontSize: '2.2rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-mono)',
                  color: isOver ? '#fb7185' : percent >= 75 ? '#fbbf24' : '#38bdf8'
                }}
              >
                {totalDose.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                / {threshold} ppm·h
              </span>
            </div>

            {/* Threshold progress bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  background: isOver ? '#f43f5e' : percent >= 75 ? '#f59e0b' : '#06b6d4',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Trend Chart */}
      <ExposureChart readings={readings} threshold={threshold} />

      {/* Detailed Reading History Table */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc' }}>
              Reading-by-Reading Audit Trail
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Individual optical patch extractions, lighting normalization & shift doses
            </span>
          </div>

          <button
            onClick={() => loadWorkerData(selectedWorkerId)}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Reload</span>
          </button>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shift ID</th>
                <th>Captured At</th>
                <th>Ambient Env</th>
                <th>Reference Patch</th>
                <th>Raw Strip</th>
                <th>Corrected RGB</th>
                <th style={{ textAlign: 'center' }}>Expiry Status</th>
                <th style={{ textAlign: 'right' }}>Shift Dose (ppm·h)</th>
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No readings logged for this worker yet.
                  </td>
                </tr>
              ) : (
                readings.map((r, i) => (
                  <tr key={r.readingId || i}>
                    {/* Shift ID */}
                    <td>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {r.shiftId}
                      </strong>
                    </td>

                    {/* Timestamp */}
                    <td>
                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                        {new Date(r.capturedAt || r.createdAt).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {new Date(r.capturedAt || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Ambient Env */}
                    <td>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{r.ambientTemp || 25}°C</span>
                        <span>&bull;</span>
                        <span>{r.ambientHumidity || 50}% RH</span>
                      </div>
                    </td>

                    {/* Reference Patch */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: toRgbString(r.referenceColorRGB),
                            border: '1px solid rgba(255,255,255,0.3)'
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                          {toHex(r.referenceColorRGB)}
                        </span>
                      </div>
                    </td>

                    {/* Raw Strip */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: toRgbString(r.stripColorRGB),
                            border: '1px solid rgba(255,255,255,0.3)'
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                          {toHex(r.stripColorRGB)}
                        </span>
                      </div>
                    </td>

                    {/* Corrected RGB */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: toRgbString(r.correctedColorRGB),
                            border: '1.5px solid #06b6d4',
                            boxShadow: '0 0 6px rgba(6,182,212,0.4)'
                          }}
                        />
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: '700' }}>
                          {toHex(r.correctedColorRGB)}
                        </span>
                      </div>
                    </td>

                    {/* Expiry Patch */}
                    <td style={{ textAlign: 'center' }}>
                      {r.expiryPatchStatus === 'valid' && (
                        <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>
                          &bull; Valid
                        </span>
                      )}
                      {r.expiryPatchStatus === 'expired' && (
                        <span style={{ fontSize: '0.75rem', color: '#fb7185', fontWeight: '600' }}>
                          &bull; Expired
                        </span>
                      )}
                      {r.expiryPatchStatus === 'unreadable' && (
                        <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: '600' }}>
                          &bull; Unreadable
                        </span>
                      )}
                    </td>

                    {/* Shift Dose */}
                    <td style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontWeight: '800',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.95rem',
                          color: Number(r.estimatedDosePpmHours) > 35 ? '#fb7185' : '#f8fafc'
                        }}
                      >
                        {Number(r.estimatedDosePpmHours || 0).toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
