import React, { useState } from 'react';
import {
  Layers,
  Calendar,
  Thermometer,
  Droplets,
  Package,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Info,
  Clock,
  CheckCircle2
} from 'lucide-react';

/**
 * Cu-PAN Strip Information & Shelf-Life Card
 * 
 * Exposes batch tracking, manufacturing provenance, environmental storage boundaries,
 * and future stability testing protocol schema fields without fabricating unmeasured durations.
 */
export default function StripInfoCard({ batchData }) {
  const [showStabilitySchema, setShowStabilitySchema] = useState(false);

  // Active batch configuration with fallback defaults
  const batch = {
    batchId: batchData?.batchId || 'CUPAN-001',
    mfgDate: batchData?.mfgDate || '01 Sep 2026',
    expiryDate: batchData?.expiryDate || 'EXPERIMENTAL',
    shelfLifeDuration: batchData?.shelfLifeDuration || 'NOT VALIDATED',
    storageTemp: batchData?.storageTemp || '15°C – 25°C (VALIDATED RANGE)',
    storageHumidity: batchData?.storageHumidity || '< 60% RH Desiccated',
    packagingType: batchData?.packagingType || 'Sealed Foil with Desiccant Barrier',
    currentStatus: batchData?.currentStatus || 'CALIBRATED BATCH (EXPERIMENTAL SHELF LIFE)',
    // Future stability testing metadata schema
    stabilityTestType: batchData?.stabilityTestType || 'Accelerated Arrhenius (40°C/75% RH) & Ambient Room Test',
    agingPeriod: batchData?.agingPeriod || 'NOT VALIDATED (Real-time study underway)',
    initialResponse: batchData?.initialResponse || 'L*₀=42.50, a*₀=38.20, b*₀=-28.40 (ΔE₀₀ = 0.00)',
    finalResponse: batchData?.finalResponse || 'DATA UNAVAILABLE',
    responseRetentionPercent: batchData?.responseRetentionPercent || 'DATA UNAVAILABLE',
    expiryCriterion: batchData?.expiryCriterion || 'Baseline dark-drift ΔE₀₀ < 1.5 in sealed desiccated storage'
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Layers size={16} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              Cu-PAN Strip & Batch Information
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Reagent substrate batch tracking and validated storage boundaries
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: '700',
            padding: '4px 8px',
            borderRadius: '6px',
            background: 'rgba(56, 189, 248, 0.12)',
            color: 'var(--accent-cyan)',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}
        >
          {batch.batchId}
        </span>
      </div>

      {/* Grid of Core Batch Parameters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px'
        }}
      >
        {/* Batch ID */}
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            BATCH IDENTIFIER
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {batch.batchId}
          </strong>
        </div>

        {/* Mfg Date */}
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            MANUFACTURING DATE
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {batch.mfgDate}
          </strong>
        </div>

        {/* Expiry Date */}
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            EXPIRY DATE
          </span>
          <strong style={{ fontSize: '0.85rem', color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
            {batch.expiryDate}
          </strong>
        </div>

        {/* Shelf Life Duration */}
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            SHELF-LIFE DURATION
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {batch.shelfLifeDuration}
          </strong>
        </div>

        {/* Storage Temperature */}
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            STORAGE TEMPERATURE
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {batch.storageTemp}
          </strong>
        </div>

        {/* Storage Humidity */}
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            STORAGE HUMIDITY
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {batch.storageHumidity}
          </strong>
        </div>

        {/* Packaging Type */}
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            PACKAGING TYPE
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            {batch.packagingType}
          </strong>
        </div>

        {/* Current Status */}
        <div className="glass-panel" style={{ padding: '10px 12px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
            VALIDATION STATUS
          </span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
            {batch.currentStatus}
          </strong>
        </div>
      </div>

      {/* Stability Notice Banner */}
      <div
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          fontSize: '0.74rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <Info size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
        <span>
          <strong>Scientific Integrity Notice:</strong> Shelf life is not assumed or extrapolated. The formal expiry date will be assigned only upon completion of empirical real-time and Arrhenius aging studies.
        </span>
      </div>

      {/* Expandable Future Stability Testing Protocol Drawer */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
        <button
          onClick={() => setShowStabilitySchema(!showStabilitySchema)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: 0
          }}
        >
          <FlaskConical size={14} color="var(--accent-cyan)" />
          <span>Stability Testing Protocol Schema</span>
          {showStabilitySchema ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showStabilitySchema && (
          <div
            style={{
              marginTop: '10px',
              background: 'rgba(3, 7, 18, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
              fontSize: '0.74rem'
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>stability_test_type:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{batch.stabilityTestType}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>aging_period:</span>
              <strong style={{ color: '#f59e0b' }}>{batch.agingPeriod}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>initial_response:</span>
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{batch.initialResponse}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>final_response:</span>
              <strong style={{ color: 'var(--text-muted)' }}>{batch.finalResponse}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>response_retention_percent:</span>
              <strong style={{ color: 'var(--text-muted)' }}>{batch.responseRetentionPercent}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>expiry_criterion:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{batch.expiryCriterion}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
