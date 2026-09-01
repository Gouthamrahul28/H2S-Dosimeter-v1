import React, { useState } from 'react';
import {
  ShieldAlert,
  Sliders,
  Calculator,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ThermometerSun,
  Activity,
  Layers,
  Sparkles,
  FlaskConical
} from 'lucide-react';
import {
  COLOR_REFERENCE,
  ALERT_LEVELS,
  VALID_TEMP_RANGE_C,
  VALID_RH_RANGE_PCT,
  colorToPPM,
  ppmToAlertLevel,
  analyzeExposure,
  computeShiftTWA,
  analyzeShift,
  rgbToHex,
  hexToRgb
} from '@shared/colorimetricStandards';
import CuPanReferenceScale from '../components/CuPanReferenceScale';
import StripInfoCard from '../components/StripInfoCard';
import LightCorrectionPanel from '../components/LightCorrectionPanel';

export default function StandardsPage() {
  // Swatch Tester State
  const [selectedHex, setSelectedHex] = useState('#8B4C94'); // Cu-PAN Virgin baseline
  const [ambientTemp, setAmbientTemp] = useState(25.0);
  const [ambientHumidity, setAmbientHumidity] = useState(50.0);

  // Shift TWA Calculator State
  const [shiftIntervals, setShiftIntervals] = useState([
    { id: 1, ppm: 0.5, hours: 3, tempC: 28, rhPct: 55 },
    { id: 2, ppm: 2.0, hours: 2, tempC: 32, rhPct: 60 },
    { id: 3, ppm: 8.0, hours: 1, tempC: 35, rhPct: 45 },
    { id: 4, ppm: 1.0, hours: 2, tempC: 27, rhPct: 50 }
  ]);

  // Exposure Analysis for selected swatch
  const exposureResult = analyzeExposure(selectedHex, ambientTemp, ambientHumidity);

  // Shift TWA Analysis
  const shiftAnalysis = analyzeShift(shiftIntervals);

  const handleAddInterval = () => {
    const nextId = shiftIntervals.length > 0 ? Math.max(...shiftIntervals.map((i) => i.id)) + 1 : 1;
    setShiftIntervals([...shiftIntervals, { id: nextId, ppm: 1.5, hours: 1, tempC: 30, rhPct: 55 }]);
  };

  const handleRemoveInterval = (id) => {
    if (shiftIntervals.length > 1) {
      setShiftIntervals(shiftIntervals.filter((i) => i.id !== id));
    }
  };

  const handleUpdateInterval = (id, field, value) => {
    setShiftIntervals(
      shiftIntervals.map((item) => (item.id === id ? { ...item, [field]: parseFloat(value) || 0 } : item))
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px' }}>
      {/* Top Header */}
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '4px 10px', borderRadius: 'var(--radius-full)', marginBottom: '8px' }}>
          <ShieldAlert size={14} />
          <span>Cu-PAN COLORIMETRIC DOSIMETER (SIH26118)</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          Cu-PAN Optical Standards & 8-Hour Shift Dosimetry
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Sensing Principle: Cu(II)-PAN complex + H₂S → CuS + H-PAN (Purple/Violet → Yellow/Orange). Grounded in ACGIH (1 ppm TWA / 5 ppm STEL), NIOSH (10 ppm ceiling), and DGMS (80 ppm·h shift limit).
        </p>
      </div>

      {/* Cu-PAN Reference Scale & Strip Batch Tracking */}
      <CuPanReferenceScale />
      <StripInfoCard batchData={{ batchId: 'CUPAN-001' }} />
      <LightCorrectionPanel correctionStatus="APPLIED" />

      {/* Grid: Interactive Swatch Tester + TWA Calculator */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Section 1: Color Reference Ladder & Live Swatch Tester */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-cyan)" /> Cu-PAN Anchors (Purple/Violet ➔ Yellow/Orange)
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any swatch to test</span>
          </div>

          {/* Reference Color Swatches */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {COLOR_REFERENCE.map((ref) => {
              const isSelected = selectedHex.toUpperCase() === ref.hex.toUpperCase();
              return (
                <div
                  key={ref.ppm}
                  onClick={() => setSelectedHex(ref.hex)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                    border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '28px',
                      borderRadius: '6px',
                      background: ref.hex,
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ width: '85px' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {ref.ppm} ppm·h
                    </strong>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                      {ref.standard}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {ref.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {ref.hex}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Live Simulator Inspection Card */}
          <div
            style={{
              background: 'var(--bg-card-solid)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                Cu-PAN SPECTRAL RESPONSE ESTIMATION:
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={selectedHex}
                  onChange={(e) => setSelectedHex(e.target.value)}
                  style={{ width: '28px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                  title="Custom Color Picker"
                />
                <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {selectedHex}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '10px',
                  background: selectedHex,
                  border: '2px solid var(--border-subtle)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {exposureResult.estimatedDosePpmHours} ppm·h
                  </span>
                  <span className={`badge badge-${exposureResult.badgeClass}`}>
                    {exposureResult.alertLevel}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Optical Shift ΔE₀₀: <strong>{exposureResult.deltaE00}</strong> | Status: <strong>{exposureResult.calibrationStatus}</strong>
                </p>
              </div>
            </div>

            {/* Environmental Derating Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  <span>Ambient Temp:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{ambientTemp} °C</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="0.5"
                  value={ambientTemp}
                  onChange={(e) => setAmbientTemp(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  <span>Relative Humidity:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{ambientHumidity} %</strong>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  step="1"
                  value={ambientHumidity}
                  onChange={(e) => setAmbientHumidity(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                />
              </div>
            </div>

            {!exposureResult.envValid && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>
                <AlertTriangle size={14} />
                <span>{exposureResult.envReason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: 8-Hour Shift TWA Calculator */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={18} color="var(--accent-cyan)" /> 8-Hour Shift TWA Calculator
            </h3>
            <button className="btn-secondary" onClick={handleAddInterval} style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
              <Plus size={14} /> Add Interval
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Time-Weighted Average formula: <code style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>TWA = Σ(Cᵢ × Tᵢ) / ΣTᵢ</code> judged against ACGIH 1.0 ppm 8-hr limit.
          </p>

          {/* Shift Intervals Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {shiftIntervals.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'var(--bg-card)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Conc (ppm)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={item.ppm}
                    onChange={(e) => handleUpdateInterval(item.id, 'ppm', e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Hours</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={item.hours}
                    onChange={(e) => handleUpdateInterval(item.id, 'hours', e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Temp (°C)</span>
                  <input
                    type="number"
                    step="1"
                    value={item.tempC}
                    onChange={(e) => handleUpdateInterval(item.id, 'tempC', e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>RH (%)</span>
                  <input
                    type="number"
                    step="1"
                    value={item.rhPct}
                    onChange={(e) => handleUpdateInterval(item.id, 'rhPct', e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '6px 8px', fontSize: '0.82rem' }}
                  />
                </div>

                <button
                  onClick={() => handleRemoveInterval(item.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '4px'
                  }}
                  title="Remove interval"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* TWA Summary Card */}
          <div
            style={{
              marginTop: 'auto',
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
              border: '1px solid var(--border-active)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                COMPUTED SHIFT TWA ({shiftAnalysis.totalHours} TOTAL HOURS):
              </span>
              <span className={`badge badge-${shiftAnalysis.badgeClass}`}>
                {shiftAnalysis.alertLevel}
              </span>
            </div>

            <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              {shiftAnalysis.twa.toFixed(2)} ppm (Total Dose: {shiftAnalysis.totalDosePpmHours} ppm·h)
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
              {shiftAnalysis.note}
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Official Statutory Standards Matrix */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--accent-cyan)" /> Statutory Regulatory Thresholds Reference Table
        </h3>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Standard / Agency</th>
                <th>Threshold Level</th>
                <th>Classification Type</th>
                <th>Prescribed Mandatory Action</th>
                <th>Regulatory Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>ACGIH (American Conf. Gov. Ind. Hyg.)</strong></td>
                <td><strong style={{ color: '#10b981' }}>1.0 ppm</strong></td>
                <td>8-Hour TLV-TWA</td>
                <td>Safe occupational shift baseline</td>
                <td>ACGIH TLV Documentation</td>
              </tr>
              <tr>
                <td><strong>ACGIH STEL</strong></td>
                <td><strong style={{ color: '#eab308' }}>5.0 ppm</strong></td>
                <td>15-Minute Short-Term Limit</td>
                <td>Caution, verify local area ventilation</td>
                <td>ACGIH STEL 15-min Window</td>
              </tr>
              <tr>
                <td><strong>NIOSH (National Institute Occ. Safety)</strong></td>
                <td><strong style={{ color: '#f97316' }}>10.0 ppm</strong></td>
                <td>Recommended Ceiling Limit</td>
                <td>Warning: Mandatory respirator standby</td>
                <td>NIOSH Pocket Guide</td>
              </tr>
              <tr>
                <td><strong>OSHA (Occupational Safety Health Admin)</strong></td>
                <td><strong style={{ color: '#ef4444' }}>20.0 ppm</strong></td>
                <td>Permissible Exposure Ceiling (PEL)</td>
                <td>Alert: Evacuate non-essential personnel</td>
                <td>29 CFR 1910.1000 Table Z-2</td>
              </tr>
              <tr>
                <td><strong>OSHA Maximum Peak</strong></td>
                <td><strong style={{ color: '#dc2626' }}>50.0 ppm</strong></td>
                <td>10-Minute Maximum Peak</td>
                <td>Danger: SCBA required for emergency tasks</td>
                <td>29 CFR 1910.1000 (10-min Peak)</td>
              </tr>
              <tr>
                <td><strong>NIOSH IDLH</strong></td>
                <td><strong style={{ color: '#8b5cf6' }}>100.0 ppm</strong></td>
                <td>Immediately Dangerous to Life/Health</td>
                <td>Severe / Life Threatening: Immediate plant evacuation</td>
                <td>NIOSH IDLH Criteria</td>
              </tr>
              <tr>
                <td><strong>DGMS / OISD-STD-114 (India)</strong></td>
                <td><strong style={{ color: '#06b6d4' }}>80.0 ppm·h</strong></td>
                <td>Statutory Cumulative Shift Dose</td>
                <td>Automated regulatory audit flag & supervisor register</td>
                <td>OISD-STD-114 / DGMS Mine Safety</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
