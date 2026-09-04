'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Radio,
  Volume2,
  VolumeX,
  Download,
  Activity,
  Users,
  Building2,
  RefreshCw,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { ScanRecord, getAllScanRecords, saveScanRecord } from '@/lib/db';
import { telemetryBus, TelemetryEvent } from '@/lib/socketMock';
import { SupervisorTable } from '@/components/SupervisorTable';
import { ExposureChart } from '@/components/ExposureChart';
import { ZoneHeatmap } from '@/components/ZoneHeatmap';

export default function SupervisorPage() {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(false);
  const [activeAlarm, setActiveAlarm] = useState<ScanRecord | null>(null);
  const [alarmIntervalId, setAlarmIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Load records and subscribe to real-time telemetry
  useEffect(() => {
    setRecords(getAllScanRecords());

    const unsubscribe = telemetryBus.subscribe((event: TelemetryEvent) => {
      if (event.type === 'NEW_SCAN' && event.payload) {
        const newRecord = event.payload as ScanRecord;
        setRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);

        // Check if critical alarm (>= 10.0 ppm)
        if (newRecord.ppm >= 10.0) {
          setActiveAlarm(newRecord);
        }
      } else if (event.type === 'EMERGENCY_ALARM' && event.payload) {
        setActiveAlarm(event.payload as ScanRecord);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Web Audio API 800Hz Industrial Pulse Sound
  const playPulseBeep = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  };

  // Trigger repetitive alarm pulse if hazard active and audio enabled
  useEffect(() => {
    if (activeAlarm && isAudioEnabled) {
      playPulseBeep();
      const id = setInterval(() => {
        playPulseBeep();
      }, 1200);
      setAlarmIntervalId(id);
      return () => clearInterval(id);
    } else if (alarmIntervalId) {
      clearInterval(alarmIntervalId);
      setAlarmIntervalId(null);
    }
  }, [activeAlarm, isAudioEnabled]);

  const dismissAlarm = () => {
    if (alarmIntervalId) clearInterval(alarmIntervalId);
    setAlarmIntervalId(null);
    setActiveAlarm(null);
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalWorkers = records.length;
    const safeCount = records.filter((r) => r.ppm < 5.0).length;
    const cautionCount = records.filter((r) => r.ppm >= 5.0 && r.ppm < 10.0).length;
    const warningCount = records.filter((r) => r.ppm >= 10.0 && r.ppm < 50.0).length;
    const idlhCount = records.filter((r) => r.ppm >= 50.0).length;
    return { totalWorkers, safeCount, cautionCount, warningCount, idlhCount };
  }, [records]);

  // One-Click OSHA 300 / Compliance CSV Export
  const exportOsha300Csv = () => {
    const headers = [
      'Record ID',
      'Worker ID',
      'Worker Name',
      'Plant Facility',
      'Plant Sector / Zone',
      'Timestamp (ISO)',
      'H2S Exposure (PPM)',
      'CIEDE2000 Delta E',
      'Optical Density',
      'CIE L*',
      'CIE a*',
      'CIE b*',
      'EHS Classification',
      'OSHA 1910.1000 Status',
      'Latitude',
      'Longitude',
    ];

    const rows = records.map((r) => [
      r.id,
      r.workerId,
      `"${r.workerName}"`,
      `"${r.facility}"`,
      `"${r.zone}"`,
      r.timestamp,
      r.ppm.toFixed(1),
      r.deltaE.toFixed(2),
      r.opticalDensity.toFixed(3),
      r.sampleLab.L,
      r.sampleLab.a,
      r.sampleLab.b,
      r.status,
      r.ppm >= 10.0 ? 'OSHA PEL BREACH' : r.ppm >= 1.0 ? 'ACGIH TWA ELEVATED' : 'COMPLIANT',
      r.coordinates?.lat || '',
      r.coordinates?.lng || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `OSHA_300_H2S_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
      {/* 1. CRITICAL HAZARD BROADCAST OVERLAY BANNER */}
      {activeAlarm && (
        <div className="w-full bg-red-950/95 border-2 border-red-500 rounded-2xl p-4 sm:p-5 shadow-[0_0_35px_rgba(239,68,68,0.7)] animate-danger-glow flex flex-col md:flex-row md:items-center justify-between gap-4 text-red-100">
          <div className="flex items-center gap-3.5">
            <Flame className="w-8 h-8 text-red-400 animate-bounce flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-red-300">
                CRITICAL HAZARD BROADCAST OVERLAY • IMMEDIATE ACTION REQUIRED
              </span>
              <span className="text-base sm:text-lg font-bold">
                ALARM: Worker {activeAlarm.workerName} ({activeAlarm.workerId}) registered{' '}
                <span className="font-mono text-white underline">{activeAlarm.ppm.toFixed(1)} PPM</span> in{' '}
                {activeAlarm.zone}. Direct stop-work dispatched.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => setIsAudioEnabled((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                isAudioEnabled
                  ? 'bg-red-500 text-black border-red-300 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                  : 'bg-red-900/60 text-red-200 border-red-700 hover:text-white'
              }`}
            >
              {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{isAudioEnabled ? 'Alarm Sound: Active' : 'Enable 800Hz Sound'}</span>
            </button>

            <button
              onClick={dismissAlarm}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-slate-200 border border-slate-700 hover:bg-slate-800 transition"
            >
              Acknowledge & Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 2. COMMAND HEADER & EXPORT TOOLBAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black font-mono tracking-tight text-white flex items-center gap-2">
              <span>EHS Supervisor Command Center</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-emerald-400">
                LIVE TELEMETRY
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Lead(II) Acetate Industrial Chemocassette Fleet Monitoring & Regulatory Surveillance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsAudioEnabled((prev) => !prev)}
            className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              isAudioEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title="Toggle Industrial Audible Alarm (800Hz)"
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">800Hz Sound Alert</span>
          </button>

          <button
            onClick={exportOsha300Csv}
            className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-lg shadow-emerald-400/20 flex items-center gap-2 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export OSHA 300 CSV</span>
          </button>
        </div>
      </div>

      {/* 3. REAL-TIME TELEMETRY STRIP (KPIS - 0 TO 100 PPM DYNAMIC RANGE) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Active */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            Active Personnel
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-slate-100">{kpis.totalWorkers}</span>
            <span className="text-[10px] font-mono text-slate-500">On Shift</span>
          </div>
        </div>

        {/* Safe State */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Safe (&lt; 5 ppm)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-emerald-400">{kpis.safeCount}</span>
            <span className="text-[10px] font-mono text-emerald-500/80">Normal</span>
          </div>
        </div>

        {/* Caution Alerts */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Caution (5-9.9)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-amber-400">{kpis.cautionCount}</span>
            <span className="text-[10px] font-mono text-amber-500/80">Elevated</span>
          </div>
        </div>

        {/* Warning PEL Breaches */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            PEL (10-49.9)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-orange-400">{kpis.warningCount}</span>
            <span className="text-[10px] font-mono text-orange-500/80">PEL Breach</span>
          </div>
        </div>

        {/* IDLH Critical */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
            IDLH (≥ 50 ppm)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-purple-400">{kpis.idlhCount}</span>
            <span className="text-[10px] font-mono text-purple-500/80">Evacuate</span>
          </div>
        </div>

        {/* System Sync Bus Status */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            Telemetry Bus
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-xs font-mono font-bold text-cyan-300">SYNC</span>
            <span className="text-[10px] font-mono text-emerald-400">100% ONLINE</span>
          </div>
        </div>
      </div>

      {/* 4. EXPOSURE TIME-SERIES ANALYTICS CHART */}
      <ExposureChart records={records} />

      {/* 5. GEOSPATIAL ZONE HAZARD HEATMAP */}
      <ZoneHeatmap records={records} />

      {/* 6. LIVE PERSONNEL TELEMETRY GRID */}
      <SupervisorTable records={records} />
    </div>
  );
}
