import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Shield, Info } from 'lucide-react';
import CameraCapture from '../components/CameraCapture';
import { submitReading } from '../services/api';

const PROCESSING_STEPS = [
  'Capturing optical frame...',
  'Extracting RGB from Reference & Strip zones...',
  'Applying chromatic lighting normalization...',
  'Calculating cumulative ppm·hours...'
];

export default function CaptureScreen({ workerData, onBack, onComplete }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);

  const handleCapture = async ({ imageBase64, ambientTemp, ambientHumidity }) => {
    setError(null);
    setIsProcessing(true);
    setProcessingStep(0);

    const payload = {
      workerId: workerData.workerId,
      shiftId: workerData.shiftId,
      imageBase64,
      ambientTemp,
      ambientHumidity,
      capturedAt: new Date().toISOString()
    };
    setLastPayload(payload);

    // Step animation ticker
    const stepInterval = setInterval(() => {
      setProcessingStep((prev) => (prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev));
    }, 450);

    try {
      const result = await submitReading(payload);
      clearInterval(stepInterval);
      setIsProcessing(false);
      onComplete(result, workerData);
    } catch (err) {
      clearInterval(stepInterval);
      setIsProcessing(false);
      console.error('Reading submission error:', err);
      setError(err.message || 'Failed to submit reading. Check backend connection.');
    }
  };

  const handleRetry = () => {
    if (lastPayload) {
      handleCapture(lastPayload);
    } else {
      setError(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', position: 'relative' }}>
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button
          onClick={onBack}
          disabled={isProcessing}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f8fafc',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#f8fafc' }}>
            {workerData.workerId} &bull; {workerData.shiftId}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {workerData.workerName} ({workerData.department})
          </div>
        </div>

        <div style={{ width: '38px' }} />
      </div>

      {/* Main Camera Viewfinder Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <CameraCapture onCapture={handleCapture} isProcessing={isProcessing} />
      </div>

      {/* Processing Modal Overlay */}
      {isProcessing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(11, 15, 25, 0.88)',
            backdropFilter: 'blur(10px)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '2px solid #06b6d4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 0 30px rgba(6, 182, 212, 0.4)'
            }}
          >
            <RefreshCw size={36} color="#38bdf8" className="animate-spin" />
          </div>

          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', marginBottom: '8px' }}>
            Processing Wristband
          </h3>

          <p style={{ fontSize: '0.85rem', color: '#38bdf8', marginBottom: '24px', textAlign: 'center', minHeight: '24px' }}>
            {PROCESSING_STEPS[processingStep]}
          </p>

          <div style={{ width: '80%', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${((processingStep + 1) / PROCESSING_STEPS.length) * 100}%`,
                background: 'linear-gradient(90deg, #0284c7, #06b6d4)',
                transition: 'width 0.4s ease'
              }}
            />
          </div>
        </div>
      )}

      {/* Error Alert Modal */}
      {error && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            right: '16px',
            background: 'rgba(244, 63, 94, 0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid #fda4af',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            zIndex: 40,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertCircle size={24} color="#ffffff" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', color: '#ffffff', fontSize: '0.95rem', marginBottom: '4px' }}>
                Capture Processing Failed
              </strong>
              <p style={{ color: '#ffe4e6', fontSize: '0.8rem', lineHeight: '1.4' }}>
                {error}
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  onClick={handleRetry}
                  style={{
                    background: '#ffffff',
                    color: '#e11d48',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Retry Upload
                </button>
                <button
                  onClick={() => setError(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
