'use client';

import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { ScanRecord } from '@/lib/db';
import { REGULATORY_THRESHOLDS } from '@/lib/calibrationData';
import { TrendingUp, ShieldAlert, AlertOctagon } from 'lucide-react';

interface ExposureChartProps {
  records: ScanRecord[];
}

export const ExposureChart: React.FC<ExposureChartProps> = ({ records }) => {
  // Generate data points for Recharts sorted by shift hours
  const chartData = React.useMemo(() => {
    return [...records]
      .map((r) => ({
        shiftHours: r.shiftHoursElapsed,
        ppm: r.ppm,
        worker: r.workerName,
        workerId: r.workerId,
        zone: r.zone,
        timestamp: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }))
      .sort((a, b) => a.shiftHours - b.shiftHours);
  }, [records]);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-400" />
            H2S Cumulative Shift Exposure Analytics (0–100 PPM Scale)
          </h3>
          <p className="text-xs text-slate-400">
            Real-time dosimeter readings across 12-hour operational shift up to NIOSH IDLH threshold
          </p>
        </div>

        {/* Legend Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1 text-slate-300">
            <span className="w-2.5 h-0.5 bg-sky-400 inline-block" />
            <span>Worker Scans</span>
          </div>
          <div className="flex items-center gap-1 text-amber-400">
            <span className="w-2.5 h-0.5 border-b border-dashed border-amber-400 inline-block" />
            <span>TWA (1 ppm)</span>
          </div>
          <div className="flex items-center gap-1 text-orange-400">
            <span className="w-2.5 h-0.5 border-b border-dashed border-orange-400 inline-block" />
            <span>OSHA PEL (10 ppm)</span>
          </div>
          <div className="flex items-center gap-1 text-red-400">
            <span className="w-2.5 h-0.5 border-b border-dashed border-red-500 inline-block" />
            <span>Ceiling (20 ppm)</span>
          </div>
          <div className="flex items-center gap-1 text-purple-400">
            <span className="w-2.5 h-0.5 border-b border-dashed border-purple-500 inline-block" />
            <span>IDLH (100 ppm)</span>
          </div>
        </div>
      </div>

      {/* Recharts Container */}
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 25, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="shiftHours"
              type="number"
              domain={[0, 12]}
              ticks={[0, 2, 4, 6, 8, 10, 12]}
              stroke="#64748b"
              fontSize={11}
              tickFormatter={(v) => `${v}h`}
              label={{ value: 'Shift Duration (Hours)', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 1, 10, 20, 50, 100]}
              stroke="#64748b"
              fontSize={11}
              label={{ value: 'Exposure (PPM)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
            />

            {/* NIOSH 100 ppm IDLH Reference Line */}
            <ReferenceLine
              y={REGULATORY_THRESHOLDS.NIOSH_IDLH_PPM}
              stroke="#c084fc"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: 'NIOSH IDLH (100 ppm)',
                fill: '#c084fc',
                fontSize: 10,
                position: 'bottom',
              }}
            />

            {/* OSHA 20 ppm Ceiling Reference Line */}
            <ReferenceLine
              y={REGULATORY_THRESHOLDS.OSHA_CEILING_PPM}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'OSHA Ceiling (20 ppm)',
                fill: '#ef4444',
                fontSize: 10,
                position: 'top',
              }}
            />

            {/* OSHA 10 ppm PEL Reference Line */}
            <ReferenceLine
              y={REGULATORY_THRESHOLDS.OSHA_PEL_PPM}
              stroke="#f97316"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{
                value: 'OSHA PEL (10 ppm)',
                fill: '#f97316',
                fontSize: 10,
                position: 'top',
              }}
            />

            {/* ACGIH 1.0 ppm TWA Reference Line */}
            <ReferenceLine
              y={REGULATORY_THRESHOLDS.ACGIH_TWA_PPM}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'ACGIH TWA (1 ppm)',
                fill: '#f59e0b',
                fontSize: 10,
                position: 'top',
              }}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                      <div className="font-bold text-slate-100 flex items-center justify-between gap-3">
                        <span>{data.worker}</span>
                        <span className="font-mono text-sky-400">{data.ppm} ppm</span>
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono">
                        Shift: {data.shiftHours}h elapsed ({data.timestamp})
                      </div>
                      <div className="text-slate-400 text-[11px] truncate max-w-xs">
                        {data.zone}
                      </div>
                      {data.ppm >= 50.0 ? (
                        <div className="text-purple-400 font-bold text-[10px] uppercase pt-1 flex items-center gap-1">
                          <AlertOctagon className="w-3 h-3" />
                          NIOSH IDLH Lethal Hazard
                        </div>
                      ) : data.ppm >= 20.0 ? (
                        <div className="text-red-400 font-bold text-[10px] uppercase pt-1 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          OSHA Ceiling Violation (Evacuate)
                        </div>
                      ) : data.ppm >= 10.0 ? (
                        <div className="text-orange-400 font-bold text-[10px] uppercase pt-1 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          OSHA PEL Violation
                        </div>
                      ) : null}
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Trend Interpolation Line */}
            <Line
              type="monotone"
              dataKey="ppm"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ r: 4, fill: '#38bdf8', strokeWidth: 2, stroke: '#0369a1' }}
              activeDot={{ r: 6, fill: '#38bdf8', stroke: '#ffffff' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
