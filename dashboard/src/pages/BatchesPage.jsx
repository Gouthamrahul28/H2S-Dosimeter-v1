import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Info,
  Calendar,
  Thermometer,
  Droplets,
  Package,
  Clock,
  Ban,
  ShieldCheck
} from 'lucide-react';
import { getBatches } from '../services/api';

export default function BatchesPage() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Form states
  const [newBatchId, setNewBatchId] = useState('');
  const [newShelfDays, setNewShelfDays] = useState('');
  const [newActiveHours, setNewActiveHours] = useState('120');
  const [newPackaging, setNewPackaging] = useState('Sealed Foil with Desiccant Barrier');
  const [newTestRef, setNewTestRef] = useState('Accelerated Arrhenius 40°C/75% RH (ASTM F1980)');
  const [modalError, setModalError] = useState('');

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await getBatches();
      setBatches(data || []);
    } catch (err) {
      console.warn('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      const res = await fetch('/api/v1/admin/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: newBatchId.trim().toUpperCase(),
          chemistry: 'Cu-PAN',
          validatedShelfLifeDays: newShelfDays ? Number(newShelfDays) : null,
          validatedActiveLifeHours: newActiveHours ? Number(newActiveHours) : null,
          packaging: newPackaging,
          stabilityTestReference: newTestRef,
          status: newShelfDays ? 'VALIDATED' : 'NOT_YET_VALIDATED'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create batch');

      setShowCreateModal(false);
      setNewBatchId('');
      setNewShelfDays('');
      loadBatches();
    } catch (err) {
      setModalError(err.message);
    }
  };

  const handleUpdateValidation = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setModalError('');

    try {
      const res = await fetch(`/api/v1/admin/batches/${selectedBatch.batchId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validatedShelfLifeDays: newShelfDays ? Number(newShelfDays) : null,
          validatedActiveLifeHours: newActiveHours ? Number(newActiveHours) : null,
          stabilityTestReference: newTestRef,
          status: newShelfDays ? 'VALIDATED' : 'PARTIALLY_VALIDATED'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update validation');

      setShowValidateModal(false);
      setSelectedBatch(null);
      loadBatches();
    } catch (err) {
      setModalError(err.message);
    }
  };

  const handleRecallBatch = async (batchId) => {
    if (!window.confirm(`Are you sure you want to RECALL batch ${batchId}? All assigned strips in this batch will be blocked from scanning.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/batches/${batchId}/recall`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to recall batch');
      loadBatches();
    } catch (err) {
      alert(`Recall error: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '4px 10px', borderRadius: 'var(--radius-full)', marginBottom: '8px' }}>
            <FlaskConical size={14} />
            <span>SIH26118 • REAGENT PROVENANCE & LIFECYCLE</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Cu-PAN Batch Management & Stability Registry
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Production tracking of disposable Cu-PAN sensing batches, storage envelopes, and active wear intervals.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadBatches} className="btn-secondary" disabled={loading} style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
            <Plus size={15} />
            <span>Create Batch</span>
          </button>
        </div>
      </div>

      {/* Literature Context Notice Card */}
      <div
        style={{
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}
      >
        <Info size={20} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', display: 'block', marginBottom: '2px' }}>
            Scientific Literature Context & Stability Distinction
          </strong>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
            Published Cu-PAN studies (e.g. Niamnuy et al. 2023, Carpenter et al. 2017) have demonstrated selective H₂S colorimetric response, but also observed loss of detection response with aging (e.g. 76% and 43% response retention after 90 days at 5°C and 25°C). <strong>Literature values are not presented as certified product shelf life.</strong> Instead, shelf-life and active wear intervals are assigned strictly through our empirical validation protocol.
          </p>
        </div>
      </div>

      {/* Batches Table */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-cyan)" /> Manufactured Cu-PAN Batches
        </h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Manufactured</th>
                <th style={{ textAlign: 'center' }}>Shelf Life</th>
                <th style={{ textAlign: 'center' }}>Active Wear Life</th>
                <th>Storage Envelope</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No manufacturing batches registered.
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const isRecalled = b.status === 'RECALLED';
                  const isValidated = b.status === 'VALIDATED';

                  return (
                    <tr key={b.batchId}>
                      <td>
                        <strong style={{ fontFamily: 'var(--font-mono)', color: isRecalled ? 'var(--accent-rose)' : 'var(--accent-cyan)' }}>
                          {b.batchId}
                        </strong>
                        {b.isDemo && (
                          <span style={{ marginLeft: '6px', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            SIMULATED
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {new Date(b.manufacturedAt).toLocaleDateString()}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {b.packaging}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: b.validatedShelfLifeDays ? '#34d399' : '#f59e0b', fontSize: '0.82rem' }}>
                          {b.validatedShelfLifeDays ? `${b.validatedShelfLifeDays} days` : 'NOT VALIDATED'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: b.validatedActiveLifeHours ? 'var(--accent-cyan)' : '#f59e0b', fontSize: '0.82rem' }}>
                          {b.validatedActiveLifeHours ? `${b.validatedActiveLifeHours} hrs (${(b.validatedActiveLifeHours / 24).toFixed(0)}d)` : 'NOT VALIDATED'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {b.storageMinTemp}°C – {b.storageMaxTemp}°C &bull; &lt;{b.storageMaxHumidity}% RH
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: isRecalled ? 'rgba(239, 68, 68, 0.15)' : isValidated ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: isRecalled ? '#f87171' : isValidated ? '#34d399' : '#fbbf24',
                            border: isRecalled ? '1px solid rgba(239, 68, 68, 0.3)' : isValidated ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                          }}
                        >
                          {b.status}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => {
                              setSelectedBatch(b);
                              setNewShelfDays(b.validatedShelfLifeDays || '');
                              setNewActiveHours(b.validatedActiveLifeHours || '120');
                              setNewTestRef(b.stabilityTestReference || '');
                              setShowValidateModal(true);
                            }}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          >
                            Update
                          </button>

                          {!isRecalled && (
                            <button
                              onClick={() => handleRecallBatch(b.batchId)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.72rem',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: '700'
                              }}
                            >
                              Recall
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Batch Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '24px', background: 'var(--bg-card-solid)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Create Cu-PAN Manufacturing Batch
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '16px' }}>
              Register a new synthesis run of Cu-PAN colorimetric indicator strips.
            </p>

            {modalError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--accent-rose)', fontSize: '0.82rem', marginBottom: '14px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>BATCH IDENTIFIER</label>
                <input type="text" required placeholder="e.g. CUPAN-BATCH-004" value={newBatchId} onChange={(e) => setNewBatchId(e.target.value)} className="input-control" style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>SHELF LIFE (DAYS)</label>
                  <input type="number" placeholder="Leave blank if unvalidated" value={newShelfDays} onChange={(e) => setNewShelfDays(e.target.value)} className="input-control" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>ACTIVE WEAR (HOURS)</label>
                  <input type="number" placeholder="e.g. 120 (5 days)" value={newActiveHours} onChange={(e) => setNewActiveHours(e.target.value)} className="input-control" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>PACKAGING SPECIFICATION</label>
                <input type="text" value={newPackaging} onChange={(e) => setNewPackaging(e.target.value)} className="input-control" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Register Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Validation Modal */}
      {showValidateModal && selectedBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '460px', padding: '24px', background: 'var(--bg-card-solid)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Update Batch Validation: {selectedBatch.batchId}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '16px' }}>
              Set experimentally proven stability parameters from chamber testing.
            </p>

            {modalError && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--accent-rose)', fontSize: '0.82rem', marginBottom: '14px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleUpdateValidation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>SHELF LIFE (DAYS)</label>
                  <input type="number" placeholder="e.g. 180" value={newShelfDays} onChange={(e) => setNewShelfDays(e.target.value)} className="input-control" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>ACTIVE WEAR (HOURS)</label>
                  <input type="number" placeholder="e.g. 120" value={newActiveHours} onChange={(e) => setNewActiveHours(e.target.value)} className="input-control" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>STABILITY TEST REFERENCE</label>
                <input type="text" value={newTestRef} onChange={(e) => setNewTestRef(e.target.value)} className="input-control" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowValidateModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save Validation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
