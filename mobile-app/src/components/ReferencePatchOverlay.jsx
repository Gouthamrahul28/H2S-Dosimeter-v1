import React from 'react';

/**
 * ReferencePatchOverlay
 * 
 * Viewfinder HUD overlay displaying targeting guide boxes corresponding directly
 * to the backend color-extraction sampling zones:
 * - Top-Left: Color Reference Patch (10%-30%)
 * - Center: Active H2S Chemical Strip (38%-62%)
 * - Top-Right: Expiry / Shelf-Life Patch (70%-90%)
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
      {/* Outer Wristband Silhouette Guide */}
      <svg style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
        {/* Darkened mask outside wristband */}
        <defs>
          <mask id="viewfinder-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x="5%" y="6%" width="90%" height="88%" rx="24" fill="black" />
          </mask>
        </defs>

        <rect width="100%" height="100%" fill="rgba(11, 15, 25, 0.45)" mask="url(#viewfinder-mask)" />

        {/* Wristband Outer Frame Boundary */}
        <rect
          x="5%"
          y="6%"
          width="90%"
          height="88%"
          rx="24"
          fill="none"
          stroke="rgba(255, 255, 255, 0.25)"
          strokeWidth="2"
          strokeDasharray="6 6"
        />

        {/* Corner alignment brackets */}
        <path d="M 30 50 L 50 50 A 10 10 0 0 0 60 40 L 60 20" stroke="#06b6d4" strokeWidth="3" fill="none" />
        <path d="M 370 20 L 370 40 A 10 10 0 0 0 380 50 L 400 50" stroke="#06b6d4" strokeWidth="3" fill="none" />
      </svg>

      {/* Target Zone 1: Reference Standard Patch (Top-Left: 10%-30%) */}
      <div
        style={{
          position: 'absolute',
          left: '10%',
          top: '10%',
          width: '20%',
          height: '20%',
          border: '2px solid #ffffff',
          borderRadius: '8px',
          boxShadow: '0 0 10px rgba(255, 255, 255, 0.4)',
          background: 'rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px'
        }}
      >
        <span style={{ fontSize: '9px', fontWeight: '700', color: '#ffffff', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          REF PATCH
        </span>
        <span style={{ fontSize: '7px', color: '#cbd5e1', textAlign: 'center' }}>
          White Std
        </span>
      </div>

      {/* Target Zone 2: Expiry / Shelf-Life Patch (Top-Right: 70%-90%) */}
      <div
        style={{
          position: 'absolute',
          left: '70%',
          top: '10%',
          width: '20%',
          height: '20%',
          border: '2px dashed #f59e0b',
          borderRadius: '8px',
          boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)',
          background: 'rgba(245, 158, 11, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px'
        }}
      >
        <span style={{ fontSize: '9px', fontWeight: '700', color: '#fbbf24', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          EXPIRY
        </span>
        <span style={{ fontSize: '7px', color: '#fde68a', textAlign: 'center' }}>
          Shelf Patch
        </span>
      </div>

      {/* Target Zone 3: Active H2S Chemical Strip (Center: 38%-62%) */}
      <div
        style={{
          position: 'absolute',
          left: '38%',
          top: '38%',
          width: '24%',
          height: '24%',
          border: '2.5px solid #06b6d4',
          borderRadius: '10px',
          boxShadow: '0 0 16px rgba(6, 182, 212, 0.5), inset 0 0 8px rgba(6, 182, 212, 0.2)',
          background: 'rgba(6, 182, 212, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulseGlow 2.5s infinite ease-in-out'
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#06b6d4', marginBottom: '4px' }}></div>
        <span style={{ fontSize: '10px', fontWeight: '800', color: '#38bdf8', textAlign: 'center', letterSpacing: '0.04em', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
          H₂S STRIP
        </span>
        <span style={{ fontSize: '7px', color: '#e0f2fe', textAlign: 'center' }}>
          Center Target
        </span>
      </div>

      {/* Crosshair guide lines */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '5%',
        right: '5%',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.15) 70%, transparent)'
      }} />
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '6%',
        bottom: '6%',
        width: '1px',
        background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.15) 70%, transparent)'
      }} />

      {/* Floating Instructions Banner */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '6px 14px',
        borderRadius: '9999px',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#e2e8f0',
        fontSize: '0.75rem',
        fontWeight: '500',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
      }}>
        Align wristband within frame in good lighting
      </div>
    </div>
  );
}
