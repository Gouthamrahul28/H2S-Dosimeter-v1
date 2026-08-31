import React, { useRef, useState, useEffect } from 'react';
import { Camera, SwitchCamera, Zap, Image as ImageIcon, RefreshCw, AlertCircle, Sliders } from 'lucide-react';
import ReferencePatchOverlay from './ReferencePatchOverlay';

/**
 * CameraCapture
 * 
 * Reusable viewfinder component supporting getUserMedia, frame grab,
 * fallback synthetic sample generation, and ambient sensor controls.
 */
export default function CameraCapture({ onCapture, isProcessing }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' or 'user'
  const [cameraError, setCameraError] = useState(null);
  const [flashOn, setFlashOn] = useState(false);
  const [hasFlashSupport, setHasFlashSupport] = useState(false);
  const [ambientTemp, setAmbientTemp] = useState(32.5);
  const [ambientHumidity, setAmbientHumidity] = useState(61);
  const [showSensorSettings, setShowSensorSettings] = useState(false);

  // Initialize camera stream
  useEffect(() => {
    let currentStream = null;

    async function initCamera() {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API (getUserMedia) not supported in this browser');
        }

        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }

        const constraints = {
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Check torch support
        const track = mediaStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        setHasFlashSupport(!!capabilities.torch);
      } catch (err) {
        console.warn('[CameraCapture] Camera initialization error:', err.message);
        setCameraError(err.message || 'Camera permission denied or camera unavailable');
      }
    }

    initCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraFacing]);

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
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  // Toggle front/rear camera
  const switchCamera = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture image from video stream
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);
    onCapture({
      imageBase64,
      ambientTemp,
      ambientHumidity
    });
  };

  // Handle local file upload fallback
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const imageBase64 = uploadEvent.target?.result;
      if (imageBase64) {
        onCapture({
          imageBase64,
          ambientTemp,
          ambientHumidity
        });
      }
    };
    reader.readAsDataURL(file);
  };

  // Generate synthetic dosimeter test frame (for rapid field testing without physical wristband)
  const generateSimulatedCapture = (exposureLevel = 'moderate') => {
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    // Background wristband
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 640, 480);
    ctx.fillStyle = '#334155';
    ctx.roundRect(30, 30, 580, 420, 20);
    ctx.fill();

    // Top-Left: Reference patch (white standard)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(64, 48, 128, 96);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('REF (WHITE)', 90, 100);

    // Top-Right: Expiry patch (shelf indicator)
    ctx.fillStyle = exposureLevel === 'expired' ? '#64748b' : '#e2e8f0';
    ctx.fillRect(448, 48, 128, 96);
    ctx.fillStyle = '#334155';
    ctx.fillText('EXPIRY', 485, 100);

    // Center: Active H2S Strip
    let stripColor = '#8b5cf6'; // moderate purple/dark
    if (exposureLevel === 'high') stripColor = '#3b0764'; // dark exposed
    if (exposureLevel === 'low') stripColor = '#c4b5fd';  // light violet

    ctx.fillStyle = stripColor;
    ctx.fillRect(243, 182, 154, 115);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('H2S STRIP', 290, 245);

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);
    onCapture({
      imageBase64,
      ambientTemp,
      ambientHumidity
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Main Viewfinder Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '3/4',
          maxHeight: '52vh',
          background: '#030712',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Live Video Preview */}
        {!cameraError ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.9)'
            }}
          >
            <AlertCircle size={44} color="#f59e0b" style={{ marginBottom: '12px' }} />
            <h4 style={{ color: '#f8fafc', fontSize: '1rem', marginBottom: '6px' }}>Camera Preview Unavailable</h4>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '18px', maxWidth: '280px' }}>
              {cameraError}
            </p>
            <button
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: '0.85rem', padding: '8px 16px', minHeight: '40px' }}
            >
              <ImageIcon size={16} /> Choose Photo from Gallery
            </button>
          </div>
        )}

        {/* Reticle Overlay Guide */}
        <ReferencePatchOverlay />

        {/* Viewfinder Top Controls Overlay */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10
          }}
        >
          <button
            onClick={() => setShowSensorSettings(!showSensorSettings)}
            style={{
              background: showSensorSettings ? 'var(--accent-cyan)' : 'rgba(15, 23, 42, 0.75)',
              color: showSensorSettings ? '#0f172a' : '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)'
            }}
          >
            <Sliders size={14} />
            <span>{ambientTemp}°C | {ambientHumidity}% RH</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {hasFlashSupport && (
              <button
                onClick={toggleFlash}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: flashOn ? '#eab308' : 'rgba(15, 23, 42, 0.75)',
                  color: flashOn ? '#0f172a' : '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)'
                }}
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
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)'
              }}
              title="Flip camera"
            >
              <SwitchCamera size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Sensor Adjusters Drawer */}
      {showSensorSettings && (
        <div className="glass-panel" style={{ marginTop: '10px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ambient Temperature:</span>
            <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{ambientTemp} °C</strong>
          </div>
          <input
            type="range"
            min="10"
            max="50"
            step="0.5"
            value={ambientTemp}
            onChange={(e) => setAmbientTemp(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4', marginBottom: '12px' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Relative Humidity:</span>
            <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>{ambientHumidity} %</strong>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="1"
            value={ambientHumidity}
            onChange={(e) => setAmbientHumidity(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#06b6d4' }}
          />
        </div>
      )}

      {/* Bottom Shutter Action Bar */}
      <div
        style={{
          marginTop: 'auto',
          padding: '16px 0 8px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Gallery Upload Button */}
          <button
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
            title="Upload from gallery"
          >
            <ImageIcon size={18} /> Gallery
          </button>

          {/* Main Shutter Button */}
          <button
            onClick={captureFrame}
            disabled={isProcessing}
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              border: '4px solid #ffffff',
              boxShadow: '0 0 24px rgba(6, 182, 212, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              transition: 'transform 0.15s ease',
              transform: isProcessing ? 'scale(0.95)' : 'scale(1)'
            }}
          >
            {isProcessing ? (
              <RefreshCw size={28} className="animate-spin" />
            ) : (
              <Camera size={32} />
            )}
          </button>

          {/* Test Pattern Simulator */}
          <button
            className="btn-secondary"
            onClick={() => generateSimulatedCapture('moderate')}
            disabled={isProcessing}
            style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
            title="Generate test frame"
          >
            🧪 Test Frame
          </button>
        </div>

        {/* Quick Simulated Exposure Presets (Helpful for quick demonstration) */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            onClick={() => generateSimulatedCapture('low')}
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer'
            }}
          >
            Simulate Safe Dose
          </button>
          <button
            onClick={() => generateSimulatedCapture('high')}
            style={{
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fb7185',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.72rem',
              cursor: 'pointer'
            }}
          >
            Simulate Over-Threshold
          </button>
        </div>
      </div>
    </div>
  );
}
