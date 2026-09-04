import React from 'react';
import Link from 'next/link';
import {
  HardHat,
  LayoutDashboard,
  Shield,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Atom,
  Binary,
  Compass,
  AlertTriangle
} from 'lucide-react';
import { LEAD_ACETATE_CALIBRATION_ANCHORS, REGULATORY_THRESHOLDS } from '@/lib/calibrationData';

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-6xl mx-auto space-y-10">
      {/* Hero Section */}
      <div className="text-center max-w-3xl space-y-4 pt-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-950/60 border border-amber-500/50 text-amber-300">
          <Atom className="w-3.5 h-3.5" />
          <span>Pb(CH3COO)2 Chemocassette Monotonic Metrology</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono">
          H2S-SafeTrack Platform
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
          Production-grade industrial optical dosimeter system engineered strictly on the Lead(II)
          Acetate cellulose reaction. Instant field exposure evaluation, Bradford chromatic adaptation,
          and continuous EHS fleet compliance.
        </p>
      </div>

      {/* Dual Portal Cards: Worker PWA vs Supervisor Command */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Worker Mobile PWA */}
        <Link
          href="/worker"
          className="group relative p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-800 hover:border-sky-500 transition-all shadow-xl hover:shadow-sky-500/10 flex flex-col justify-between space-y-6"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 group-hover:scale-110 transition">
              <HardHat className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white font-mono flex items-center justify-between">
              <span>Worker Mobile PWA</span>
              <ArrowRight className="w-5 h-5 text-sky-400 group-hover:translate-x-1 transition" />
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mobile-first scanning terminal for industrial personnel. Features live concentric HUD reticle,
              5% specular glare rejection, automated lighting quality analyzer, and instant high-contrast
              safety verdict with haptic feedback.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>• Concentric Reticle</span>
            <span>• Offline Queuing</span>
            <span className="text-sky-400 font-bold">Launch PWA →</span>
          </div>
        </Link>

        {/* Supervisor EHS Command Center */}
        <Link
          href="/supervisor"
          className="group relative p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-800 hover:border-emerald-500 transition-all shadow-xl hover:shadow-emerald-500/10 flex flex-col justify-between space-y-6"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white font-mono flex items-center justify-between">
              <span>Supervisor EHS Command</span>
              <ArrowRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition" />
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Desktop & tablet operations control. Live fleet telemetry grid, geospatial plant sector leak
              heatmap, 800Hz industrial audio hazard alarms, Recharts shift time-series analytics, and
              one-click OSHA 300 compliance reporting.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>• Real-Time Bus Sync</span>
            <span>• OSHA 300 Export</span>
            <span className="text-emerald-400 font-bold">Open Command →</span>
          </div>
        </Link>
      </div>

      {/* Chemical Reaction & 5-Anchor Empirical Calibration Scale */}
      <div className="w-full max-w-5xl bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Binary className="w-5 h-5 text-amber-400" />
              Lead(II) Acetate Monotonic Chromatic Progression
            </h3>
            <p className="text-xs text-slate-400">
              Pb(CH3COO)2 + H2S (g) → PbS ↓ (brown-black precipitate) + 2 CH3COOH
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
            <span>TWA: {REGULATORY_THRESHOLDS.ACGIH_TWA_PPM} ppm</span>
            <span>PEL: {REGULATORY_THRESHOLDS.OSHA_PEL_PPM} ppm</span>
            <span>Ceiling: {REGULATORY_THRESHOLDS.OSHA_CEILING_PPM} ppm</span>
            <span>IDLH: {REGULATORY_THRESHOLDS.NIOSH_IDLH_PPM} ppm</span>
          </div>
        </div>

        {/* 6 Empirical Anchor Cards (0-100 ppm Dynamic Range) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {LEAD_ACETATE_CALIBRATION_ANCHORS.map((anchor) => (
            <div
              key={anchor.id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-3"
            >
              {/* Swatch & Title */}
              <div className="space-y-2">
                <div
                  className="w-full h-11 rounded-lg border border-white/20 shadow-inner flex items-center justify-center font-mono text-xs font-bold"
                  style={{
                    backgroundColor: anchor.hex,
                    color: anchor.id >= 4 ? '#ffffff' : '#000000',
                  }}
                >
                  {anchor.h2sPpm.toFixed(1)} PPM
                </div>

                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200 truncate">{anchor.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Range: {anchor.ppmRangeMin} - {anchor.ppmRangeMax} ppm
                  </span>
                </div>
              </div>

              {/* Coordinates */}
              <div className="space-y-1 font-mono text-[10px] text-slate-400 border-t border-slate-800 pt-2">
                <div className="flex justify-between">
                  <span>L* Lightness:</span>
                  <span className="text-slate-200 font-bold">{anchor.lab.L}</span>
                </div>
                <div className="flex justify-between">
                  <span>a* / b*:</span>
                  <span className="text-slate-200 font-bold">{anchor.lab.a} / {anchor.lab.b}</span>
                </div>
                <div className="flex justify-between">
                  <span>Optical Density:</span>
                  <span className="text-slate-200 font-bold">{anchor.nominalOpticalDensity}</span>
                </div>
                <div className="flex justify-between">
                  <span>ΔE00:</span>
                  <span className="text-slate-200 font-bold">{anchor.nominalDeltaE}</span>
                </div>
              </div>

              {/* Status Tag */}
              <div className="pt-1">
                <span
                  className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider block text-center truncate ${
                    anchor.badgeClass === 'safe'
                      ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                      : anchor.badgeClass === 'trace'
                      ? 'bg-cyan-950 border border-cyan-500 text-cyan-300'
                      : anchor.badgeClass === 'caution'
                      ? 'bg-amber-950 border border-amber-500 text-amber-300'
                      : anchor.badgeClass === 'warning'
                      ? 'bg-orange-950 border border-orange-500 text-orange-300'
                      : anchor.badgeClass === 'danger'
                      ? 'bg-red-950 border border-red-500 text-red-300'
                      : 'bg-purple-950 border border-purple-500 text-purple-300 animate-pulse'
                  }`}
                >
                  {anchor.ehsStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
