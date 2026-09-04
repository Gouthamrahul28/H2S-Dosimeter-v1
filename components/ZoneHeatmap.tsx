'use client';

import React from 'react';
import { MapPin, Users, AlertTriangle, Flame, ShieldCheck, ArrowUpRight, AlertOctagon } from 'lucide-react';
import { ScanRecord, DEFAULT_PLANT_ZONES } from '@/lib/db';

interface ZoneHeatmapProps {
  records: ScanRecord[];
  onSelectZone?: (zoneName: string) => void;
}

interface ZoneSummary {
  name: string;
  workerCount: number;
  meanPpm: number;
  maxPpm: number;
  status: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER' | 'CRITICAL';
  latestTimestamp?: string;
}

export const ZoneHeatmap: React.FC<ZoneHeatmapProps> = ({ records, onSelectZone }) => {
  // Aggregate statistics per zone
  const zoneSummaries = React.useMemo(() => {
    const map = new Map<string, ScanRecord[]>();

    // Initialize all default plant zones
    DEFAULT_PLANT_ZONES.forEach((z) => map.set(z, []));

    records.forEach((r) => {
      const list = map.get(r.zone) || [];
      list.push(r);
      map.set(r.zone, list);
    });

    const summaries: ZoneSummary[] = [];

    map.forEach((list, name) => {
      if (list.length === 0) {
        summaries.push({
          name,
          workerCount: 0,
          meanPpm: 0,
          maxPpm: 0,
          status: 'SAFE',
        });
      } else {
        const totalPpm = list.reduce((acc, cur) => acc + cur.ppm, 0);
        const meanPpm = Number((totalPpm / list.length).toFixed(1));
        const maxPpm = Math.max(...list.map((r) => r.ppm));

        let status: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER' | 'CRITICAL' = 'SAFE';
        if (maxPpm >= 50.0 || meanPpm >= 40.0) {
          status = 'CRITICAL';
        } else if (maxPpm >= 20.0 || meanPpm >= 15.0) {
          status = 'DANGER';
        } else if (maxPpm >= 10.0 || meanPpm >= 8.0) {
          status = 'WARNING';
        } else if (maxPpm >= 5.0 || meanPpm >= 4.0) {
          status = 'CAUTION';
        }

        // Sort latest timestamp
        const sortedList = [...list].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        summaries.push({
          name,
          workerCount: list.length,
          meanPpm,
          maxPpm,
          status,
          latestTimestamp: sortedList[0]?.timestamp,
        });
      }
    });

    return summaries;
  }, [records]);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky-400" />
            Geospatial Plant Sector Hazard Heatmap (0–100 PPM)
          </h3>
          <p className="text-xs text-slate-400">
            Automated cluster analysis identifying localized pipeline leaks up to NIOSH IDLH thresholds
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            Normal (&lt;5)
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            Caution (≥5)
          </span>
          <span className="flex items-center gap-1.5 text-orange-400">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />
            PEL Breach (≥10)
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
            Ceiling (≥20)
          </span>
          <span className="flex items-center gap-1.5 text-purple-400">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block animate-pulse" />
            IDLH (≥50)
          </span>
        </div>
      </div>

      {/* Grid of Sector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {zoneSummaries.map((zone) => {
          const isCritical = zone.status === 'CRITICAL';
          const isDanger = zone.status === 'DANGER';
          const isWarning = zone.status === 'WARNING';
          const isCaution = zone.status === 'CAUTION';

          return (
            <div
              key={zone.name}
              onClick={() => onSelectZone && onSelectZone(zone.name)}
              className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between space-y-3 ${
                isCritical
                  ? 'bg-purple-950/40 border-purple-500/90 hover:bg-purple-950/60 shadow-[0_0_25px_rgba(168,85,247,0.3)]'
                  : isDanger
                  ? 'bg-red-950/30 border-red-500/80 hover:bg-red-950/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                  : isWarning
                  ? 'bg-orange-950/25 border-orange-500/70 hover:bg-orange-950/45 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                  : isCaution
                  ? 'bg-amber-950/20 border-amber-500/60 hover:bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-100 line-clamp-1" title={zone.name}>
                    {zone.name}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                    <Users className="w-3 h-3 text-slate-500" />
                    {zone.workerCount} Active Personnel
                  </span>
                </div>

                <span
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    isCritical
                      ? 'bg-purple-950 border border-purple-400 text-purple-200 animate-pulse'
                      : isDanger
                      ? 'bg-red-950 border border-red-500 text-red-300 animate-pulse'
                      : isWarning
                      ? 'bg-orange-950 border border-orange-500 text-orange-300'
                      : isCaution
                      ? 'bg-amber-950 border border-amber-500 text-amber-300'
                      : 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                  }`}
                >
                  {zone.status}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-mono block">Mean Exposure</span>
                  <span
                    className={`text-base font-bold font-mono ${
                      isCritical
                        ? 'text-purple-400'
                        : isDanger
                        ? 'text-red-400'
                        : isWarning
                        ? 'text-orange-400'
                        : isCaution
                        ? 'text-amber-400'
                        : 'text-slate-200'
                    }`}
                  >
                    {zone.meanPpm} <span className="text-[10px] text-slate-400">ppm</span>
                  </span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-mono block">Peak Observed</span>
                  <span
                    className={`text-base font-bold font-mono ${
                      zone.maxPpm >= 50.0
                        ? 'text-purple-400'
                        : zone.maxPpm >= 20.0
                        ? 'text-red-400'
                        : zone.maxPpm >= 10.0
                        ? 'text-orange-400'
                        : zone.maxPpm >= 5.0
                        ? 'text-amber-400'
                        : 'text-slate-200'
                    }`}
                  >
                    {zone.maxPpm} <span className="text-[10px] text-slate-400">ppm</span>
                  </span>
                </div>
              </div>

              {/* Footer status notice */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/60 pt-2">
                <span className="truncate">
                  {isCritical
                    ? '☠️ LETHAL HAZARD: NIOSH IDLH zone'
                    : isDanger
                    ? '⚠️ Severe localized H2S alert (OSHA Ceiling)'
                    : isWarning
                    ? '⛔ OSHA 10 ppm PEL breach'
                    : isCaution
                    ? '⚡ Elevated trace threshold'
                    : '✓ Within normal baseline'}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
