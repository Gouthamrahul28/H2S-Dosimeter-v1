'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Flame,
  Send,
  RotateCcw,
  Clock,
  Compass,
  Layers,
  Battery,
  Wifi,
  WifiOff,
  CheckCircle,
  Activity,
  Camera,
  Eye
} from 'lucide-react';
import { ColorimetryResult } from '@/lib/colorimetry';
import { WorkerProfile, ScanRecord } from '@/lib/db';
import { telemetryBus } from '@/lib/socketMock';

interface WorkerVerdictProps {
  result: ColorimetryResult;
  profile: WorkerProfile;
  onRetake: () => void;
  onTransmitted?: (record: ScanRecord) => void;
}

export const WorkerVerdict: React.FC<WorkerVerdictProps> = ({
  result,
  profile,
  onRetake,
  onTransmitted,
}) => {
  const [transmitted, setTransmitted] = useState<boolean>(false);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [batteryLevel, setBatteryLevel] = useState<number | undefined>(undefined);
  const [rescanSecondsLeft, setRescanSecondsLeft] = useState<number>(45 * 60); // 45-minute re-scan countdown

  // Trigger haptic vibration for Warning / Danger / Critical
  useEffect(() => {
    if (result.estimatedPpm >= 10.0 && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        if (result.estimatedPpm >= 50.0) {
          // Intense pulse for IDLH critical
          navigator.vibrate([400, 100, 400, 100, 400, 100, 800]);
        } else {
          navigator.vibrate([300, 100, 300, 100, 500]);
        }
      } catch (err) {
        console.warn('Vibration API blocked or not supported');
      }
    }
  }, [result.estimatedPpm]);

  // Online status & battery level monitoring
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      if ('getBattery' in navigator) {
        (navigator as any).getBattery().then((battery: any) => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  // 45-minute re-scan countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRescanSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Transmit Scan Log to Supervisor & Storage
  const handleTransmit = () => {
    setIsTransmitting(true);

    const record: ScanRecord = {
      id: `SCAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      workerId: profile.workerId,
      workerName: profile.workerName,
      facility: profile.facility,
      zone: profile.plantZone,
      timestamp: new Date().toISOString(),
      shiftHoursElapsed: 4.5,
      ppm: result.estimatedPpm,
      deltaE: result.deltaE00,
      opticalDensity: result.opticalDensity,
      sampleLab: result.sampleLab,
      sampleHex: `rgb(${result.adaptedSampleRGB.r}, ${result.adaptedSampleRGB.g}, ${result.adaptedSampleRGB.b})`,
      nearestAnchorHex: result.nearestAnchor.hex,
      status: result.alertLevel,
      badgeClass: result.badgeClass,
      confidenceScore: result.confidenceScore,
      coordinates: { lat: 22.4707, lng: 70.0577 }, // Default Jamnagar Complex coordinates
      batteryLevel,
      synced: isOnline,
    };

    // Broadcast across real-time event bus
    telemetryBus.broadcastScan(record);

    setTimeout(() => {
      setIsTransmitting(false);
      setTransmitted(true);
      if (onTransmitted) onTransmitted(record);
    }, 600);
  };

  const ppm = result.estimatedPpm;
  const isCritical = ppm >= 50.0;
  const isDanger = ppm >= 20.0 && ppm < 50.0;
  const isWarning = ppm >= 10.0 && ppm < 20.0;
  const isCaution = ppm >= 5.0 && ppm < 10.0;
  const isTrace = ppm >= 1.0 && ppm < 5.0;

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-4">
      {/* 1. GIANT HIGH-CONTRAST STATUS BADGE (0 - 100 PPM MULTI-TIER) */}
      <div
        className={`w-full p-5 rounded-2xl border-3 flex flex-col items-center text-center transition shadow-2xl ${
          isCritical
            ? 'bg-purple-950/95 border-purple-500 text-purple-100 shadow-[0_0_45px_rgba(168,85,247,0.8)] animate-pulse'
            : isDanger
            ? 'bg-red-950/95 border-red-500 text-red-100 shadow-[0_0_35px_rgba(239,68,68,0.7)] animate-danger-glow'
            : isWarning
            ? 'bg-orange-950/90 border-orange-500 text-orange-100 shadow-[0_0_30px_rgba(249,115,22,0.6)]'
            : isCaution
            ? 'bg-amber-950/90 border-amber-400 text-amber-100 shadow-[0_0_25px_rgba(245,158,11,0.5)]'
            : isTrace
            ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
            : 'bg-emerald-950/90 border-emerald-400 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          {isCritical || isDanger ? (
            <Flame className="w-8 h-8 text-red-400 animate-bounce" />
          ) : isWarning || isCaution ? (
            <AlertTriangle className="w-8 h-8 text-amber-300" />
          ) : (
            <ShieldCheck className="w-8 h-8 text-emerald-300" />
          )}
          <span className="text-xl font-black tracking-wider uppercase font-mono">
            {isCritical
              ? 'CRITICAL HAZARD: EVACUATE (IDLH)'
              : isDanger
              ? 'DANGER: CEILING EXCEEDED'
              : isWarning
              ? 'WARNING: EXCEEDS OSHA PEL'
              : isCaution
              ? 'CAUTION: APPROACHING PEL'
              : isTrace
              ? 'TRACE H2S DETECTED'
              : 'SAFE TO WORK'}
          </span>
        </div>

        {/* Big Bold Monospace PPM Display (0 - 100+ ppm) */}
        <div className="flex items-baseline justify-center gap-2 my-2">
          <span className="text-6xl font-black font-mono tracking-tight text-white drop-shadow-md">
            {result.estimatedPpm.toFixed(1)}
          </span>
          <span className="text-2xl font-bold font-mono text-slate-300">PPM</span>
        </div>

        <p className="text-[10px] font-mono text-slate-400 -mt-1">
          Cumulative exposure dose (ppm&middot;h) since badge activation &mdash; not an
          instantaneous ambient concentration reading.
        </p>

        <p className="text-xs font-semibold text-slate-200 mt-1 max-w-xs">
          {result.nearestAnchor.recommendedAction}
        </p>
      </div>

      {/* 2. VISUAL AUDIT TRAIL: CAPTURED PATCH + EXTRACTED COLOR + CALIBRATION STANDARD */}
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-sky-400" />
            Lead(II) Acetate Metrology & Audit Trail
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            D65 Bradford Normalization
          </span>
        </div>

        {/* 3-Panel Visual Audit Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* Item 1: Actual Captured Patch Thumbnail */}
          <div className="flex flex-col items-center p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
            {result.capturedImageSrc ? (
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-sky-400/50 shadow-inner bg-black flex items-center justify-center mb-1">
                <img
                  src={result.capturedImageSrc}
                  alt="Captured Badge"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center mb-1 text-slate-500">
                <Camera className="w-5 h-5" />
              </div>
            )}
            <span className="text-[9px] uppercase font-bold text-slate-400">Captured Badge</span>
            <span className="text-[9px] font-mono text-emerald-400 font-semibold truncate max-w-full">
              Fiducial Align
            </span>
          </div>

          {/* Item 2: Extracted & Adapted Sample Color */}
          <div className="flex flex-col items-center p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div
              className="w-12 h-12 rounded-lg border-2 border-white/40 shadow-inner mb-1"
              style={{
                backgroundColor: `rgb(${result.adaptedSampleRGB.r}, ${result.adaptedSampleRGB.g}, ${result.adaptedSampleRGB.b})`,
              }}
            />
            <span className="text-[9px] uppercase font-bold text-slate-400">Detected Color</span>
            <span className="text-[9px] font-mono font-bold text-slate-100 truncate max-w-full">
              L*={result.sampleLab.L}
            </span>
          </div>

          {/* Item 3: Nearest Standard Calibration Anchor */}
          <div className="flex flex-col items-center p-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
            <div
              className="w-12 h-12 rounded-lg border-2 border-white/40 shadow-inner mb-1"
              style={{ backgroundColor: result.nearestAnchor.hex }}
            />
            <span className="text-[9px] uppercase font-bold text-slate-400">Standard Anchor</span>
            <span className="text-[9px] font-mono font-bold text-amber-400 truncate max-w-full">
              {result.nearestAnchor.h2sPpm} ppm
            </span>
          </div>
        </div>

        {/* Optical Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 pt-2 text-center">
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 block">ΔE00 vs Baseline</span>
            <span className="text-sm font-bold font-mono text-slate-100">
              {result.deltaE00.toFixed(1)}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 block">Optical Density</span>
            <span className="text-sm font-bold font-mono text-slate-100">
              {result.opticalDensity.toFixed(3)}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 block">Lighting Score</span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {result.confidenceScore}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. WORKER LOCATION & RESCAN TIMER */}
      <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400" />
          <div className="flex flex-col">
            <span className="font-bold text-slate-200">{profile.workerName} ({profile.workerId})</span>
            <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{profile.plantZone}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-amber-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Next: {formatCountdown(rescanSecondsLeft)}</span>
        </div>
      </div>

      {/* 4. ACTIONS: RETAKE SCAN & TRANSMIT LOG */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={onRetake}
          className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 transition shadow flex items-center justify-center gap-2 active:scale-98"
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
          Retake Scan
        </button>

        <button
          onClick={handleTransmit}
          disabled={transmitted || isTransmitting}
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 active:scale-98 ${
            transmitted
              ? 'bg-emerald-600 text-white shadow-emerald-500/25 border border-emerald-400'
              : isCritical || isDanger
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/30 border border-red-400'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/25 border border-sky-300'
          }`}
        >
          {transmitted ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Transmitted
            </>
          ) : isTransmitting ? (
            <>
              <Activity className="w-4 h-4 animate-spin" />
              Transmitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Transmit Log
            </>
          )}
        </button>
      </div>
    </div>
  );
};
