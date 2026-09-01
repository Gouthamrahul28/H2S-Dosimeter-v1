import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  ShieldCheck,
  Activity,
  Search,
  Plus,
  RefreshCw,
  Filter,
  ShieldAlert,
  Building,
  Thermometer,
  Droplets,
  Percent,
  Cpu,
  ChevronDown,
  ChevronUp,
  Camera,
  Sparkles,
  Info
} from 'lucide-react';
import WorkerTable from '../components/WorkerTable';
import CuPanReferenceScale from '../components/CuPanReferenceScale';
import StripInfoCard from '../components/StripInfoCard';
import LightCorrectionPanel from '../components/LightCorrectionPanel';
import CalculationTraceCard from '../components/CalculationTraceCard';
import { getWorkers, getWorkerCumulativeDose, createWorker, getRecentReadings } from '../services/api';
import { DEFAULT_CCM, VIRGIN_BASELINE_LAB } from '@shared/colorimetricStandards';

export default function Overview({ onSelectWorker }) {
  const [workersWithDose, setWorkersWithDose] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);

  // Active highlighted reading for master instrument panel
  const [activeReading, setActiveReading] = useState({
    workerId: 'W1023',
    shiftId: '2026-09-01-A',
    dose: 7.4,
    unit: 'ppm·h',
    alertLevel: 'CAUTION',
    alertBadgeClass: 'caution',
    confidence: 94,
    temperature_c: 25.0,
    humidity_percent: 60.0,
    stripColorRGB: { r: 168, g: 115, b: 130 },
    referenceColorRGB: { r: 245, g: 242, b: 235 },
    greyColorRGB: { r: 128, g: 128, b: 128 },
    lab: { L: 52.0, a: 26.5, b: 2.8 },
    deltaE00: 19.6,
    cameraProfile: 'mobile_001',
    stripBatch: 'CUPAN-001',
    calibrationStatus: 'VALID'
  });

  // New worker form state
  const [newWorkerId, setNewWorkerId] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newDepartment, setNewDepartment] = useState('Drilling & Extraction');
  const [modalError, setModalError] = useState('');

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const [workers, recent] = await Promise.all([
        getWorkers(),
        getRecentReadings(1).catch(() => [])
      ]);

      if (recent && recent.length > 0) {
        const r = recent[0];
        setActiveReading((prev) => ({
          ...prev,
          workerId: r.workerId || prev.workerId,
          shiftId: r.shiftId || prev.shiftId,
          dose: Number(r.dose || r.estimatedDosePpmHours || prev.dose),
          alertLevel: r.alertLevel || prev.alertLevel,
          confidence: Number(r.confidence ? (r.confidence > 1 ? r.confidence : r.confidence * 100) : prev.confidence),
          temperature_c: Number(r.ambientTemp || prev.temperature_c),
          humidity_percent: Number(r.ambientHumidity || prev.humidity_percent),
          stripColorRGB: r.stripColorRGB || prev.stripColorRGB,
          referenceColorRGB: r.referenceColorRGB || prev.referenceColorRGB,
          greyColorRGB: r.greyColorRGB || prev.greyColorRGB,
          lab: r.lab || prev.lab,
          deltaE00: Number(r.deltaE00 || prev.deltaE00),
          calibrationStatus: r.calibrationStatus || prev.calibrationStatus
        }));
      }

      // Fetch cumulative dose for each worker concurrently
      const enhanced = await Promise.all(
        workers.map(async (w) => {
          try {
            const doseData = await getWorkerCumulativeDose(w.workerId);
            return {
              ...w,
              totalDosePpmHours: doseData.totalDosePpmHours || 0,
              readingCount: doseData.readingCount || 0,
              thresholdPpmHours: doseData.thresholdPpmHours || 80,
              overThreshold: !!doseData.overThreshold
            };
          } catch (e) {
            return {
              ...w,
              totalDosePpmHours: 0,
              readingCount: 0,
              thresholdPpmHours: 80,
              overThreshold: false
            };
          }
        })
      );

      setWorkersWithDose(enhanced);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewData();
  }, []);

  // Compute KPI metrics
  const totalWorkers = workersWithDose.length;
  const overThresholdCount = workersWithDose.filter((w) => w.overThreshold).length;
  const approachingCount = workersWithDose.filter(
    (w) => !w.overThreshold && (w.totalDosePpmHours || 0) >= (w.thresholdPpmHours || 80) * 0.75
  ).length;
  const avgDose = totalWorkers > 0
    ? (workersWithDose.reduce((sum, w) => sum + (w.totalDosePpmHours || 0), 0) / totalWorkers).toFixed(1)
    : 0;

  // Unique departments for filtering
  const departments = ['ALL', ...new Set(workersWithDose.map((w) => w.department).filter(Boolean))];

  // Filtered workers list
  const filteredWorkers = workersWithDose.filter((w) => {
    const matchesSearch =
      w.workerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDept === 'ALL' || w.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      await createWorker({
        workerId: newWorkerId.trim().toUpperCase(),
        name: newWorkerName.trim(),
        department: newDepartment.trim()
      });
      setShowAddModal(false);
      setNewWorkerId('');
      setNewWorkerName('');
      loadOverviewData();
    } catch (err) {
      setModalError(err.message || 'Failed to create worker');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '3px 8px', borderRadius: 'var(--radius-full)', marginBottom: '4px' }}>
            <Activity size={13} />
            <span>SIH26118 • Cu-PAN COLORIMETRIC DOSIMETER</span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
            H₂S DOSIMETER DASHBOARD
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '2px' }}>
            Passive Cu-PAN chemical sensing telemetry & statutory DGMS/OISD exposure surveillance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadOverviewData}
            className="btn-secondary"
            disabled={loading}
            title="Refresh records"
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            <Plus size={15} />
            <span>Register Worker</span>
          </button>
        </div>
      </div>

      {/* Critical Architecture Separation Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '10px'
        }}
      >
        <div
          style={{
            background: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
            1. CAMERA COLOUR CORRECTION
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Maps sensor RGB → D65 XYZ
          </span>
        </div>

        <div
          style={{
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: '#c084fc', textTransform: 'uppercase' }}>
            2. CU-PAN COLOUR CALIBRATION
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Maps ΔE₀₀ → Dose (ppm·h)
          </span>
        </div>

        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
            3. RISK CLASSIFICATION
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            DGMS 80 ppm·h shift limit
          </span>
        </div>
      </div>

      {/* SECTION 4: MAIN SCREEN PRIMARY USER RESULT CARD (NO EQUATIONS) */}
      <div
        className="glass-card"
        style={{
          padding: '24px 28px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '20px',
          alignItems: 'center',
          background: 'radial-gradient(circle at 10% 20%, rgba(6, 182, 212, 0.12) 0%, var(--bg-card) 100%)',
          border: '1px solid rgba(6, 182, 212, 0.35)'
        }}
      >
        {/* Current Dose */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            CURRENT DOSE
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0 0 0' }}>
            <span style={{ fontSize: '2.8rem', fontWeight: '900', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
              {activeReading.dose.toFixed(1)}
            </span>
            <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
              ppm·h
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Worker: {activeReading.workerId} (Shift: {activeReading.shiftId})
          </span>
        </div>

        {/* Status */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            STATUS
          </span>
          <div style={{ margin: '6px 0' }}>
            <span className={`badge badge-${activeReading.alertBadgeClass}`} style={{ fontSize: '0.9rem', padding: '6px 14px', textTransform: 'uppercase' }}>
              {activeReading.alertLevel}
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            DGMS 80 ppm·h Policy: {activeReading.dose > 80 ? 'ACTION REQUIRED' : 'NORMAL'}
          </span>
        </div>

        {/* Confidence */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            CONFIDENCE
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '4px 0 0 0' }}>
            {activeReading.confidence}%
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', fontWeight: '600' }}>
            ● Calibration {activeReading.calibrationStatus}
          </span>
        </div>

        {/* Temperature */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            TEMPERATURE
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '4px 0 0 0' }}>
            {activeReading.temperature_c.toFixed(0)} °C
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Rated Envelope (10–50°C)
          </span>
        </div>

        {/* Humidity */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            HUMIDITY
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '4px 0 0 0' }}>
            {activeReading.humidity_percent.toFixed(0)} %
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Rated Envelope (15–90% RH)
          </span>
        </div>
      </div>

      {/* SECTION 1: Cu-PAN REFERENCE COLOUR SCALE CARD */}
      <CuPanReferenceScale />

      {/* SECTION 2: Cu-PAN STRIP INFORMATION & SHELF LIFE CARD */}
      <StripInfoCard batchData={{ batchId: activeReading.stripBatch }} />

      {/* SECTION 3, 4 & 5: COLLAPSIBLE ANALYSIS DETAILS (TECHNICAL VIEW) */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <button
          onClick={() => setShowAnalysisDetails(!showAnalysisDetails)}
          style={{
            width: '100%',
            padding: '16px 20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={18} color="var(--accent-cyan)" />
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>
                Analysis Details & Technical View
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Light correction, camera characterization, CIELAB metrics, calibration model & trace
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: '700' }}>
            <span>{showAnalysisDetails ? 'Hide Details' : 'View Details'}</span>
            {showAnalysisDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showAnalysisDetails && (
          <div
            style={{
              padding: '20px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(3, 7, 18, 0.65)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            {/* Technical Sub-Panel 1: Light Correction & Normalization */}
            <LightCorrectionPanel
              readingData={activeReading}
              rawStripRGB={activeReading.stripColorRGB}
              rawWhiteRGB={activeReading.referenceColorRGB}
              correctionStatus="APPLIED"
            />

            {/* Technical Sub-Panel 2: Camera Profile, CIELAB & Calibration Model */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {/* Camera Profile & Raw Colour */}
              <div className="glass-panel" style={{ padding: '14px', fontSize: '0.78rem' }}>
                <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '8px' }}>
                  Camera Profile & Raw Colorimetric Inputs
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)' }}>
                  <div>Camera Profile: <strong style={{ color: '#fff' }}>{activeReading.cameraProfile} (ISO 17321-1 CCM)</strong></div>
                  <div>Raw Strip RGB: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>[{activeReading.stripColorRGB.r}, {activeReading.stripColorRGB.g}, {activeReading.stripColorRGB.b}]</strong></div>
                  <div>Reference White RGB: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>[{activeReading.referenceColorRGB.r}, {activeReading.referenceColorRGB.g}, {activeReading.referenceColorRGB.b}]</strong></div>
                  <div>Reference Grey RGB: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>[{activeReading.greyColorRGB.r}, {activeReading.greyColorRGB.g}, {activeReading.greyColorRGB.b}]</strong></div>
                </div>
              </div>

              {/* CIELAB & CIEDE2000 */}
              <div className="glass-panel" style={{ padding: '14px', fontSize: '0.78rem' }}>
                <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '8px' }}>
                  CIELAB & Perceptual Shift (ISO/CIE 11664-6)
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)' }}>
                  <div>Measured L*: <strong style={{ color: '#fff' }}>{activeReading.lab.L.toFixed(2)}</strong> (Baseline: {VIRGIN_BASELINE_LAB.L})</div>
                  <div>Measured a*: <strong style={{ color: '#fff' }}>{activeReading.lab.a.toFixed(2)}</strong> (Baseline: {VIRGIN_BASELINE_LAB.a})</div>
                  <div>Measured b*: <strong style={{ color: '#fff' }}>{activeReading.lab.b.toFixed(2)}</strong> (Baseline: {VIRGIN_BASELINE_LAB.b})</div>
                  <div>Optical Shift ΔE₀₀: <strong style={{ color: 'var(--accent-cyan)' }}>{activeReading.deltaE00.toFixed(2)}</strong></div>
                </div>
              </div>

              {/* Calibration Model & Domain Bounds */}
              <div className="glass-panel" style={{ padding: '14px', fontSize: '0.78rem' }}>
                <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '8px' }}>
                  Dose Calibration Model & Domain Range
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)' }}>
                  <div>Model: <strong style={{ color: '#fff' }}>Piecewise Monotonic Spline (v1.0)</strong></div>
                  <div>Calibration Status: <strong style={{ color: '#10b981' }}>{activeReading.calibrationStatus}</strong></div>
                  <div>Calibrated Domain: <strong style={{ color: '#fff' }}>0.0 – 160.0 ppm·h</strong></div>
                  <div>Confidence Scoring: <strong style={{ color: 'var(--accent-cyan)' }}>{activeReading.confidence}% (Quality Valid)</strong></div>
                </div>
              </div>
            </div>

            {/* Technical Sub-Panel 3: Calculation Trace */}
            <CalculationTraceCard
              readingData={activeReading}
              rawStripRGB={activeReading.stripColorRGB}
              rawWhiteRGB={activeReading.referenceColorRGB}
              tempC={activeReading.temperature_c}
              rhPct={activeReading.humidity_percent}
            />
          </div>
        )}
      </div>

      {/* Over-Threshold Urgent Alert Banner */}
      {overThresholdCount > 0 && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(244, 63, 94, 0.15), rgba(244, 63, 94, 0.05))',
            border: '1px solid rgba(244, 63, 94, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(244, 63, 94, 0.12)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-rose)'
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <strong style={{ color: 'var(--accent-rose)', fontSize: '0.95rem', display: 'block' }}>
                {overThresholdCount} Worker(s) Exceeded DGMS Permissible 80 ppm·h Threshold
              </strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                Immediate rotation off hot zones and medical health surveillance check required under OISD-STD-114.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Workers */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
              Monitored Personnel
            </span>
            <Users size={20} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {totalWorkers}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active registered badges</span>
        </div>

        {/* Card 2: Over Threshold Alerts */}
        <div className="glass-card" style={{ padding: '18px 20px', border: overThresholdCount > 0 ? '1px solid rgba(244,63,94,0.4)' : '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
              Over Threshold
            </span>
            <ShieldAlert size={20} color={overThresholdCount > 0 ? 'var(--accent-rose)' : 'var(--text-muted)'} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: overThresholdCount > 0 ? 'var(--accent-rose)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {overThresholdCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: overThresholdCount > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
            &gt; 80 ppm·h DGMS limit
          </span>
        </div>

        {/* Card 3: Approaching Limit */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
              Approaching Limit
            </span>
            <AlertTriangle size={20} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
            {approachingCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>60 - 80 ppm·h zone</span>
        </div>

        {/* Card 4: Average Exposure */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase' }}>
              Fleet Avg Dose
            </span>
            <Activity size={20} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
            {avgDose} <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-secondary)' }}>ppm·h</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mean cumulative exposure</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 260px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="input-control"
            placeholder="Search by Worker ID or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Dept:</span>
          <select
            className="input-control"
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Workers Roster Table */}
      <WorkerTable workers={filteredWorkers} onSelectWorker={onSelectWorker} />

      {/* Add Worker Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '24px', background: 'var(--bg-card-solid)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Register New Worker
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '20px' }}>
              Add a field technician to the active Cu-PAN dosimeter monitoring register.
            </p>

            {modalError && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  color: 'var(--accent-rose)',
                  fontSize: '0.82rem',
                  marginBottom: '16px'
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateWorker} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  WORKER ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. W1026"
                  value={newWorkerId}
                  onChange={(e) => setNewWorkerId(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  FULL NAME
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ravi Shankar"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  className="input-control"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  OPERATIONAL UNIT / DEPT
                </label>
                <select
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="input-control"
                  style={{ width: '100%', cursor: 'pointer' }}
                >
                  <option value="Drilling & Extraction">Drilling & Extraction</option>
                  <option value="Refinery Unit 4">Refinery Unit 4</option>
                  <option value="Offshore Pipeline">Offshore Pipeline</option>
                  <option value="Desulfurization & Claus">Desulfurization & Claus</option>
                  <option value="Sour Gas Sweetening">Sour Gas Sweetening</option>
                  <option value="Wastewater Treatment">Wastewater Treatment</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
