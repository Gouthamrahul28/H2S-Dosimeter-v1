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
  Sun,
  Moon,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { COLOR_REFERENCE, ALERT_LEVELS } from '@shared/colorimetricStandards';

export default function MobileOnboardingModal({ isOpen, onClose, isDarkMode, onToggleTheme }) {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const SLIDES = [
    {
      title: 'H₂S Dosimeter Guide',
      subtitle: 'Passive Colorimetric Wristband (SIH26118 / MRPL)',
      badge: 'Step 1 of 4 • Welcome'
    },
    {
      title: 'Camera Alignment Reticle',
      subtitle: 'Position your badge within the viewfinder guide',
      badge: 'Step 2 of 4 • Photo Capture'
    },
    {
      title: '7-Stage Chemical Scale',
      subtitle: 'From baseline clean matrix to emergency evacuation',
      badge: 'Step 3 of 4 • Safety Alert Ladder'
    },
    {
      title: 'Operating Rules & Actions',
      subtitle: 'Shift logging and emergency protocol',
      badge: 'Step 4 of 4 • Field Protocol'
    }
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: '700', color: 'var(--accent-cyan)', background: 'rgba(6, 182, 212, 0.1)', padding: '3px 8px', borderRadius: 'var(--radius-full)', marginBottom: '6px' }}>
              <Sparkles size={13} />
              <span>{SLIDES[step].badge}</span>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {SLIDES[step].title}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {SLIDES[step].subtitle}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Slide Body */}
        <div style={{ minHeight: '260px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                  border: '1px solid var(--border-active)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <ShieldCheck size={24} color="#ffffff" />
                </div>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                    Zero-Battery Wearable Sensor
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: 'block' }}>
                    Your wristband darkens permanently as it absorbs H₂S gas throughout your shift.
                  </span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', display: 'block', marginBottom: '4px' }}>
                  💡 Dynamic Lighting Protection
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: 'block' }}>
                  The app uses the printed white reference patch to cancel out lighting tints from warm sodium refinery lamps and shadows!
                </span>
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: isDarkMode ? '#0f172a' : '#e2e8f0',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ background: '#ffffff', border: '1px solid #38bdf8', padding: '6px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', color: '#0f172a' }}>
                    1. REF (WHITE)
                  </div>
                  <div style={{ background: '#e2e8f0', border: '1px solid #cbd5e1', padding: '6px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', color: '#334155' }}>
                    3. EXPIRY
                  </div>
                </div>

                <div style={{ margin: '8px auto', width: '70%', background: '#847e6c', border: '2px solid #0284c7', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ffffff' }}>
                    2. ACTIVE H₂S STRIP
                  </span>
                </div>
              </div>

              <ol style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 1.5, margin: 0 }}>
                <li>Hold camera 15–25 cm above wristband.</li>
                <li>Align badge inside on-screen reticles.</li>
                <li>Tap capture button to process exposure.</li>
              </ol>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {COLOR_REFERENCE.slice(0, 5).map((ref) => (
                <div
                  key={ref.ppm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ width: '24px', height: '18px', borderRadius: '4px', background: ref.hex, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  <strong style={{ width: '55px', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {ref.ppm} ppm
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', flex: 1 }}>
                    {ref.standard}
                  </span>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '6px' }}>
                  <AlertTriangle size={18} />
                  <strong style={{ fontSize: '0.85rem' }}>Immediate Action Protocol</strong>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                  If your reading shows <strong style={{ color: '#ef4444' }}>ALERT, DANGER or SEVERE</strong>, notify your area safety officer immediately and verify ambient ventilation.
                </p>
              </div>

              {/* Theme switch in modal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Theme Preference:</span>
                <button
                  onClick={onToggleTheme}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-full)',
                    padding: '4px 10px',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {isDarkMode ? <Sun size={13} color="#eab308" /> : <Moon size={13} color="#6366f1" />}
                  <span>{isDarkMode ? 'Light' : 'Dark'} Mode</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {SLIDES.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setStep(idx)}
                style={{
                  width: idx === step ? '18px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: idx === step ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button className="btn-secondary" onClick={() => setStep(step - 1)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                <ChevronLeft size={14} /> Back
              </button>
            )}

            <button
              className="btn-primary"
              onClick={() => (step < SLIDES.length - 1 ? setStep(step + 1) : onClose())}
              style={{ padding: '6px 16px', fontSize: '0.8rem', minHeight: '36px', width: 'auto' }}
            >
              {step < SLIDES.length - 1 ? (
                <>
                  Next <ChevronRight size={14} />
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Done
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
