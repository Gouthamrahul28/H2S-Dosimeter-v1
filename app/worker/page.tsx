'use client';

import React, { useState, useEffect } from 'react';
import {
  HardHat,
  User,
  Building,
  MapPin,
  CheckCircle,
  Edit3,
  Camera,
  RotateCcw,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import {
  WorkerProfile,
  getStoredWorkerProfile,
  saveWorkerProfile,
  DEFAULT_FACILITIES,
  DEFAULT_PLANT_ZONES,
  ScanRecord,
} from '@/lib/db';
import { ColorimetryResult, evaluateLeadAcetateExposure } from '@/lib/colorimetry';
import { LEAD_ACETATE_CALIBRATION_ANCHORS } from '@/lib/calibrationData';
import { DosimeterScanner } from '@/components/DosimeterScanner';
import { WorkerVerdict } from '@/components/WorkerVerdict';

export default function WorkerPage() {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);

  // Form State
  const [workerName, setWorkerName] = useState<string>('Rajesh Kumar');
  const [workerId, setWorkerId] = useState<string>('W1023');
  const [facility, setFacility] = useState<string>(DEFAULT_FACILITIES[0]);
  const [plantZone, setPlantZone] = useState<string>(DEFAULT_PLANT_ZONES[0]);

  // Scanner & Result State
  const [activeResult, setActiveResult] = useState<ColorimetryResult | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastTransmission, setLastTransmission] = useState<ScanRecord | null>(null);

  useEffect(() => {
    let existing = getStoredWorkerProfile();
    if (!existing) {
      existing = {
        workerId: 'W1023',
        workerName: 'Rajesh Kumar',
        facility: DEFAULT_FACILITIES[0],
        plantZone: DEFAULT_PLANT_ZONES[0],
        registeredAt: new Date().toISOString(),
      };
      saveWorkerProfile(existing);
    }
    setProfile(existing);
    setWorkerName(existing.workerName);
    setWorkerId(existing.workerId);
    setFacility(existing.facility);
    setPlantZone(existing.plantZone);
    setIsEditingProfile(false);

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const testPpmStr = urlParams.get('testPpm');
      if (testPpmStr !== null) {
        const testPpmNum = parseFloat(testPpmStr);
        const anchor = LEAD_ACETATE_CALIBRATION_ANCHORS.find(
          (a) => Math.abs(a.h2sPpm - testPpmNum) < 1.5
        ) || LEAD_ACETATE_CALIBRATION_ANCHORS[3];

        let thumbnailSrc: string | undefined = undefined;
        try {
          const cvs = document.createElement('canvas');
          cvs.width = 300;
          cvs.height = 300;
          const ctx = cvs.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 300, 300);
            ctx.beginPath();
            ctx.arc(150, 150, 110, 0, 2 * Math.PI);
            ctx.fillStyle = '#FAF7F0';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(150, 150, 55, 0, 2 * Math.PI);
            ctx.fillStyle = anchor.hex;
            ctx.fill();
            thumbnailSrc = cvs.toDataURL('image/jpeg', 0.85);
          }
        } catch (e) {
          // ignore offscreen canvas error in headless environments
        }

        const res = evaluateLeadAcetateExposure(
          anchor.rgb,
          { r: 250, g: 250, b: 248 },
          thumbnailSrc
        );
        setActiveResult(res);
      }
    }
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim() || !workerId.trim()) return;

    const newProfile: WorkerProfile = {
      workerId: workerId.trim().toUpperCase(),
      workerName: workerName.trim(),
      facility,
      plantZone,
      registeredAt: profile?.registeredAt || new Date().toISOString(),
    };

    saveWorkerProfile(newProfile);
    setProfile(newProfile);
    setIsEditingProfile(false);
  };

  const handleScanComplete = (result: ColorimetryResult) => {
    setActiveResult(result);
  };

  const handleRetake = () => {
    setActiveResult(null);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 max-w-lg mx-auto w-full space-y-4">
      {/* Worker Terminal Header */}
      <div className="w-full flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
            <HardHat className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold font-mono text-slate-100">
              {profile ? profile.workerName : 'Worker Terminal'}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {profile ? `${profile.workerId} • ${profile.plantZone.split('/')[0]}` : 'Registration Pending'}
            </span>
          </div>
        </div>

        {profile && !isEditingProfile && (
          <button
            onClick={() => setIsEditingProfile(true)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 transition"
            title="Edit Profile"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 1. Profile Setup Form Modal / View */}
      {isEditingProfile && (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400" />
              Personnel & Badge Authentication
            </h2>
            <p className="text-xs text-slate-400">
              Configures plant facility location and badge identification
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Worker Full Name</label>
              <input
                type="text"
                required
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Badge ID / Worker Code</label>
              <input
                type="text"
                required
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                placeholder="e.g. W1023"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Refinery / Facility</label>
              <select
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              >
                {DEFAULT_FACILITIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Assigned Plant Sector / Zone</label>
              <select
                value={plantZone}
                onChange={(e) => setPlantZone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              >
                {DEFAULT_PLANT_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-950 bg-sky-400 hover:bg-sky-300 transition shadow-lg shadow-sky-400/20 active:scale-98 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Save & Open Dosimeter Scanner
            </button>
          </form>
        </div>
      )}

      {/* 2. Live Scanner View or Verdict Screen */}
      {!isEditingProfile && profile && (
        <div className="w-full">
          {activeResult ? (
            <WorkerVerdict
              result={activeResult}
              profile={profile}
              onRetake={handleRetake}
              onTransmitted={(rec) => setLastTransmission(rec)}
            />
          ) : (
            <DosimeterScanner onScanComplete={handleScanComplete} />
          )}
        </div>
      )}
    </div>
  );
}
