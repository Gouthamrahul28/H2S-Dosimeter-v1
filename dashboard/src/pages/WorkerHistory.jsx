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
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';
import ExposureChart from '../components/ExposureChart';
import ThresholdBadge from '../components/ThresholdBadge';
import LightCorrectionPanel from '../components/LightCorrectionPanel';
import CalculationTraceCard from '../components/CalculationTraceCard';
import CuPanReferenceScale from '../components/CuPanReferenceScale';
import StripInfoCard from '../components/StripInfoCard';
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
  const [selectedReadingIndex, setSelectedReadingIndex] = useState(0);

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
      setSelectedReadingIndex(0);
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

  const activeReading = readings[selectedReadingIndex] || null;

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
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Worker Exposure Dosimetry Log
            </h1>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Shift-by-shift photometric analysis & exposure accumulation (Cu-PAN Chemistry)
            </span>
          </div>
        </div>

        {/* Worker Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Select Worker:</span>
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
                  background: isOver ? 'rgba(244, 63, 94, 0.15)' : 'rgba(6, 182, 212, 0.12)',
                  border: isOver ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(6, 182, 212, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isOver ? 'var(--accent-rose)' : 'var(--accent-cyan)',
                  fontWeight: '800',
                  fontSize: '1.1rem',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {selectedWorkerId}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {currentWorker.name}
                </h2>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {currentWorker.department}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                {readings.length} Shifts Monitored
              </span>
              <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(124, 58, 237, 0.15)', color: '#c084fc', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
                Cu-PAN Strip
              </span>
            </div>
          </div>

          {/* Cumulative Dose Metric */}
          <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '20px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Cumulative Shift Exposure
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0' }}>
              <span
                style={{
                  fontSize: '2.2rem',
                  fontWeight: '900',
                  fontFamily: 'var(--font-mono)',
                  color: isOver ? 'var(--accent-rose)' : percent >= 75 ? 'var(--accent-amber)' : 'var(--accent-cyan)'
                }}
              >
                {totalDose.toFixed(1)}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                / {threshold} ppm·h
              </span>
            </div>

            {/* Threshold progress bar */}
            <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
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

      {/* Reference Scale & Strip Info */}
      <CuPanReferenceScale />
      <StripInfoCard batchData={{ batchId: activeReading?.stripBatch || 'CUPAN-001' }} />

      {/* Interactive Trend Chart */}
      <ExposureChart readings={readings} threshold={threshold} />

      {/* Selected Reading Deep-Dive Panel */}
      {activeReading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Inspecting Shift {activeReading.shiftId} ({new Date(activeReading.capturedAt || activeReading.createdAt).toLocaleDateString()})
            </h3>
          </div>
          <LightCorrectionPanel
            readingData={activeReading}
            rawStripRGB={activeReading.stripColorRGB}
            rawWhiteRGB={activeReading.referenceColorRGB}
            correctionStatus="APPLIED"
          />
          <CalculationTraceCard
            readingData={activeReading}
            rawStripRGB={activeReading.stripColorRGB}
            rawWhiteRGB={activeReading.referenceColorRGB}
            tempC={activeReading.ambientTemp || 25.0}
            rhPct={activeReading.ambientHumidity || 50.0}
          />
        </div>
      )}

      {/* Detailed Reading History Table */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Reading-by-Reading Audit Trail
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Click any shift row to inspect its exact Light Correction & Optical Calculation Trace
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
                <th style={{ textAlign: 'center' }}>Calibration Status</th>
                <th style={{ textAlign: 'right' }}>Shift Dose (ppm·h)</th>
                <th style={{ textAlign: 'center' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {readings.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No readings logged for this worker yet.
                  </td>
                </tr>
              ) : (
                readings.map((r, i) => {
                  const isSelected = selectedReadingIndex === i;
                  return (
                    <tr
                      key={r.readingId || i}
                      onClick={() => setSelectedReadingIndex(i)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'transparent'
                      }}
                    >
                      {/* Shift ID */}
                      <td>
                        <strong style={{ fontFamily: 'var(--font-mono)', color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                          {r.shiftId}
                        </strong>
                      </td>

                      {/* Timestamp */}
                      <td>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {new Date(r.capturedAt || r.createdAt).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(r.capturedAt || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Ambient Env */}
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                              border: '1px solid var(--border-subtle)'
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
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
                              border: '1px solid var(--border-subtle)'
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
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
                              border: '1.5px solid var(--accent-cyan)',
                              boxShadow: '0 0 6px rgba(6,182,212,0.4)'
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                            {toHex(r.correctedColorRGB)}
                          </span>
                        </div>
                      </td>

                      {/* Calibration Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: '600' }}>
                          ● Valid (Cu-PAN)
                        </span>
                      </td>

                      {/* Shift Dose */}
                      <td style={{ textAlign: 'right' }}>
                        <strong
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.9rem',
                            color: (r.estimatedDosePpmHours || r.dose || 0) > 20 ? 'var(--accent-rose)' : 'var(--text-primary)'
                          }}
                        >
                          {(r.estimatedDosePpmHours || r.dose || 0).toFixed(1)}
                        </strong>
                      </td>

                      {/* Inspect Action */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReadingIndex(i);
                          }}
                          className={isSelected ? 'btn-primary' : 'btn-secondary'}
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        >
                          <Eye size={12} /> {isSelected ? 'Viewing' : 'Inspect'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
