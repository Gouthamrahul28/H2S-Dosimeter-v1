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
      title: 'Cu-PAN H₂S Dosimeter Guide',
      subtitle: 'Passive Colorimetric Sensor Strip (SIH26118)',
      badge: 'Step 1 of 4 • Chemical Principle'
    },
    {
      title: 'Camera Alignment Reticle',
      subtitle: 'Position your badge within the viewfinder guide',
      badge: 'Step 2 of 4 • Photo Capture'
    },
    {
      title: 'Cu-PAN Color Progression',
      subtitle: 'Purple/Violet → Yellow/Orange Chemical Transition',
      badge: 'Step 3 of 4 • Optical Response'
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
                    Cu-PAN Colorimetric Sensing
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: 'block' }}>
                    Cu(II)-PAN complex reacts with gaseous H₂S to produce CuS and release H-PAN, transitioning visually from <strong>Purple/Violet to Yellow/Orange</strong>.
                  </span>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '14px' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', display: 'block', marginBottom: '4px' }}>
                  💡 Multi-Patch Chromatic Normalization
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: 'block' }}>
                  The app uses the printed White and Grey reference patches to cancel ambient illumination tints and normalize across varying smartphone camera sensors.
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
                  <div style={{ background: '#808080', border: '1px solid #cbd5e1', padding: '6px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800', color: '#ffffff' }}>
                    3. GREY REF
                  </div>
                </div>

                <div style={{ margin: '8px auto', width: '70%', background: '#8B4C94', border: '2px solid #0284c7', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#ffffff' }}>
                    2. ACTIVE Cu-PAN STRIP
                  </span>
                </div>
              </div>

              <ol style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: 1.5, margin: 0 }}>
                <li>Hold camera 15–25 cm perpendicular to badge.</li>
                <li>Ensure all 3 target zones are in focus.</li>
                <li>Tap capture to estimate cumulative dose in ppm·h.</li>
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
                  <strong style={{ width: '65px', fontSize: '0.78rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {ref.ppm} ppm·h
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
                <strong style={{ fontSize: '0.85rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <AlertTriangle size={16} /> DGMS Statutory Limit: 80 ppm·h
                </strong>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: 'block' }}>
                  Cumulative exposure exceeding 80 ppm·h requires immediate work cessation and medical evaluation under Indian DGMS regulations.
                </span>
              </div>

              <div className="glass-panel" style={{ padding: '12px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Scan at shift start (0.0 ppm·h baseline), mid-shift checkpoint, and shift completion to record continuous regulatory compliance.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            className="btn-secondary"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            style={{ padding: '8px 14px', fontSize: '0.8rem', opacity: step === 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {/* Dots Indicator */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {SLIDES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: i === step ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}
              />
            ))}
          </div>

          {step < SLIDES.length - 1 ? (
            <button
              className="btn-primary"
              onClick={() => setStep(step + 1)}
              style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={onClose}
              style={{ padding: '8px 14px', fontSize: '0.8rem' }}
            >
              Get Started <CheckCircle2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
