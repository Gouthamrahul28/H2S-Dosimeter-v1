import React, { useState, useEffect } from 'react';
import {
  User,
  Calendar,
  ShieldCheck,
  ArrowRight,
  Activity,
  Users,
  AlertTriangle,
  Layers,
  Clock,
  QrCode,
  Sparkles,
  RefreshCw,
  Ban,
  Camera,
  CheckCircle2,
  XCircle,
  HelpCircle,
  PhoneCall
} from 'lucide-react';
import { getWorkers, getWorkerCumulativeDose, getActiveStrip } from '../services/api';
import StripLifecycleModal from '../components/StripLifecycleModal';

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
  const [activeStripData, setActiveStripData] = useState(null);
  const [countdownSeconds, setCountdownSeconds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [error, setError] = useState('');

  // Fetch registered workers list
  const loadWorkersAndStrip = async () => {
    try {
      const list = await getWorkers();
      setWorkersList(list || []);
    } catch (err) {
      console.warn('Could not load workers list from backend:', err);
    }
  };

  useEffect(() => {
    loadWorkersAndStrip();
  }, []);

  // Update matched worker, active strip, and fetch cumulative dose whenever workerId changes
  useEffect(() => {
    const trimmed = workerId.trim().toUpperCase();
    const found = workersList.find((w) => w.workerId.toUpperCase() === trimmed);
    setMatchedWorker(found || null);

    if (trimmed) {
      // 1. Fetch cumulative dose
      getWorkerCumulativeDose(trimmed)
        .then((res) => setDoseInfo(res))
        .catch(() => setDoseInfo(null));

      // 2. Fetch active strip & replacement countdown
      getActiveStrip(trimmed)
        .then((res) => {
          if (res.success && res.strip) {
            setActiveStripData(res.strip);
            setCountdownSeconds(res.strip.remainingSeconds);
          } else {
            setActiveStripData(null);
            setCountdownSeconds(null);
          }
        })
        .catch(() => {
          setActiveStripData(null);
          setCountdownSeconds(null);
        });
    } else {
      setDoseInfo(null);
      setActiveStripData(null);
      setCountdownSeconds(null);
    }
  }, [workerId, workersList]);

  // Live countdown ticker
  useEffect(() => {
    if (countdownSeconds === null || countdownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownSeconds]);

  // Format countdown string
  const formatCountdown = (secs) => {
    if (secs === null || secs === undefined) return 'LIFETIME NOT YET VALIDATED';
    if (secs <= 0) return 'EXPIRED';

    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${seconds}s`;
    return `${mins}m ${seconds}s`;
  };

  // Compute access control gates
  const isRegistered = !!matchedWorker;
  const isWorkerActive = matchedWorker?.status === 'ACTIVE' || (!matchedWorker?.status && isRegistered);
  const isWorkerBlocked = matchedWorker?.status === 'BLOCKED' || matchedWorker?.status === 'INACTIVE';
  const hasActiveStrip = !!activeStripData && !activeStripData.isExpired && activeStripData.status !== 'RECALLED';
  const isStripExpired = activeStripData?.isExpired || activeStripData?.status === 'EXPIRED';
  const isStripExpiringSoon = activeStripData?.isExpiringSoon || (countdownSeconds !== null && countdownSeconds > 0 && countdownSeconds <= 86400);

  const canScan = isRegistered && isWorkerActive && hasActiveStrip && !isStripExpired;

  const handleNext = (e) => {
    e.preventDefault();
    if (!canScan) return;

    const finalShiftId = isCustomShift ? customShiftId.trim() : getTodayShiftId(shiftLetter);
    setError('');
    onProceed({
      workerId: workerId.trim().toUpperCase(),
      workerName: matchedWorker?.name || 'Worker',
      department: matchedWorker?.department || 'Operations',
      shiftId: finalShiftId,
      assignedStripId: activeStripData?.stripId || 'CUPAN-2026-000123'
    });
  };

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(6, 182, 212, 0.12)',
            padding: '5px 12px',
            borderRadius: '9999px',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            marginBottom: '8px'
          }}
        >
          <ShieldCheck size={15} color="#06b6d4" />
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#38bdf8', letterSpacing: '0.04em' }}>
            SIH26118 • Cu-PAN DOSIMETRY FIELD PWA
          </span>
        </div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '4px 0' }}>
          Worker Field Terminal
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Access-controlled optical scan and disposable Cu-PAN strip replacement lifecycle
        </p>
      </div>

      {/* Critical Three-State Control Separation Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
          fontSize: '0.68rem',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            background: isRegistered ? (isWorkerActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)') : 'rgba(239, 68, 68, 0.15)',
            border: isRegistered ? (isWorkerActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)') : '1px solid rgba(239, 68, 68, 0.3)',
            padding: '6px 4px',
            borderRadius: '6px',
            color: isRegistered ? (isWorkerActive ? '#34d399' : '#f87171') : '#f87171',
            fontWeight: '700'
          }}
        >
          WORKER: {isRegistered ? matchedWorker.status || 'REGISTERED' : 'UNREGISTERED'}
        </div>

        <div
          style={{
            background: hasActiveStrip ? (isStripExpiringSoon ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.12)') : 'rgba(239, 68, 68, 0.15)',
            border: hasActiveStrip ? (isStripExpiringSoon ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)') : '1px solid rgba(239, 68, 68, 0.3)',
            padding: '6px 4px',
            borderRadius: '6px',
            color: hasActiveStrip ? (isStripExpiringSoon ? '#fbbf24' : '#34d399') : '#f87171',
            fontWeight: '700'
          }}
        >
          STRIP: {activeStripData ? activeStripData.status : 'NO STRIP'}
        </div>

        <div
          style={{
            background: 'rgba(2, 132, 199, 0.12)',
            border: '1px solid rgba(2, 132, 199, 0.3)',
            padding: '6px 4px',
            borderRadius: '6px',
            color: '#38bdf8',
            fontWeight: '700'
          }}
        >
          DOSE: {doseInfo ? `${doseInfo.totalDosePpmHours || 0} ppm·h` : '0.0 ppm·h'}
        </div>
      </div>

      <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Worker ID Selector */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            SELECT ACTIVE WORKER
          </label>

          <div style={{ position: 'relative' }}>
            <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              required
              placeholder="Enter Worker ID (e.g. W1023)"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="input-control"
              style={{ width: '100%', paddingLeft: '38px', fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '0.95rem' }}
            />
          </div>

          {/* Quick Picker Chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {workersList.map((w) => (
              <button
                key={w.workerId}
                type="button"
                onClick={() => setWorkerId(w.workerId)}
                style={{
                  background: workerId.toUpperCase() === w.workerId.toUpperCase() ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.05)',
                  color: workerId.toUpperCase() === w.workerId.toUpperCase() ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {w.workerId} ({w.name.split(' ')[0]})
              </button>
            ))}
          </div>

          {/* Unregistered Warning Alert */}
          {!isRegistered && workerId.trim() && (
            <div
              style={{
                marginTop: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: '#f87171',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}
            >
              <XCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>ACCESS DENIED: Unregistered Worker</strong>
                <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Worker "{workerId}" is not registered in the safety registry. PIC SCAN is blocked by backend policy.
                </span>
              </div>
            </div>
          )}

          {/* Blocked / Inactive Alert */}
          {isWorkerBlocked && (
            <div
              style={{
                marginTop: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                color: '#f87171',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px'
              }}
            >
              <Ban size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>ACCESS BLOCKED: Worker Account {matchedWorker?.status}</strong>
                <span style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Please contact the industrial safety supervisor to restore active field authorization.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ACTIVE Cu-PAN STRIP & COUNTDOWN CARD */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            border: isStripExpired
              ? '1px solid rgba(239, 68, 68, 0.4)'
              : isStripExpiringSoon
              ? '1px solid rgba(245, 158, 11, 0.4)'
              : '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="var(--accent-cyan)" />
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                ACTIVE Cu-PAN DISPOSABLE STRIP
              </strong>
            </div>

            <button
              type="button"
              onClick={() => setShowLifecycleModal(true)}
              disabled={!isRegistered || isWorkerBlocked}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <QrCode size={13} />
              <span>{activeStripData ? 'Replace Strip' : 'Activate Strip'}</span>
            </button>
          </div>

          {activeStripData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>STRIP IDENTIFIER</span>
                  <strong style={{ fontSize: '0.92rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {activeStripData.stripId}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>BATCH ID</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {activeStripData.batchId}
                  </span>
                </div>
              </div>

              {/* Countdown Bar */}
              <div
                style={{
                  background: isStripExpired
                    ? 'rgba(239, 68, 68, 0.15)'
                    : isStripExpiringSoon
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(6, 182, 212, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color={isStripExpired ? '#f87171' : isStripExpiringSoon ? '#fbbf24' : '#38bdf8'} />
                  <div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
                      REPLACEMENT COUNTDOWN
                    </span>
                    <strong
                      style={{
                        fontSize: '1rem',
                        fontFamily: 'var(--font-mono)',
                        color: isStripExpired ? '#f87171' : isStripExpiringSoon ? '#fbbf24' : '#38bdf8'
                      }}
                    >
                      {formatCountdown(countdownSeconds)}
                    </strong>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: isStripExpired ? '#ef4444' : isStripExpiringSoon ? '#f59e0b' : '#10b981',
                    color: '#000'
                  }}
                >
                  {isStripExpired ? 'EXPIRED' : isStripExpiringSoon ? 'EXPIRING SOON' : 'ACTIVE'}
                </span>
              </div>

              {/* Expiry Alert Warning */}
              {isStripExpired && (
                <div style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  <span>Strip has expired. Please replace strip before continuing.</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <AlertTriangle size={24} color="#f59e0b" style={{ margin: '0 auto 6px auto' }} />
              <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                No Active Cu-PAN Strip Assigned
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', margin: '4px 0 10px 0' }}>
                A valid disposable strip must be assigned to this worker before scanning.
              </span>
              <button
                type="button"
                onClick={() => setShowLifecycleModal(true)}
                disabled={!isRegistered || isWorkerBlocked}
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              >
                <QrCode size={14} /> Activate New Strip
              </button>
            </div>
          )}
        </div>

        {/* Shift Selection */}
        <div className="glass-panel" style={{ padding: '14px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            OPERATIONAL SHIFT
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {['A', 'B', 'C'].map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => {
                  setShiftLetter(letter);
                  setIsCustomShift(false);
                }}
                style={{
                  padding: '10px 8px',
                  borderRadius: '6px',
                  background: !isCustomShift && shiftLetter === letter ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: !isCustomShift && shiftLetter === letter ? '1.5px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                  color: !isCustomShift && shiftLetter === letter ? 'var(--accent-cyan)' : 'var(--text-primary)',
                  fontWeight: '800',
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Shift {letter}
              </button>
            ))}
          </div>
        </div>

        {/* PIC SCAN ACTION BUTTON (BLOCKED IF UNREGISTERED / EXPIRED / NO STRIP) */}
        <div>
          <button
            type="submit"
            disabled={!canScan}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '1rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              opacity: canScan ? 1 : 0.45,
              cursor: canScan ? 'pointer' : 'not-allowed'
            }}
          >
            <Camera size={20} />
            <span>
              {!isRegistered
                ? 'ACCESS BLOCKED (UNREGISTERED WORKER)'
                : isWorkerBlocked
                ? 'ACCESS BLOCKED (ACCOUNT INACTIVE)'
                : !hasActiveStrip
                ? 'ACCESS BLOCKED (NO ACTIVE STRIP)'
                : isStripExpired
                ? 'ACCESS BLOCKED (STRIP EXPIRED)'
                : 'START PIC SCAN'}
            </span>
          </button>
        </div>
      </form>

      {/* Strip Activation & Replacement Modal */}
      <StripLifecycleModal
        workerId={workerId}
        currentStrip={activeStripData}
        isOpen={showLifecycleModal}
        onClose={() => setShowLifecycleModal(false)}
        onSuccess={(newStrip) => {
          setActiveStripData(newStrip);
          setCountdownSeconds(newStrip.remainingSeconds);
          loadWorkersAndStrip();
        }}
      />
    </div>
  );
}
