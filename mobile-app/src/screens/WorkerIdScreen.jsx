import React, { useState, useEffect } from 'react';
import { User, Calendar, ShieldCheck, ArrowRight, Activity, Users, AlertTriangle } from 'lucide-react';
import { getWorkers, getWorkerCumulativeDose } from '../services/api';

/**
 * Generate formatted Shift ID based on current local date and shift letter
 */
function getTodayShiftId(shiftLetter = 'A') {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}-${shiftLetter}`;
}

export default function WorkerIdScreen({ onProceed, initialWorkerId = '', initialShiftId = '' }) {
  const [workerId, setWorkerId] = useState(initialWorkerId || 'W1023');
  const [shiftLetter, setShiftLetter] = useState('A');
  const [customShiftId, setCustomShiftId] = useState(initialShiftId || getTodayShiftId('A'));
  const [isCustomShift, setIsCustomShift] = useState(false);

  const [workersList, setWorkersList] = useState([]);
  const [matchedWorker, setMatchedWorker] = useState(null);
  const [doseInfo, setDoseInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch registered workers list
  useEffect(() => {
    async function loadWorkers() {
      try {
        const list = await getWorkers();
        setWorkersList(list || []);
      } catch (err) {
        console.warn('Could not load workers list from backend:', err);
      }
    }
    loadWorkers();
  }, []);

  // Update matched worker and fetch cumulative dose whenever workerId changes
  useEffect(() => {
    const trimmed = workerId.trim().toUpperCase();
    const found = workersList.find((w) => w.workerId.toUpperCase() === trimmed);
    setMatchedWorker(found || null);

    if (trimmed) {
      getWorkerCumulativeDose(trimmed)
        .then((res) => setDoseInfo(res))
        .catch(() => setDoseInfo(null));
    } else {
      setDoseInfo(null);
    }
  }, [workerId, workersList]);

  // Handle shift letter selection
  const handleSelectShift = (letter) => {
    setShiftLetter(letter);
    setIsCustomShift(false);
    setCustomShiftId(getTodayShiftId(letter));
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!workerId.trim()) {
      setError('Please enter or select a Worker ID');
      return;
    }
    const finalShiftId = isCustomShift ? customShiftId.trim() : getTodayShiftId(shiftLetter);
    if (!finalShiftId) {
      setError('Please enter a valid Shift ID');
      return;
    }

    setError('');
    onProceed({
      workerId: workerId.trim().toUpperCase(),
      workerName: matchedWorker?.name || 'Worker',
      department: matchedWorker?.department || 'Operations',
      shiftId: finalShiftId
    });
  };

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '100%' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(6, 182, 212, 0.12)',
            padding: '6px 14px',
            borderRadius: '9999px',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            marginBottom: '12px'
          }}
        >
          <ShieldCheck size={16} color="#06b6d4" />
          <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#38bdf8', letterSpacing: '0.04em' }}>
            DGMS / OISD FIELD DOSIMETRY
          </span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#f8fafc' }}>
          End-of-Shift Scan
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
          Photograph worker wristband to record cumulative H₂S exposure dose
        </p>
      </div>

      <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Worker ID Section */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
            WORKER IDENTIFICATION
          </label>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. W1023"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value.toUpperCase())}
              style={{ fontSize: '1.1rem', fontWeight: '700', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}
              required
            />
            <User
              size={20}
              color="#94a3b8"
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>

          {/* Quick Worker Selector Chips */}
          {workersList.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                Quick Select Active Worker:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {workersList.map((w) => (
                  <button
                    key={w.workerId}
                    type="button"
                    onClick={() => setWorkerId(w.workerId)}
                    style={{
                      background: workerId === w.workerId ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      border: workerId === w.workerId ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: workerId === w.workerId ? '#38bdf8' : '#cbd5e1',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {w.workerId} ({w.name.split(' ')[0]})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matched Worker Details Badge */}
          {matchedWorker && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 12px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <strong style={{ fontSize: '0.9rem', color: '#f8fafc', display: 'block' }}>{matchedWorker.name}</strong>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{matchedWorker.department}</span>
              </div>
              <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>VERIFIED</span>
            </div>
          )}

          {/* Past Exposure Summary Pill */}
          {doseInfo && (
            <div
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                background: doseInfo.overThreshold ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                border: `1px solid ${doseInfo.overThreshold ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={15} color={doseInfo.overThreshold ? '#fb7185' : '#34d399'} />
                <span style={{ fontSize: '0.75rem', color: doseInfo.overThreshold ? '#fecdd3' : '#a7f3d0' }}>
                  Cumulative: <strong>{doseInfo.totalDosePpmHours} ppm·h</strong> ({doseInfo.readingCount} shifts)
                </span>
              </div>
              {doseInfo.overThreshold && (
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#fb7185' }}>
                  OVER 80 LIMIT
                </span>
              )}
            </div>
          )}
        </div>

        {/* Shift Selection Section */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#94a3b8' }}>
              SHIFT CODE
            </label>
            <button
              type="button"
              onClick={() => setIsCustomShift(!isCustomShift)}
              style={{
                background: 'none',
                border: 'none',
                color: '#06b6d4',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isCustomShift ? 'Use Preset' : 'Custom Code'}
            </button>
          </div>

          {!isCustomShift ? (
            <div>
              {/* Shift Letter Toggle Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                {[
                  { letter: 'A', label: 'Shift A', time: '06:00 - 14:00' },
                  { letter: 'B', label: 'Shift B', time: '14:00 - 22:00' },
                  { letter: 'C', label: 'Shift C', time: '22:00 - 06:00' }
                ].map((s) => (
                  <button
                    key={s.letter}
                    type="button"
                    onClick={() => handleSelectShift(s.letter)}
                    style={{
                      background: shiftLetter === s.letter ? 'linear-gradient(135deg, #0284c7, #06b6d4)' : 'rgba(15, 23, 42, 0.7)',
                      border: shiftLetter === s.letter ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      padding: '10px 6px',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{s.label}</div>
                    <div style={{ fontSize: '0.65rem', color: shiftLetter === s.letter ? '#e0f2fe' : '#94a3b8', marginTop: '2px' }}>
                      {s.time}
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="#94a3b8" />
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Generated ID:</span>
                <strong style={{ fontSize: '0.9rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  {getTodayShiftId(shiftLetter)}
                </strong>
              </div>
            </div>
          ) : (
            <input
              type="text"
              className="input-field"
              placeholder="e.g. 2026-08-31-A"
              value={customShiftId}
              onChange={(e) => setCustomShiftId(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}
            />
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fb7185', fontSize: '0.82rem', padding: '8px 12px', background: 'rgba(244,63,94,0.1)', borderRadius: '8px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="btn-primary"
          style={{ marginTop: '8px' }}
        >
          <span>Proceed to Scan Wristband</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
