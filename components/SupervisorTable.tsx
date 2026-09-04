'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  PhoneCall,
  RotateCw,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  Flame,
  UserCheck
} from 'lucide-react';
import { ScanRecord } from '@/lib/db';
import { telemetryBus } from '@/lib/socketMock';

interface SupervisorTableProps {
  records: ScanRecord[];
  onRescanRequested?: (workerId: string) => void;
}

export const SupervisorTable: React.FC<SupervisorTableProps> = ({
  records,
  onRescanRequested,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortByPpmDesc, setSortByPpmDesc] = useState<boolean>(true);
  const [rescanTriggered, setRescanTriggered] = useState<Record<string, boolean>>({});

  // Unique list of zones
  const zones = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => set.add(r.zone));
    return Array.from(set);
  }, [records]);

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  // Filtered & Sorted records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.workerName.toLowerCase().includes(q) ||
          r.workerId.toLowerCase().includes(q) ||
          r.zone.toLowerCase().includes(q)
      );
    }

    if (selectedZone !== 'ALL') {
      result = result.filter((r) => r.zone === selectedZone);
    }

    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'SAFE') {
        result = result.filter((r) => r.ppm < 5.0);
      } else if (selectedStatus === 'CAUTION') {
        result = result.filter((r) => r.ppm >= 5.0 && r.ppm < 10.0);
      } else if (selectedStatus === 'WARNING') {
        result = result.filter((r) => r.ppm >= 10.0 && r.ppm < 20.0);
      } else if (selectedStatus === 'DANGER') {
        result = result.filter((r) => r.ppm >= 20.0 && r.ppm < 50.0);
      } else if (selectedStatus === 'CRITICAL') {
        result = result.filter((r) => r.ppm >= 50.0);
      }
    }

    result.sort((a, b) => (sortByPpmDesc ? b.ppm - a.ppm : a.ppm - b.ppm));

    return result;
  }, [records, searchTerm, selectedZone, selectedStatus, sortByPpmDesc]);

  const handleRequestRescan = (workerId: string, zone: string) => {
    telemetryBus.requestRescan(workerId, zone);
    setRescanTriggered((prev) => ({ ...prev, [workerId]: true }));
    setTimeout(() => {
      setRescanTriggered((prev) => ({ ...prev, [workerId]: false }));
    }, 3000);
    if (onRescanRequested) onRescanRequested(workerId);
  };

  const handleCallWorker = (workerName: string) => {
    alert(`Dispatched direct safety radio call to ${workerName} on Plant Channel 4.`);
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-sky-400" />
            Active Personnel Dosimeter Telemetry (0–100 PPM)
          </h3>
          <p className="text-xs text-slate-400">
            Real-time Lead(II) Acetate optical badge logs across plant facilities
          </p>
        </div>

        {/* Filter / Search Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search worker or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 w-40 md:w-48"
            />
          </div>

          {/* Zone Selector */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Plant Sectors</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SAFE">Safe (&lt; 5.0 ppm)</option>
            <option value="CAUTION">Caution (5.0 - 9.9 ppm)</option>
            <option value="WARNING">Warning / PEL (10.0 - 19.9 ppm)</option>
            <option value="DANGER">Danger / Ceiling (20.0 - 49.9 ppm)</option>
            <option value="CRITICAL">Critical / IDLH (≥ 50.0 ppm)</option>
          </select>

          {/* Sort Toggle */}
          <button
            onClick={() => setSortByPpmDesc((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white transition"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
            <span>{sortByPpmDesc ? 'Highest PPM' : 'Lowest PPM'}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Personnel / Badge ID</th>
              <th className="py-3 px-3">Assigned Zone</th>
              <th className="py-3 px-3 text-right">Exposure (PPM)</th>
              <th className="py-3 px-3 text-right">Optical Density</th>
              <th className="py-3 px-3">Last Scan</th>
              <th className="py-3 px-3 text-center">Safety Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500 italic">
                  No worker records matching current filter criteria.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => {
                const isCritical = r.ppm >= 50.0;
                const isDanger = r.ppm >= 20.0 && r.ppm < 50.0;
                const isWarning = r.ppm >= 10.0 && r.ppm < 20.0;
                const isCaution = r.ppm >= 5.0 && r.ppm < 10.0;

                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-800/40 transition ${
                      isCritical
                        ? 'bg-purple-950/30'
                        : isDanger
                        ? 'bg-red-950/20'
                        : isWarning
                        ? 'bg-orange-950/15'
                        : isCaution
                        ? 'bg-amber-950/10'
                        : ''
                    }`}
                  >
                    {/* Status Dot */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isCritical
                              ? 'bg-purple-400 animate-pulse'
                              : isDanger
                              ? 'bg-red-500 animate-pulse'
                              : isWarning
                              ? 'bg-orange-400'
                              : isCaution
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <span
                          className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded uppercase ${
                            isCritical
                              ? 'text-purple-300 bg-purple-950/80 border border-purple-800'
                              : isDanger
                              ? 'text-red-300 bg-red-950/80 border border-red-800'
                              : isWarning
                              ? 'text-orange-300 bg-orange-950/80 border border-orange-800'
                              : isCaution
                              ? 'text-amber-300 bg-amber-950/80 border border-amber-800'
                              : 'text-emerald-300 bg-emerald-950/80 border border-emerald-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    </td>

                    {/* Personnel */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-100">{r.workerName}</span>
                        <span className="text-[11px] font-mono text-slate-400">{r.workerId}</span>
                      </div>
                    </td>

                    {/* Zone */}
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={r.zone}>
                      {r.zone}
                    </td>

                    {/* PPM */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span
                        className={`font-mono font-bold text-sm ${
                          isCritical
                            ? 'text-purple-400'
                            : isDanger
                            ? 'text-red-400'
                            : isWarning
                            ? 'text-orange-400'
                            : isCaution
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {r.ppm.toFixed(1)}{' '}
                        <span className="text-[10px] text-slate-400">ppm</span>
                      </span>
                    </td>

                    {/* Optical Density */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono text-slate-300">
                      {r.opticalDensity.toFixed(3)}
                    </td>

                    {/* Relative Time */}
                    <td className="py-3 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {getRelativeTime(r.timestamp)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleRequestRescan(r.workerId, r.zone)}
                          className={`p-1.5 rounded-lg border transition ${
                            rescanTriggered[r.workerId]
                              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                          }`}
                          title="Request Mandatory Re-Scan"
                        >
                          <RotateCw
                            className={`w-3.5 h-3.5 ${
                              rescanTriggered[r.workerId] ? 'animate-spin' : ''
                            }`}
                          />
                        </button>

                        <button
                          onClick={() => handleCallWorker(r.workerName)}
                          className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition"
                          title="Radio Personnel Direct Call"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
