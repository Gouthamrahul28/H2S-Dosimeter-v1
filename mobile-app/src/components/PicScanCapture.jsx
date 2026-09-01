import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Maximize2,
  Activity,
  Zap,
  RotateCcw,
  Crop,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ReferencePatchOverlay from './ReferencePatchOverlay';
import { runMobileDiagnostics, NORMALIZED_ROIS, extractRoiStatistics } from '../services/mobileDiagnostics';
import { checkBackendHealth, getApiBaseUrl } from '../services/api';
import { Wifi, WifiOff } from 'lucide-react';

const MAX_PROCESS_SIZE = 1600;

export default function PicScanCapture({ onCapture, isProcessing }) {
  const takePhotoInputRef = useRef(null);
  const choosePhotoInputRef = useRef(null);
  const canvasRef = useRef(null);

  // State Machine: 'EMPTY' | 'IMAGE_SELECTED' | 'IMAGE_READY' | 'SCANNING' | 'ERROR'
  const [scanState, setScanState] = useState('EMPTY');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [decodedFrame, setDecodedFrame] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  // Backend Connectivity Telemetry
  const [backendHealth, setBackendHealth] = useState({ isConnected: true, status: 'CONNECTED', latencyMs: 18, url: getApiBaseUrl() });
  const [isTestingBackend, setIsTestingBackend] = useState(false);

  useEffect(() => {
    handleTestConnection();
  }, []);

  const handleTestConnection = async () => {
    setIsTestingBackend(true);
    const health = await checkBackendHealth();
    setBackendHealth(health);
    setIsTestingBackend(false);
  };

  // Environmental sensor parameters
  const [ambientTemp, setAmbientTemp] = useState(25.0);
  const [ambientHumidity, setAmbientHumidity] = useState(50.0);
  const [showSensorSettings, setShowSensorSettings] = useState(false);

  // Raw Image Test / Debug Inspector
  const [showDebugPipeline, setShowDebugPipeline] = useState(false);
  const [pipelineMetrics, setPipelineMetrics] = useState(null);

  // Manual ROI adjustment fallback
  const [customRoi, setCustomRoi] = useState(NORMALIZED_ROIS.strip);
  const [isAdjustingRoi, setIsAdjustingRoi] = useState(false);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /**
   * Central Image Processing Function:
   * File -> Object URL -> Decode -> Orientation -> Canvas (max 1600) -> ImageData
   */
  const processSelectedImage = async (file) => {
    if (!file) {
      setScanState('ERROR');
      setErrorMessage('NO_IMAGE: No file was selected.');
      return;
    }

    setScanState('IMAGE_SELECTED');
    setErrorMessage('');
    setErrorDetails('');
    setSelectedFile(file);

    // Revoke previous object URL if any
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    // Check for HEIC/HEIF support
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif') || fileType.includes('heic') || fileType.includes('heif');

    let objectUrl = null;
    try {
      objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    } catch (e) {
      setScanState('ERROR');
      setErrorMessage('CANVAS_FAILED: Failed to create Object URL for image file.');
      return;
    }

    try {
      let srcWidth = 0;
      let srcHeight = 0;
      let drawableSource = null;

      // 1. Attempt createImageBitmap with orientation handling
      if (typeof window.createImageBitmap === 'function' && !isHeic) {
        try {
          const bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
          srcWidth = bitmap.width;
          srcHeight = bitmap.height;
          drawableSource = bitmap;
        } catch (bitmapErr) {
          console.warn('[PicScan] createImageBitmap failed, falling back to HTMLImageElement:', bitmapErr);
        }
      }

      // 2. Fallback to HTMLImageElement + decode()
      if (!drawableSource) {
        const img = new Image();
        img.src = objectUrl;

        // Timeout promise to avoid infinite hang on corrupted files
        const decodePromise = new Promise((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to load image element.'));
          if (typeof img.decode === 'function') {
            img.decode().then(() => resolve(img)).catch(() => resolve(img)); // fallback if decode rejects but onload fires
          }
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Image decoding timed out after 8 seconds.')), 8000)
        );

        drawableSource = await Promise.race([decodePromise, timeoutPromise]);
        srcWidth = drawableSource.naturalWidth || drawableSource.width;
        srcHeight = drawableSource.naturalHeight || drawableSource.height;
      }

      // Validate dimensions
      if (!srcWidth || !srcHeight || srcWidth <= 0 || srcHeight <= 0) {
        throw new Error('INVALID_IMAGE: Image has zero or invalid natural dimensions.');
      }

      // 3. Downscale safely to MAX_PROCESS_SIZE preserving aspect ratio
      const scale = Math.min(1, MAX_PROCESS_SIZE / Math.max(srcWidth, srcHeight));
      const targetWidth = Math.round(srcWidth * scale);
      const targetHeight = Math.round(srcHeight * scale);

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        throw new Error('CANVAS_FAILED: Unable to create 2D canvas rendering context.');
      }

      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(drawableSource, 0, 0, targetWidth, targetHeight);

      // 4. Extract and verify ImageData
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const expectedBytes = targetWidth * targetHeight * 4;

      if (!imageData || !imageData.data || imageData.data.length !== expectedBytes) {
        throw new Error(`PIXEL_READ_FAILED: Expected ${expectedBytes} bytes, got ${imageData?.data?.length || 0}.`);
      }

      const orientation = targetHeight > targetWidth ? 'PORTRAIT' : 'LANDSCAPE';
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

      // 5. Sample metrics for Raw Image Test & Diagnostics
      const centerPixelIdx = (Math.floor(targetHeight / 2) * targetWidth + Math.floor(targetWidth / 2)) * 4;
      const centerPixelRGB = {
        r: imageData.data[centerPixelIdx],
        g: imageData.data[centerPixelIdx + 1],
        b: imageData.data[centerPixelIdx + 2]
      };

      const stripRoiStats = extractRoiStatistics(imageData, NORMALIZED_ROIS.strip);
      const whiteRoiStats = extractRoiStatistics(imageData, NORMALIZED_ROIS.white);

      setPipelineMetrics({
        sourceDimensions: `${srcWidth} × ${srcHeight}`,
        processingDimensions: `${targetWidth} × ${targetHeight}`,
        fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
        fileType: file.type || 'image/jpeg',
        orientation,
        centerPixel: centerPixelRGB,
        stripMedianRGB: stripRoiStats.meanRGB,
        whiteMedianRGB: whiteRoiStats.meanRGB,
        validPixels: stripRoiStats.validPixelCount,
        status: 'IMAGE PIPELINE WORKING (ImageData Verified)'
      });

      setDecodedFrame({
        imageBase64,
        imageData,
        width: targetWidth,
        height: targetHeight,
        orientation,
        sourceDimensions: `${srcWidth} × ${srcHeight}`,
        processedDimensions: `${targetWidth} × ${targetHeight}`
      });

      setScanState('IMAGE_READY');
    } catch (err) {
      console.error('[PicScan] processSelectedImage error:', err);
      setScanState('ERROR');
      if (isHeic) {
        setErrorMessage('UNSUPPORTED_FORMAT: HEIC/HEIF format is not supported by this browser.');
        setErrorDetails('Please retake the photo or select a JPG/PNG file.');
      } else {
        setErrorMessage(err.message || 'IMAGE_DECODE_FAILED: Could not decode selected photograph.');
        setErrorDetails('Please ensure the photo is not corrupted and retake under good lighting.');
      }
    }
  };

  // Trigger Scan on Decoded Image
  const handleExecuteScan = () => {
    if (!decodedFrame || scanState !== 'IMAGE_READY' || isProcessing) return;

    setScanState('SCANNING');
    const startTime = performance.now();

    try {
      const diag = runMobileDiagnostics({
        videoElement: null,
        imageData: decodedFrame.imageData,
        orientation: decodedFrame.orientation,
        startTimeMs: startTime
      });

      onCapture({
        imageBase64: decodedFrame.imageBase64,
        ambientTemp,
        ambientHumidity,
        diagnostics: diag
      });
    } catch (scanErr) {
      console.error('[PicScan] Scan execution error:', scanErr);
      setScanState('ERROR');
      setErrorMessage(`SCAN_FAILED: ${scanErr.message}`);
    }
  };

  const handleReset = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setScanState('EMPTY');
    setSelectedFile(null);
    setPreviewUrl(null);
    setDecodedFrame(null);
    setErrorMessage('');
    setErrorDetails('');
    setPipelineMetrics(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', gap: '12px' }}>
      {/* Hidden file inputs for Take Photo & Choose Photo */}
      <input
        type="file"
        ref={takePhotoInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0]) processSelectedImage(e.target.files[0]);
          e.target.value = ''; // Reset input to allow re-selecting same photo
        }}
      />
      <input
        type="file"
        ref={choosePhotoInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.[0]) processSelectedImage(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Backend Connectivity Status Bar (Prompt Req 8) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: backendHealth.isConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.1)',
          border: `1px solid ${backendHealth.isConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.3)'}`,
          borderRadius: '8px',
          fontSize: '0.72rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: backendHealth.isConnected ? '#10b981' : '#f43f5e' }}>
            {backendHealth.isConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>Backend: {backendHealth.isConnected ? 'CONNECTED' : 'NOT CONNECTED'}</span>
          </span>
          {backendHealth.isConnected && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.68rem' }}>
              ({backendHealth.latencyMs} ms)
            </span>
          )}
        </div>

        <button
          onClick={handleTestConnection}
          disabled={isTestingBackend}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-cyan)',
            fontSize: '0.7rem',
            fontWeight: '700',
            cursor: isTestingBackend ? 'not-allowed' : 'pointer',
            padding: '2px 4px',
            textDecoration: 'underline'
          }}
        >
          {isTestingBackend ? 'Checking...' : 'TEST CONNECTION'}
        </button>
      </div>

      {/* Main Preview Container */}
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
          minHeight: '260px',
          border: '1px solid var(--border-subtle)'
        }}
      >
        {/* State 1: EMPTY - Prompt to Take or Choose Photo */}
        {scanState === 'EMPTY' && (
          <div style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}
            >
              <Camera size={32} />
            </div>

            <div>
              <h4 style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: '800', marginBottom: '4px' }}>
                H₂S Dosimeter Pic Scan
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', maxWidth: '280px', margin: '0 auto', lineHeight: '1.4' }}>
                Take a photograph with your rear camera or select an existing photograph from your gallery to analyze H₂S exposure.
              </p>
            </div>

            {/* Input Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '300px' }}>
              <button
                className="btn-primary"
                onClick={() => takePhotoInputRef.current?.click()}
                style={{ flex: 1, padding: '12px 10px', fontSize: '0.85rem' }}
              >
                <Camera size={16} /> Take Photo
              </button>

              <button
                className="btn-secondary"
                onClick={() => choosePhotoInputRef.current?.click()}
                style={{ flex: 1, padding: '12px 10px', fontSize: '0.85rem' }}
              >
                <ImageIcon size={16} /> Choose Photo
              </button>
            </div>
          </div>
        )}

        {/* State 2: IMAGE_SELECTED - Decoding Spinner */}
        {scanState === 'IMAGE_SELECTED' && (
          <div style={{ textAlign: 'center', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={36} color="#38bdf8" className="animate-spin" />
            <h4 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>
              Decoding & Normalizing Photo...
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>
              Processing orientation & scaling to safe resolution
            </p>
          </div>
        )}

        {/* State 3: IMAGE_READY or SCANNING - Photo Preview with 3-Patch Overlay */}
        {(scanState === 'IMAGE_READY' || scanState === 'SCANNING') && previewUrl && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <img
              src={previewUrl}
              alt="Selected Wristband Preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
            />
            {/* 3-Patch Alignment Reticle */}
            <ReferencePatchOverlay />

            {/* Reset / Retake Button in Top Left */}
            <button
              onClick={handleReset}
              disabled={isProcessing}
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.72rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                zIndex: 20
              }}
            >
              <RotateCcw size={13} /> Retake
            </button>
          </div>
        )}

        {/* State 4: ERROR - Error Message Card */}
        {scanState === 'ERROR' && (
          <div style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f43f5e'
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <div>
              <h4 style={{ color: '#f43f5e', fontSize: '0.95rem', fontWeight: '800', marginBottom: '4px' }}>
                Image Processing Error
              </h4>
              <p style={{ color: '#f8fafc', fontSize: '0.78rem', fontWeight: '600', marginBottom: '4px' }}>
                {errorMessage}
              </p>
              {errorDetails && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', margin: 0 }}>
                  {errorDetails}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                className="btn-primary"
                onClick={() => takePhotoInputRef.current?.click()}
                style={{ padding: '10px 14px', fontSize: '0.8rem' }}
              >
                <Camera size={15} /> Retake Photo
              </button>
              <button
                className="btn-secondary"
                onClick={() => choosePhotoInputRef.current?.click()}
                style={{ padding: '10px 14px', fontSize: '0.8rem' }}
              >
                <ImageIcon size={15} /> Choose JPG/PNG
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Raw Image Test & Debug Inspector Toggle */}
      {pipelineMetrics && (
        <div style={{ marginTop: '2px' }}>
          <button
            onClick={() => setShowDebugPipeline(!showDebugPipeline)}
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: 'var(--text-secondary)',
              fontSize: '0.7rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={13} color="#06b6d4" />
              <span>TEST IMAGE PIPELINE (RAW TELEMETRY)</span>
            </div>
            {showDebugPipeline ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showDebugPipeline && (
            <div
              style={{
                marginTop: '6px',
                background: 'rgba(3, 7, 18, 0.95)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <strong style={{ color: '#38bdf8', marginBottom: '2px' }}>IMAGE TEST TELEMETRY</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Source Dimensions:</span>
                <span>{pipelineMetrics.sourceDimensions} ({pipelineMetrics.fileSizeMB} MB)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Processing Dimensions:</span>
                <span>{pipelineMetrics.processingDimensions}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Orientation:</span>
                <span>{pipelineMetrics.orientation}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Center Pixel:</span>
                <span>RGB({pipelineMetrics.centerPixel.r}, {pipelineMetrics.centerPixel.g}, {pipelineMetrics.centerPixel.b})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Strip Median RGB:</span>
                <span>RGB({pipelineMetrics.stripMedianRGB.r}, {pipelineMetrics.stripMedianRGB.g}, {pipelineMetrics.stripMedianRGB.b})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>White Median RGB:</span>
                <span>RGB({pipelineMetrics.whiteMedianRGB.r}, {pipelineMetrics.whiteMedianRGB.g}, {pipelineMetrics.whiteMedianRGB.b})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '4px' }}>
                <span>STATUS:</span>
                <strong>{pipelineMetrics.status}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Environmental Adjuster Drawer */}
      <div style={{ marginTop: '2px' }}>
        <button
          onClick={() => setShowSensorSettings(!showSensorSettings)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            padding: '2px'
          }}
        >
          <Sliders size={12} />
          <span>{showSensorSettings ? 'Hide Ambient Calibration' : 'Adjust Ambient Temp & Humidity'}</span>
        </button>

        {showSensorSettings && (
          <div className="glass-panel" style={{ marginTop: '6px', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
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
              style={{ width: '100%', accentColor: '#06b6d4', marginBottom: '8px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
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

      {/* Bottom Main Action Button */}
      <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
        {scanState === 'EMPTY' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn-primary"
              onClick={() => takePhotoInputRef.current?.click()}
              style={{ flex: 1, height: '52px', fontSize: '0.9rem', fontWeight: '800' }}
            >
              <Camera size={20} /> Take Photo
            </button>
            <button
              className="btn-secondary"
              onClick={() => choosePhotoInputRef.current?.click()}
              style={{ flex: 1, height: '52px', fontSize: '0.9rem', fontWeight: '800' }}
            >
              <ImageIcon size={20} /> Choose Photo
            </button>
          </div>
        )}

        {(scanState === 'IMAGE_READY' || scanState === 'SCANNING') && (
          <button
            onClick={handleExecuteScan}
            disabled={isProcessing || scanState !== 'IMAGE_READY'}
            style={{
              width: '100%',
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
              fontSize: '1rem',
              fontWeight: '900',
              letterSpacing: '0.04em',
              boxShadow: '0 4px 20px rgba(6, 182, 212, 0.4)',
              cursor: isProcessing ? 'not-allowed' : 'pointer'
            }}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                <span>SCANNING STRIP...</span>
              </>
            ) : (
              <>
                <Zap size={22} />
                <span>SCAN IMAGE</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
