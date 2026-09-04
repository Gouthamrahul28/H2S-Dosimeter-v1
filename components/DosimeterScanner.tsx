'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Flashlight,
  Upload,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  Info,
  Check,
  Eye
} from 'lucide-react';
import {
  segmentConcentricFiducial,
  filterAndComputeMedianRGB,
  evaluateLeadAcetateExposure,
  ColorimetryResult,
} from '@/lib/colorimetry';
import { LEAD_ACETATE_CALIBRATION_ANCHORS, CalibrationAnchor } from '@/lib/calibrationData';

interface DosimeterScannerProps {
  onScanComplete: (result: ColorimetryResult) => void;
  isProcessing?: boolean;
}

/**
 * Utility to generate a realistic simulated Lead(II) Acetate chemocassette badge
 * with outer BaSO4 white reference ring and central reactive paper disk.
 */
function generateSimulatedBadgeDataUrl(sampleHex: string, sampleLabel: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background workbench texture
  const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = Math.min(canvas.width, canvas.height) * 0.35;

  // Chemocassette plastic housing
  ctx.fillStyle = '#f8fafc';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.roundRect(cx - r * 1.25, cy - r * 1.35, r * 2.5, r * 2.7, 32);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Header banner on badge
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.roundRect(cx - r * 1.25, cy - r * 1.35, r * 2.5, 48, [32, 32, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('H2S-SAFETRACK • Pb(Ac)2 CASSETTE', cx, cy - r * 1.35 + 32);

  // Outer reference white ring (0.70 R to 0.95 R)
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.95, 0, 2 * Math.PI);
  ctx.fillStyle = '#FAF7F0'; // Standard reference white
  ctx.fill();

  // Reference ring inner bevel
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.65, 0, 2 * Math.PI);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();

  // Inner active Lead(II) Acetate paper disk (r < 0.45 R)
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, 2 * Math.PI);
  ctx.fillStyle = sampleHex;
  ctx.fill();

  // Subtle paper grain effect
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Cassette identification code
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`SERIAL: PB-2026-${sampleLabel.replace(/[^0-9]/g, '').padStart(3, '0')}`, cx, cy + r * 1.15);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export const DosimeterScanner: React.FC<DosimeterScannerProps> = ({
  onScanComplete,
  isProcessing = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);
  const [lightingStatus, setLightingStatus] = useState<'OPTIMAL' | 'GLARE' | 'LOW_LIGHT'>('OPTIMAL');
  const [selectedAnchorPreset, setSelectedAnchorPreset] = useState<CalibrationAnchor | null>(null);

  // Dedicated captured image state for the Review & Alignment panel
  const [capturedImageSrc, setCapturedImageSrc] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false);

  // Initialize Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setStream(mediaStream);
      setCameraActive(true);

      // Check for torch capability
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities = (track.getCapabilities && track.getCapabilities()) as any;
        if (capabilities && capabilities.torch) {
          setTorchSupported(true);
        }
      }
    } catch (err: any) {
      console.warn('[Camera] Live camera initialization standby:', err);
      setCameraError(err.message || 'Camera standby. Please use photo upload or a pre-calibrated test swatch.');
      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setCameraActive(false);
      setTorchOn(false);
    }
  }, [stream]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const previewPpm = params.get('previewPpm');
      if (previewPpm !== null) {
        const anchor = LEAD_ACETATE_CALIBRATION_ANCHORS.find(
          (a) => Math.abs(a.h2sPpm - parseFloat(previewPpm)) < 1.5
        ) || LEAD_ACETATE_CALIBRATION_ANCHORS[3];
        const simulatedDataUrl = generateSimulatedBadgeDataUrl(anchor.hex, `${anchor.h2sPpm}PPM`);
        setCapturedImageSrc(simulatedDataUrl);
        return;
      }
    }
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const newStatus = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: newStatus }],
        });
        setTorchOn(newStatus);
      } catch (err) {
        console.error('Failed to toggle torch:', err);
      }
    }
  };

  // Step 1: Capture current live video frame and transition to Review Panel
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Pause/stop camera and show preview panel
    setCapturedImageSrc(dataUrl);
    stopCamera();
  };

  // Step 2: File Upload via <input type="file"> and transition to Review Panel
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setCapturedImageSrc(dataUrl);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  // Step 3: Quick Calibration Swatch Simulation
  const handleSelectPreset = (anchor: CalibrationAnchor) => {
    setSelectedAnchorPreset(anchor);
    const simulatedDataUrl = generateSimulatedBadgeDataUrl(anchor.hex, `${anchor.h2sPpm}PPM`);
    setCapturedImageSrc(simulatedDataUrl);
    stopCamera();
  };

  // Step 4: Retake / Re-upload Photo
  const handleRetake = () => {
    setCapturedImageSrc(null);
    setSelectedAnchorPreset(null);
    startCamera();
  };

  // Step 5: Analyze Confirmed Image Frame
  const handleAnalyzeConfirmed = () => {
    if (!capturedImageSrc) return;
    setIsAnalyzingImage(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 800;
      canvas.height = img.height || 800;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsAnalyzingImage(false);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;

      const imageData = ctx.getImageData(0, 0, width, height);

      // 1. Concentric Fiducial Reticle Segmentation
      const { samplePixels, refWhitePixels } = segmentConcentricFiducial(
        imageData,
        centerX,
        centerY,
        radius
      );

      // 2. Glare and shadow rejection on both zones
      const sampleStats = filterAndComputeMedianRGB(samplePixels);
      const refWhiteStats = filterAndComputeMedianRGB(refWhitePixels);

      // 3. Environmental lighting evaluation
      if (sampleStats.glareRatio > 0.08 || refWhiteStats.glareRatio > 0.12) {
        setLightingStatus('GLARE');
      } else if (sampleStats.underexposedRatio > 0.30 || refWhiteStats.medianRGB.r < 100) {
        setLightingStatus('LOW_LIGHT');
      } else {
        setLightingStatus('OPTIMAL');
      }

      // 4. Colorimetric Metrology Pipeline with captured image source attached
      const result = evaluateLeadAcetateExposure(
        sampleStats.medianRGB,
        refWhiteStats.medianRGB,
        capturedImageSrc
      );

      setIsAnalyzingImage(false);
      onScanComplete(result);
    };

    img.src = capturedImageSrc;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto space-y-4">
      {/* ============================================================ */}
      {/* MODE A: REVIEW & FIDUCIAL ALIGNMENT PANEL (AFTER CAPTURE)    */}
      {/* ============================================================ */}
      {capturedImageSrc ? (
        <div className="w-full flex flex-col space-y-3">
          {/* Header Banner */}
          <div className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Scan Preview & Reticle Alignment
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">
              FRAME CAPTURED
            </span>
          </div>

          {/* Interactive Preview Viewport with Reticle Overlay */}
          <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden border-2 border-sky-500/80 shadow-[0_0_30px_rgba(14,165,233,0.3)]">
            <img
              src={capturedImageSrc}
              alt="Captured Dosimeter Badge"
              className="w-full h-full object-contain"
            />

            {/* Concentric Reticle Alignment Overlay on top of preview */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Outer Reference White Guide Ring */}
                <div className="absolute w-56 h-56 rounded-full border-4 border-dashed border-white shadow-[0_0_15px_rgba(255,255,255,0.6)] flex items-center justify-center">
                  <span className="absolute -top-6 text-[10px] font-mono tracking-wider font-bold bg-black/85 text-white px-2 py-0.5 rounded border border-white/50 shadow">
                    OUTER: REF WHITE RING
                  </span>
                </div>

                {/* Inner Active Pb(Ac)2 Disk Guide */}
                <div className="absolute w-28 h-28 rounded-full border-3 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.8)] flex items-center justify-center">
                  <span className="absolute -bottom-6 text-[10px] font-mono tracking-wider font-bold bg-black/85 text-amber-300 px-2 py-0.5 rounded border border-amber-400/50 shadow">
                    INNER: Pb(Ac)2 DISK
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                </div>

                {/* Crosshairs */}
                <div className="absolute w-full h-[1px] bg-white/30" />
                <div className="absolute h-full w-[1px] bg-white/30" />
              </div>
            </div>

            {/* Alignment Quality Badges */}
            <div className="absolute bottom-3 inset-x-3 pointer-events-none flex items-center justify-between">
              <span className="text-[10px] font-mono font-semibold text-slate-300 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" /> Outer Ring: White Reference
              </span>
              <span className="text-[10px] font-mono font-semibold text-slate-300 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1">
                <Check className="w-3 h-3 text-amber-400" /> Inner Ring: Reactive Patch
              </span>
            </div>
          </div>

          {/* Action Touch Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleRetake}
              disabled={isAnalyzingImage}
              className="py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 transition shadow flex items-center justify-center gap-2 active:scale-98"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              Retake Photo
            </button>

            <button
              onClick={handleAnalyzeConfirmed}
              disabled={isAnalyzingImage}
              className="py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-sky-400 hover:bg-sky-300 border border-sky-300 transition shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isAnalyzingImage ? 'Analyzing Metrology...' : 'Analyze Exposure'}
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* MODE B: LIVE CAMERA VIEWPORT & CONCENTRIC RETICLE HUD        */
        /* ============================================================ */
        <div className="w-full flex flex-col space-y-4">
          <div className="relative w-full aspect-[3/4] bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl">
            {cameraActive ? (
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center bg-slate-900/90">
                <AlertTriangle className="w-12 h-12 text-amber-400 mb-3" />
                <p className="text-sm font-semibold text-slate-200 mb-1">
                  Live Camera Standby
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  {cameraError || 'Allow camera permissions or select a pre-calibrated test swatch below.'}
                </p>
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-sky-300 bg-sky-950/80 border border-sky-600 rounded-lg hover:bg-sky-900 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                </button>
              </div>
            )}

            {/* Concentric Reticle Alignment HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-64 h-64 flex items-center justify-center">
                {/* Outer Reference White Guide Ring (0.70R - 0.95R) */}
                <div className="absolute w-56 h-56 rounded-full border-4 border-dashed border-white/80 animate-pulse-fast shadow-[0_0_15px_rgba(255,255,255,0.4)] flex items-center justify-center">
                  <span className="absolute -top-6 text-[10px] font-mono tracking-wider font-bold bg-black/75 text-white px-2 py-0.5 rounded border border-white/40">
                    OUTER: REF WHITE RING
                  </span>
                </div>

                {/* Inner Active Pb(Ac)2 Disk Guide (r < 0.45R) */}
                <div className="absolute w-28 h-28 rounded-full border-3 border-amber-400/90 shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-center">
                  <span className="absolute -bottom-6 text-[10px] font-mono tracking-wider font-bold bg-black/75 text-amber-300 px-2 py-0.5 rounded border border-amber-400/40">
                    INNER: Pb(Ac)2 DISK
                  </span>
                  <div className="w-2 h-2 rounded-full bg-amber-400/80" />
                </div>

                {/* Crosshair Guides */}
                <div className="absolute w-full h-[1px] bg-white/20" />
                <div className="absolute h-full w-[1px] bg-white/20" />
              </div>
            </div>

            {/* HUD Top Bar */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium backdrop-blur-md bg-black/60 border border-slate-700">
                {lightingStatus === 'OPTIMAL' && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Light: Optimal</span>
                  </>
                )}
                {lightingStatus === 'GLARE' && (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">Glare: Tilt Badge</span>
                  </>
                )}
                {lightingStatus === 'LOW_LIGHT' && (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-red-300">Light: Underexposed</span>
                  </>
                )}
              </div>

              {torchSupported && (
                <button
                  onClick={toggleTorch}
                  className={`p-2 rounded-full backdrop-blur-md border transition ${
                    torchOn
                      ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                      : 'bg-black/60 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                  title="Toggle Flashlight"
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* HUD Bottom Info Bar */}
            <div className="absolute bottom-3 inset-x-3 pointer-events-auto flex items-center justify-between">
              <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-black/70 backdrop-blur-md rounded-lg border border-slate-700 hover:bg-slate-800 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <span className="text-[10px] font-mono text-slate-400 bg-black/70 px-2 py-1 rounded border border-slate-800">
                Bradford D65 Auto-Norm
              </span>
            </div>
          </div>

          {/* Main Camera Snap Button */}
          <button
            onClick={handleCaptureFrame}
            disabled={!cameraActive || isProcessing}
            className={`w-full py-4 rounded-xl font-bold text-base tracking-wide flex items-center justify-center gap-2.5 shadow-lg transition ${
              !cameraActive || isProcessing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/25 active:scale-[0.98]'
            }`}
          >
            <Camera className="w-5 h-5" />
            {isProcessing ? 'NORMALIZING & EVALUATING...' : 'SAMPLE & ANALYZE DOSIMETER'}
          </button>
        </div>
      )}

      {/* Quick Test Swatch Selector: Expanded 6-Anchor Scale (0.0 to 100.0+ ppm) */}
      <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Simulate Empirical Calibration Swatch (0-100 ppm)
          </span>
          <span className="text-[10px] font-mono text-slate-500">Pb(Ac)2 Standard</span>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {LEAD_ACETATE_CALIBRATION_ANCHORS.map((anchor) => {
            const isSelected = selectedAnchorPreset?.id === anchor.id;
            return (
              <button
                key={anchor.id}
                onClick={() => handleSelectPreset(anchor)}
                className={`flex flex-col items-center p-1 rounded-lg border transition text-center ${
                  isSelected
                    ? 'border-sky-400 bg-sky-950/40 ring-2 ring-sky-400/30'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                }`}
              >
                {/* Visual Swatch */}
                <div
                  className="w-7 h-7 rounded-full border border-white/20 mb-1 shadow-sm"
                  style={{ backgroundColor: anchor.hex }}
                />
                <span className="text-[9px] font-bold font-mono text-slate-200">
                  {anchor.h2sPpm} ppm
                </span>
                <span
                  className={`text-[7px] font-bold px-1 rounded uppercase mt-0.5 truncate max-w-full ${
                    anchor.badgeClass === 'safe'
                      ? 'text-emerald-400 bg-emerald-950/60'
                      : anchor.badgeClass === 'trace'
                      ? 'text-cyan-400 bg-cyan-950/60'
                      : anchor.badgeClass === 'caution'
                      ? 'text-amber-400 bg-amber-950/60'
                      : anchor.badgeClass === 'warning'
                      ? 'text-orange-400 bg-orange-950/60'
                      : anchor.badgeClass === 'danger'
                      ? 'text-red-400 bg-red-950/60'
                      : 'text-purple-300 bg-purple-950/60'
                  }`}
                >
                  {anchor.badgeClass}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
