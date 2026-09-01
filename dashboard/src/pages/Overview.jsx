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
  Building
} from 'lucide-react';
import WorkerTable from '../components/WorkerTable';
import { getWorkers, getWorkerCumulativeDose, createWorker } from '../services/api';

export default function Overview({ onSelectWorker }) {
  const [workersWithDose, setWorkersWithDose] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New worker form state
  const [newWorkerId, setNewWorkerId] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newDepartment, setNewDepartment] = useState('Drilling & Extraction');
  const [modalError, setModalError] = useState('');

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const workers = await getWorkers();

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Occupational Health Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            Real-time passive H₂S dosimeter exposure telemetry across all refinery units & field crews.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadOverviewData}
            className="btn-secondary"
            disabled={loading}
            title="Refresh records"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus size={16} />
            <span>Register Worker</span>
          </button>
        </div>
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
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
              Add worker metadata for H₂S dosimeter assignment.
            </p>

            <form onSubmit={handleCreateWorker} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>
                  Worker ID (e.g. W1026)
                </label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  placeholder="W1026"
                  value={newWorkerId}
                  onChange={(e) => setNewWorkerId(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%' }}
                  placeholder="Sunil Verma"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>
                  Department / Operating Unit
                </label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%' }}
                  placeholder="Drilling & Extraction"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  required
                />
              </div>

              {modalError && (
                <div style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', background: 'rgba(244,63,94,0.1)', padding: '8px 12px', borderRadius: '6px' }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Register Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
