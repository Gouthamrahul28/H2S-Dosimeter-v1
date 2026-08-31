import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

/**
 * ThresholdBadge
 * 
 * Reusable compliance status pill dynamically styled based on API threshold values.
 */
export default function ThresholdBadge({ totalDosePpmHours = 0, thresholdPpmHours = 80, overThreshold = false }) {
  const ratio = thresholdPpmHours > 0 ? totalDosePpmHours / thresholdPpmHours : 0;

  if (overThreshold || ratio >= 1.0) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '700',
          background: 'rgba(244, 63, 94, 0.15)',
          color: '#fb7185',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap'
        }}
      >
        <ShieldAlert size={14} />
        OVER LIMIT
      </span>
    );
  }

  if (ratio >= 0.75) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '700',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap'
        }}
      >
        <AlertTriangle size={14} />
        APPROACHING
      </span>
    );
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '700',
        background: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap'
      }}
    >
      <CheckCircle2 size={14} />
      SAFE
    </span>
  );
}
