import React from 'react';
import { Sparkles, ShieldCheck } from 'lucide-react';

/**
 * ReferencePatchOverlay
 * 
 * Standardized 3-zone targeting reticle (CIE 015 & ISO 17321-1):
 * - Top-Left: White Reference Standard Patch (10%-30%)
 * - Top-Right: Grey Neutral Reference Patch (70%-90%)
 * - Center: Active Chemical Sensing Strip (38%-62%)
 */
export default function ReferencePatchOverlay() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      {/* Outer Enclosure Frame */}
      <svg style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        <defs>
          <mask id="enclosure-viewfinder-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x="6%" y="6%" width="88%" height="88%" rx="16" fill="black" />
          </mask>
        </defs>

        <rect width="100%" height="100%" fill="rgba(3, 7, 18, 0.45)" mask="url(#enclosure-viewfinder-mask)" />

        {/* Boundary guide */}
        <rect
          x="6%"
          y="6%"
          width="88%"
          height="88%"
          rx="16"
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
      </svg>

      {/* Zone 1: White Reference Standard (Top-Left: 10%-30%) */}
      <div
        style={{
          position: 'absolute',
          left: '10%',
          top: '10%',
          width: '20%',
          height: '20%',
          border: '1.5px solid #ffffff',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          WHITE
        </span>
      </div>

      {/* Zone 2: Grey Neutral Reference (Top-Right: 70%-90%) */}
      <div
        style={{
          position: 'absolute',
          left: '70%',
          top: '10%',
          width: '20%',
          height: '20%',
          border: '1.5px solid #94a3b8',
          borderRadius: '4px',
          background: 'rgba(148, 163, 184, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ fontSize: '0.62rem', fontWeight: '800', color: '#94a3b8', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          GREY
        </span>
      </div>

      {/* Zone 3: Active H2S Chemical Strip (Center: 38%-62%) */}
      <div
        style={{
          position: 'absolute',
          left: '38%',
          top: '38%',
          width: '24%',
          height: '24%',
          border: '2px solid #06b6d4',
          borderRadius: '6px',
          background: 'rgba(6, 182, 212, 0.08)',
          boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ fontSize: '0.65rem', fontWeight: '900', color: '#38bdf8', letterSpacing: '0.05em', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          H₂S STRIP
        </span>
      </div>

      {/* Bottom Status Banner */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10
        }}
      >
        <span
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '999px',
            padding: '4px 12px',
            fontSize: '0.68rem',
            color: '#38bdf8',
            fontWeight: '700',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <ShieldCheck size={12} color="#38bdf8" />
          Controlled Enclosure Guide (ISO 17321-1)
        </span>
      </div>
    </div>
  );
}
