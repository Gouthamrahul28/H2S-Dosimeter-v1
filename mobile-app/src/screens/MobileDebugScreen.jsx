import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Activity,
  Cpu,
  RefreshCw,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import {
  startCameraStream,
  stopCameraStream,
  captureFrameFromVideo,
  checkCameraSupport
} from '../services/cameraService';
import { runMobileDiagnostics, NORMALIZED_ROIS } from '../services/mobileDiagnostics';

export default function MobileDebugScreen({ onBack }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('environment');
  const [diagnostics, setDiagnostics] = useState(null);
  const [trackSettings, setTrackSettings] = useState({});
  const [trackCapabilities, setTrackCapabilities] = useState({});
  const [dpr, setDpr] = useState(1);
  const [windowDims, setWindowDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    setDpr(window.devicePixelRatio || 1);
    setWindowDims({ w: window.innerWidth, h: window.innerHeight });

    let activeStream = null;
    async function init() {
      try {
        const s = await startCameraStream(cameraFacing);
        activeStream = s;
        setStream(s);

        const track = s.getVideoTracks()[0];
        if (track) {
          setTrackSettings(track.getSettings ? track.getSettings() : {});
          setTrackCapabilities(track.getCapabilities ? track.getCapabilities() : {});
        }
      } catch (e) {
        console.warn('Debug stream init failed:', e);
      }
    }
    init();

    return () => {
      if (activeStream) stopCameraStream(activeStream);
    };
  }, [cameraFacing]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.warn);
    }
  }, [stream]);

  const handleTestCapture = () => {
    if (!videoRef.current) return;
    try {
      const startTime = performance.now();
      const frame = captureFrameFromVideo(videoRef.current);
      const diag = runMobileDiagnostics({
        videoElement: videoRef.current,
        imageData: frame.imageData,
        orientation: frame.orientation,
        startTimeMs: startTime
      });
      setDiagnostics({ ...diag, frame });
    } catch (e) {
      alert(`Capture failed: ${e.message}`);
    }
  };

  const support = checkCameraSupport();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '8px',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: '800', letterSpacing: '0.08em' }}>
            DEVELOPER TELEMETRY
          </span>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>
            Mobile Camera Debug
          </h3>
        </div>

        <button
          onClick={() => setCameraFacing((p) => (p === 'environment' ? 'user' : 'environment'))}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '8px',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
          title="Flip Facing"
        >
          <Camera size={18} />
        </button>
      </div>

      {/* Hidden/Compact Video Window for testing */}
      <div style={{ height: '160px', borderRadius: '12px', overflow: 'hidden', background: '#000', position: 'relative' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <button
          onClick={handleTestCapture}
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            background: '#06b6d4',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '0.72rem',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          Sample Pixel Buffer
        </button>
      </div>

      {/* Device & Browser Environment Telemetry */}
      <div className="glass-panel" style={{ padding: '14px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
        <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '8px' }}>
          1. ENVIRONMENT & PLATFORM
        </strong>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Secure Origin:</span>
          <strong style={{ color: support.isSecure ? '#10b981' : '#f43f5e' }}>{support.isSecure ? 'HTTPS (TRUE)' : 'HTTP (INSECURE)'}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Device Pixel Ratio:</span>
          <span>{dpr}x</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Viewport Dims:</span>
          <span>{windowDims.w} × {windowDims.h} px</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Facing Mode:</span>
          <span>{cameraFacing.toUpperCase()}</span>
        </div>
      </div>

      {/* Video Track Stream Capabilities */}
      <div className="glass-panel" style={{ padding: '14px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
        <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '8px' }}>
          2. HARDWARE SENSOR & STREAM TRACK
        </strong>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Sensor Native Res:</span>
          <span>{trackSettings.width ? `${trackSettings.width} × ${trackSettings.height}` : 'STANDBY'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Frame Rate:</span>
          <span>{trackSettings.frameRate ? `${Math.round(trackSettings.frameRate)} FPS` : 'DYNAMIC'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Torch Support:</span>
          <strong style={{ color: trackCapabilities.torch ? '#10b981' : '#94a3b8' }}>
            {trackCapabilities.torch ? 'AVAILABLE' : 'UNAVAILABLE'}
          </strong>
        </div>
      </div>

      {/* Frame Capture & Normalized ROI Telemetry */}
      {diagnostics && (
        <div className="glass-panel" style={{ padding: '14px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
          <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '8px' }}>
            3. NORMALIZED ROI & PIXEL EXTRACTION
          </strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Processing Res:</span>
            <span>{diagnostics.frame?.processedDimensions}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Orientation:</span>
            <span>{diagnostics.frame?.orientation}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>White ROI (10%-30%):</span>
            <span>RGB({diagnostics.whiteRoi?.meanRGB?.r}, {diagnostics.whiteRoi?.meanRGB?.g}, {diagnostics.whiteRoi?.meanRGB?.b})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Strip ROI (38%-62%):</span>
            <span>RGB({diagnostics.stripRoi?.meanRGB?.r}, {diagnostics.stripRoi?.meanRGB?.g}, {diagnostics.stripRoi?.meanRGB?.b})</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Processing Latency:</span>
            <strong style={{ color: '#10b981' }}>{diagnostics.durationMs} ms (&lt; 2000ms target)</strong>
          </div>
        </div>
      )}
    </div>
  );
}
