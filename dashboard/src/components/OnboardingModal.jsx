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
  Activity
} from 'lucide-react';
import { COLOR_REFERENCE, ALERT_LEVELS, VALID_TEMP_RANGE_C, VALID_RH_RANGE_PCT } from '@shared/colorimetricStandards';

export default function OnboardingModal({ isOpen, onClose, isDarkMode, onToggleTheme }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const STEPS = [
    {
      title: 'Welcome to H₂S Dosimeter Suite',
      subtitle: 'Passive Colorimetric Wristband Software Platform (SIH26118 — MRPL)',
      badge: 'Step 1 of 5 • Introduction'
    },
    {
      title: 'Badge Architecture & Optical Zones',
      subtitle: 'Understanding the 3 distinct spatial areas on every wristband',
      badge: 'Step 2 of 5 • Optical Hardware'
    },
    {
      title: 'Colorimetrics & Regulatory Standards',
      subtitle: 'OSHA, ACGIH, NIOSH & DGMS occupational health thresholds',
      badge: 'Step 3 of 5 • Safety Chemistry'
    },
    {
      title: 'Environmental Operating Envelope & TWA',
      subtitle: 'Temperature, humidity compensation & 8-hour shift mathematics',
      badge: 'Step 4 of 5 • Data Modeling'
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
                    Zero-Power Passive Chemical Dosimetry
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    Unlike bulky battery sniffers, each field worker wears a lightweight colorimetric wristband that continuously absorbs hydrogen sulfide (<strong style={{ color: 'var(--accent-cyan)' }}>H₂S</strong>) gas via permanent metallic sulfide precipitation (<strong style={{ color: 'var(--text-primary)' }}>Ag₂S / PbS</strong>).
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-emerald)' }}>
                    <Camera size={18} />
                    <strong style={{ fontSize: '0.9rem' }}>Optical Field PWA</strong>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Field workers photograph their wristband with their smartphone. Chromatic normalization eliminates lighting tint in real time.
                  </p>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-cyan)' }}>
                    <Activity size={18} />
                    <strong style={{ fontSize: '0.9rem' }}>Supervisor Fleet Portal</strong>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Safety officers monitor all shifts across refinery divisions, track ACGIH/OSHA ceilings, and print DGMS regulatory registers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Badge Zones */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Visual Badge Mockup */}
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
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>RGB [255,255,255]</span>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    DGMS / OISD CERTIFIED WRISTBAND
                  </span>

                  {/* Top-Right Expiry Patch */}
                  <div
                    style={{
                      background: '#e2e8f0',
                      border: '2px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: '#e2e8f0', border: '1px solid #94a3b8' }} />
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#334155', display: 'block' }}>EXPIRY PATCH</span>
                      <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Chemical Integrity</span>
                    </div>
                  </div>
                </div>

                {/* Center Strip */}
                <div
                  style={{
                    margin: '8px auto',
                    width: '60%',
                    background: '#847e6c',
                    border: '3px solid #0284c7',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                    boxShadow: '0 0 16px rgba(2, 132, 199, 0.4)'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#ffffff', display: 'block', letterSpacing: '0.05em' }}>
                    ACTIVE H₂S CHEMICAL STRIP
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#e2e8f0' }}>
                    Permanent darkening: #F5F2E8 (0 ppm) ➔ #0A0A08 (100 ppm)
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
                💡 <strong>Why the reference patch matters:</strong> Whether under orange sodium streetlights (2700K) or bright daylight (5500K), scaling strip RGB against the measured reference patch guarantees zero color drift!
              </p>
            </div>
          )}

          {/* STEP 3: Regulatory Standards */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Visual color anchor ladder grounded in published regulatory standards:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {COLOR_REFERENCE.map((anchor) => (
                  <div
                    key={anchor.ppm}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '24px',
                        borderRadius: '4px',
                        background: anchor.hex,
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        flexShrink: 0
                      }}
                    />
                    <strong style={{ width: '65px', fontSize: '0.85rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {anchor.ppm} ppm
                    </strong>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-primary)', flex: 1 }}>
                      {anchor.standard}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {anchor.hex}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Environmental & TWA */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div
                  className="glass-card"
                  style={{
                    padding: '16px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    background: 'rgba(16, 185, 129, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '8px' }}>
                    <ThermometerSun size={18} />
                    <strong style={{ fontSize: '0.9rem' }}>Valid Operating Envelope</strong>
                  </div>
                  <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '18px', lineHeight: 1.5 }}>
                    <li>Temperature: <strong>{VALID_TEMP_RANGE_C.min}°C – {VALID_TEMP_RANGE_C.max}°C</strong></li>
                    <li>Humidity: <strong>{VALID_RH_RANGE_PCT.min}% – {VALID_RH_RANGE_PCT.max}% RH</strong></li>
                    <li>Automatic ±5% derating near envelope boundary</li>
                  </ul>
                </div>

                <div
                  className="glass-card"
                  style={{
                    padding: '16px',
                    border: '1px solid rgba(249, 115, 22, 0.3)',
                    background: 'rgba(249, 115, 22, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f97316', marginBottom: '8px' }}>
                    <AlertTriangle size={18} />
                    <strong style={{ fontSize: '0.9rem' }}>Out-of-Range Flags</strong>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    If ambient conditions exceed ratings (&gt;50°C or &lt;10% RH), readings are marked with lower confidence and flagged for supervisor review.
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{ fontSize: '1.4rem' }}>🧮</div>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block' }}>
                    Standard Industrial 8-Hour TWA Formula
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    TWA = Σ(Cᵢ × Tᵢ) / ΣTᵢ &nbsp;|&nbsp; Tested against ACGIH 1.0 ppm 8-hr limit
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Routine & Themes */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-card" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> Field Operator Routine
                  </h4>
                  <ol style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 1.5 }}>
                    <li>Attach wristband at shift start.</li>
                    <li>Scan badge at shift end using Mobile App.</li>
                    <li>Check alert level before leaving unit.</li>
                  </ol>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--accent-emerald)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileCheck2 size={16} /> Safety Supervisor Routine
                  </h4>
                  <ol style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 1.5 }}>
                    <li>Review Fleet Overview for red alarms.</li>
                    <li>Investigate individual worker history.</li>
                    <li>Export DGMS statutory log (Ctrl + P).</li>
                  </ol>
                </div>
              </div>

              {/* Theme Customizer Preview */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
                    Theme Flexibility
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Currently using: <strong style={{ color: 'var(--accent-cyan)' }}>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</strong>
                  </span>
                </div>

                <button className="theme-toggle-btn" onClick={onToggleTheme}>
                  {isDarkMode ? <Sun size={15} color="#eab308" /> : <Moon size={15} color="#6366f1" />}
                  <span>Switch to {isDarkMode ? 'Light' : 'Dark'} Mode</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          {/* Progress Indicators */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentStep(idx)}
                style={{
                  width: idx === currentStep ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: idx === currentStep ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {currentStep > 0 && (
              <button className="btn-secondary" onClick={handlePrev} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <ChevronLeft size={16} /> Previous
              </button>
            )}

            <button className="btn-primary" onClick={handleNext} style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
              {currentStep < STEPS.length - 1 ? (
                <>
                  Next <ChevronRight size={16} />
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Get Started
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
