import React, { useState } from 'react';
import {
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Camera,
  Layers,
  ThermometerSun,
  AlertTriangle,
  FileCheck2,
  Sun,
  Moon,
  Sparkles,
  Info,
  CheckCircle2,
  Activity,
  FlaskConical
} from 'lucide-react';
import { COLOR_REFERENCE, ALERT_LEVELS, VALID_TEMP_RANGE_C, VALID_RH_RANGE_PCT } from '@shared/colorimetricStandards';

export default function OnboardingModal({ isOpen, onClose, isDarkMode, onToggleTheme }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const STEPS = [
    {
      title: 'Welcome to Cu-PAN H₂S Dosimeter Suite',
      subtitle: 'Passive Colorimetric Sensing Software Platform (SIH26118)',
      badge: 'Step 1 of 5 • Chemical Principle'
    },
    {
      title: 'Badge Architecture & Optical Zones',
      subtitle: 'Understanding the 3 distinct spatial areas on every wristband',
      badge: 'Step 2 of 5 • Optical Hardware'
    },
    {
      title: 'Cu-PAN Color Progression & Standards',
      subtitle: 'Purple/Violet → Yellow/Orange Chemical Response',
      badge: 'Step 3 of 5 • Safety Chemistry'
    },
    {
      title: 'Environmental Operating Envelope & TWA',
      subtitle: 'Temperature, humidity compensation & 8-hour shift mathematics',
      badge: 'Step 4 of 5 • Kinetics & Modeling'
    },
    {
      title: 'Your Daily Operational Routine',
      subtitle: 'Field scanning, supervisor auditing & statutory reporting',
      badge: 'Step 5 of 5 • Getting Started'
    }
  ];

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px', padding: '32px', display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '4px 10px', borderRadius: 'var(--radius-full)', marginBottom: '8px' }}>
              <Sparkles size={14} />
              <span>{STEPS[currentStep].badge}</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              {STEPS[currentStep].title}
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {STEPS[currentStep].subtitle}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Content Area */}
        <div style={{ flex: 1, minHeight: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {/* STEP 1: Overview */}
          {currentStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)'
                  }}
                >
                  <ShieldCheck size={30} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Cu-PAN Colorimetric Sensing Principle
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    The dosimeter utilizes an immobilized <strong style={{ color: 'var(--accent-cyan)' }}>Cu(II)-PAN complex</strong>. Upon exposure to gaseous H₂S, sulfide displaces the dye yielding CuS and releasing protonated H-PAN, producing a visible chromatic transition from <strong style={{ color: '#f59e0b' }}>Purple/Violet to Yellow/Orange</strong>.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-emerald)' }}>
                    <Camera size={18} />
                    <strong style={{ fontSize: '0.9rem' }}>Optical Field Capture</strong>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Workers capture dosimeter photos using smartphone cameras. 3-patch target normalization eliminates lighting tints and camera sensor variances.
                  </p>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-cyan)' }}>
                    <Activity size={18} />
                    <strong style={{ fontSize: '0.9rem' }}>Supervisor Fleet Portal</strong>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Safety officers monitor cumulative exposure across industrial sectors, track 80 ppm·h shift ceilings, and audit compliance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Badge Zones */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: isDarkMode ? '#0f172a' : '#e2e8f0',
                  border: '2px solid var(--border-subtle)',
                  borderRadius: '16px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Top-Left Reference Patch */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '2px solid #38bdf8',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 0 10px rgba(56, 189, 248, 0.3)'
                    }}
                  >
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#ffffff', border: '1px solid #cbd5e1' }} />
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0f172a', display: 'block' }}>REF (WHITE)</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>RGB [250,250,250]</span>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    DGMS / OISD CERTIFIED Cu-PAN DOSIMETER
                  </span>

                  {/* Top-Right Grey Reference */}
                  <div
                    style={{
                      background: '#808080',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#808080', border: '1px solid #94a3b8' }} />
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ffffff', display: 'block' }}>GREY REF</span>
                      <span style={{ fontSize: '0.65rem', color: '#e2e8f0' }}>RGB [128,128,128]</span>
                    </div>
                  </div>
                </div>

                {/* Center Strip */}
                <div
                  style={{
                    margin: '8px auto',
                    width: '60%',
                    background: '#8B4C94',
                    border: '3px solid #0284c7',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                    boxShadow: '0 0 16px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#ffffff', display: 'block', letterSpacing: '0.05em' }}>
                    ACTIVE Cu-PAN CHEMICAL STRIP
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>
                    Transitions Purple → Yellow/Orange with Cumulative H₂S Dose
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="glass-panel" style={{ padding: '10px 12px' }}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', display: 'block' }}>1. White Patch</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Illuminant estimation & Bradford adaptation</span>
                </div>
                <div className="glass-panel" style={{ padding: '10px 12px' }}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', display: 'block' }}>2. Cu-PAN Strip</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Quantified via CIEDE2000 colorimetry</span>
                </div>
                <div className="glass-panel" style={{ padding: '10px 12px' }}>
                  <strong style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', display: 'block' }}>3. Grey Patch</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Mid-tone linearity & exposure quality gate</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Cu-PAN Color Progression */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {COLOR_REFERENCE.slice(0, 5).map((ref) => (
                  <div
                    key={ref.ppm}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '10px 8px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '24px',
                        borderRadius: '4px',
                        background: ref.hex,
                        border: '1px solid rgba(255,255,255,0.2)'
                      }}
                    />
                    <strong style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {ref.ppm} ppm·h
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.2 }}>
                      {ref.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="glass-panel" style={{ padding: '12px 16px', marginTop: '6px' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Statutory Regulatory Tiers (ppm·h):
                </strong>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ALERT_LEVELS.slice(0, 5).map((z) => (
                    <span key={z.level} className={`badge badge-${z.badgeClass}`} style={{ fontSize: '0.72rem' }}>
                      {z.level}: {z.min}–{z.max === Infinity ? '+' : z.max} ppm·h
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Kinetics & Modeling */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="glass-panel" style={{ padding: '16px' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', display: 'block', marginBottom: '4px' }}>
                  Arrhenius Kinetic Rate Modeling
                </strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  High ambient temperature and humidity accelerate gas diffusion and reaction kinetics. The engine compensates measured optical shift ΔE₀₀ by computing the kinetic rate factor $k(T, RH)$ at reference conditions (25°C, 50% RH).
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="glass-panel" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OPERATING TEMPERATURE</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>10°C to 50°C</strong>
                </div>
                <div className="glass-panel" style={{ padding: '12px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>OPERATING HUMIDITY</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>15% to 90% RH</strong>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Getting Started */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px'
                }}
              >
                <strong style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', display: 'block', marginBottom: '4px' }}>
                  Ready for Industrial Deployment
                </strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  Begin by registering workers or exploring live telemetry feeds. Connect mobile devices via Wi-Fi for instantaneous edge dosimetry.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="glass-panel" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block' }}>1. Field Capture</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Workers scan badges</span>
                </div>
                <div className="glass-panel" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block' }}>2. Live Monitoring</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Audits & Alerts</span>
                </div>
                <div className="glass-panel" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block' }}>3. DGMS Reports</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Compliance logs</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            className="btn-secondary"
            onClick={handlePrev}
            disabled={currentStep === 0}
            style={{ padding: '8px 16px', fontSize: '0.85rem', opacity: currentStep === 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          {/* Dots Indicator */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === currentStep ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: i === currentStep ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>

          <button
            className="btn-primary"
            onClick={handleNext}
            style={{ padding: '8px 18px', fontSize: '0.85rem' }}
          >
            {currentStep === STEPS.length - 1 ? (
              <>
                Get Started <CheckCircle2 size={16} />
              </>
            ) : (
              <>
                Next <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
