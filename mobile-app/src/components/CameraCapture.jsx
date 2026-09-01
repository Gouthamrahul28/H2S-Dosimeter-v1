import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  SwitchCamera,
  Zap,
  Image as ImageIcon,
  RefreshCw,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  XCircle,
  Activity,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Cpu
} from 'lucide-react';
import ReferencePatchOverlay from './ReferencePatchOverlay';
import {
  startCameraStream,
  stopCameraStream,
  captureFrameFromVideo,
  normalizeImageFile,
  checkCameraSupport
} from '../services/cameraService';
import { runMobileDiagnostics } from '../services/mobileDiagnostics';

export default function CameraCapture({ onCapture, isProcessing }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' | 'user'
  const [cameraError, setCameraError] = useState(null);
  const [hasFlashSupport, setHasFlashSupport] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Environmental inputs (Arrhenius kinetic compensation)
  const [ambientTemp, setAmbientTemp] = useState(25.0);
  const [ambientHumidity, setAmbientHumidity] = useState(50.0);
  const [showSensorSettings, setShowSensorSettings] = useState(false);

  // Live Mobile Diagnostics Overlay State
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState(null);

  const supportCheck = checkCameraSupport();

  // Initialize camera stream
  const initCamera = async () => {
    setCameraError(null);
    setIsInitializing(true);

    try {
      if (stream) {
        stopCameraStream(stream);
      }

      const mediaStream = await startCameraStream(cameraFacing);
      setStream(mediaStream);

      // Check torch capability
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      setHasFlashSupport(!!capabilities.torch);
    } catch (err) {
      console.warn('[CameraCapture] Camera initialization error:', err.message);
      setCameraError(err.message || 'Camera access error');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initCamera();
    return () => {
      if (stream) {
        stopCameraStream(stream);
      }
    };
  }, [cameraFacing]);

  // Attach stream to videoRef and play explicitly (Safari iOS compatibility)
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((playErr) => {
        console.warn('[CameraCapture] Autoplay prevented on iOS/Android, user interaction needed:', playErr);
      });
    }
  }, [stream]);

  // Flip camera (Rear <-> Front)
  const switchCamera = () => {
    if (stream) {
      stopCameraStream(stream);
    }
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Toggle flash/torch
  const toggleFlash = async () => {
    if (stream && hasFlashSupport) {
      try {
        const track = stream.getVideoTracks()[0];
        await track.applyConstraints({
          advanced: [{ torch: !flashOn }]
        });
        setFlashOn(!flashOn);
      } catch (e) {
        console.warn('[CameraCapture] Torch toggle error:', e);
      }
    }
  };

  // Capture Frame from Live Video Stream
  const handleCapture = () => {
    if (isProcessing) return;

    const startTime = performance.now();
    const video = videoRef.current;

    if (!video || !stream) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const frameData = captureFrameFromVideo(video);
      const diag = runMobileDiagnostics({
        videoElement: video,
        imageData: frameData.imageData,
        orientation: frameData.orientation,
        startTimeMs: startTime
      });
      setDiagnosticsData(diag);

      onCapture({
        imageBase64: frameData.imageBase64,
        ambientTemp,
        ambientHumidity,
        diagnostics: diag
      });
    } catch (err) {
      console.error('[CameraCapture] Frame capture error:', err.message);
      setCameraError(`Capture error: ${err.message}`);
    }
  };

  // Handle uploaded photo / native camera capture
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const startTime = performance.now();
    try {
      const frameData = await normalizeImageFile(file);
      const diag = runMobileDiagnostics({
        videoElement: null,
        imageData: frameData.imageData,
        orientation: frameData.orientation,
        startTimeMs: startTime
      });
      setDiagnosticsData(diag);

      onCapture({
        imageBase64: frameData.imageBase64,
        ambientTemp,
        ambientHumidity,
        diagnostics: diag
      });
    } catch (err) {
      console.error('[CameraCapture] File normalization error:', err.message);
      setCameraError(`Photo processing error: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Native file input for fallback mobile photo capture */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Main Viewfinder Window */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          background: '#030712',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '280px',
          border: '1px solid var(--border-subtle)'
        }}
      >
        {/* Insecure Origin Warning Banner */}
        {!supportCheck.isSecure && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              background: 'rgba(239, 68, 68, 0.92)',
              color: '#ffffff',
              padding: '10px 14px',
              borderRadius: '8px',
              zIndex: 30,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              backdropFilter: 'blur(8px)'
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Camera Access Requires HTTPS</strong>
              <div style={{ marginTop: '2px', opacity: 0.9 }}>
                Mobile browsers block live camera on insecure HTTP LAN IPs. Please use localhost, HTTPS tunneling, or tap <strong>Upload Photo / Native Camera</strong> below.
              </div>
            </div>
          </div>
        )}

        {/* Live Video Element with explicit iOS Safari attributes */}
        <video
          ref={videoRef}
          id="camera"
          autoPlay
          playsInline
          webkit-playsinline="true"
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: stream && !cameraError ? 'block' : 'none'
          }}
        />

        {/* 3-Patch Optical Alignment Reticle */}
        {stream && !cameraError && <ReferencePatchOverlay />}

        {/* Camera Inactive / Error Placeholder */}
        {(!stream || cameraError) && (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              zIndex: 10
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f43f5e'
              }}
            >
              <Camera size={30} />
            </div>

            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '700', marginBottom: '6px' }}>
                {cameraError ? 'Camera Access Required' : 'Live Camera Standby'}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', maxWidth: '280px', margin: '0 auto', lineHeight: '1.4' }}>
                {cameraError || 'Press START CAMERA to initialize live video or select a photo from your gallery.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                className="btn-primary"
                onClick={initCamera}
                disabled={isInitializing}
                style={{ padding: '10px 18px', fontSize: '0.82rem' }}
              >
                {isInitializing ? <RefreshCw size={16} className="animate-spin" /> : <Camera size={16} />}
                Start Camera
              </button>

              <button
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '10px 18px', fontSize: '0.82rem' }}
              >
                <ImageIcon size={16} /> Use Native Camera / File
              </button>
            </div>
          </div>
        )}

        {/* Top Viewfinder Control Badges */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            display: 'flex',
            gap: '8px',
            zIndex: 20
          }}
        >
          {hasFlashSupport && (
            <button
              onClick={toggleFlash}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: flashOn ? 'rgba(234, 179, 8, 0.85)' : 'rgba(15, 23, 42, 0.75)',
                color: flashOn ? '#000' : '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)'
              }}
              title="Toggle Torch"
            >
              <Zap size={16} />
            </button>
          )}

          <button
            onClick={switchCamera}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(15, 23, 42, 0.75)',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)'
            }}
            title="Switch Camera"
          >
            <SwitchCamera size={16} />
          </button>
        </div>
      </div>

      {/* Diagnostics HUD Toggle */}
      <div style={{ marginTop: '8px' }}>
        <button
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'var(--text-secondary)',
            fontSize: '0.72rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={14} color="#06b6d4" />
            <span>MOBILE DIAGNOSTICS PANEL</span>
          </div>
          {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showDiagnostics && (
          <div
            style={{
              marginTop: '6px',
              background: 'rgba(3, 7, 18, 0.95)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <strong style={{ color: '#38bdf8', marginBottom: '2px', display: 'block' }}>
              MOBILE DIAGNOSTICS & TELEMETRY
            </strong>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Camera Stream:</span>
              <strong style={{ color: stream ? '#10b981' : '#f43f5e' }}>{stream ? 'PASS' : 'INACTIVE'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Secure Context:</span>
              <strong style={{ color: supportCheck.isSecure ? '#10b981' : '#f43f5e' }}>{supportCheck.isSecure ? 'PASS (HTTPS)' : 'FAIL (HTTP)'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Video Dimensions:</span>
              <span>{videoRef.current?.videoWidth ? `${videoRef.current.videoWidth} × ${videoRef.current.videoHeight}` : 'STANDBY'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pixel Extraction:</span>
              <strong style={{ color: diagnosticsData?.overallPassed ? '#10b981' : '#94a3b8' }}>
                {diagnosticsData?.overallPassed ? 'PASS' : 'READY TO CAPTURE'}
              </strong>
            </div>

            {diagnosticsData?.steps && (
              <div style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {diagnosticsData.steps.map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: step.status === 'PASS' ? '#10b981' : step.status === 'FAIL' ? '#f43f5e' : '#f59e0b' }}>
                    <span>{step.name}:</span>
                    <span>{step.status} ({step.details})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Environmental Adjuster Drawer Toggle */}
      <div style={{ marginTop: '6px' }}>
        <button
          onClick={() => setShowSensorSettings(!showSensorSettings)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.72rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <Sliders size={12} />
          <span>{showSensorSettings ? 'Hide Ambient Calibration' : 'Adjust Ambient Temp & Humidity'}</span>
        </button>

        {showSensorSettings && (
          <div className="glass-panel" style={{ marginTop: '6px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span>Ambient Temp:</span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{ambientTemp} °C</strong>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="0.5"
              value={ambientTemp}
              onChange={(e) => setAmbientTemp(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#06b6d4', marginBottom: '10px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span>Relative Humidity:</span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{ambientHumidity} % RH</strong>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              step="1"
              value={ambientHumidity}
              onChange={(e) => setAmbientHumidity(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: '#06b6d4' }}
            />
          </div>
        )}
      </div>

      {/* Tactile Capture Shutter Bar */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        {/* Upload / Gallery Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Upload image / native camera"
        >
          <ImageIcon size={20} />
        </button>

        {/* Big Shutter Button */}
        <button
          onClick={handleCapture}
          disabled={isProcessing}
          style={{
            flex: 1,
            height: '56px',
            borderRadius: '999px',
            background: isProcessing
              ? 'rgba(6, 182, 212, 0.4)'
              : 'linear-gradient(135deg, #0284c7, #06b6d4)',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '0.95rem',
            fontWeight: '800',
            letterSpacing: '0.04em',
            boxShadow: '0 4px 20px rgba(6, 182, 212, 0.4)',
            cursor: isProcessing ? 'not-allowed' : 'pointer'
          }}
        >
          {isProcessing ? (
            <>
              <RefreshCw size={20} className="animate-spin" />
              <span>ANALYZING STRIP...</span>
            </>
          ) : (
            <>
              <Camera size={22} />
              <span>CAPTURE STRIP</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
