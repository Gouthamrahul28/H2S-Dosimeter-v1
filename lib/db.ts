/**
 * H2S-SafeTrack: LocalStorage & Offline-First Persistence Layer
 * 
 * Chemistry: Lead(II) Acetate Trihydrate.
 */

import { SafetyAlertLevel } from './calibrationData';

export interface WorkerProfile {
  workerId: string;
  workerName: string;
  facility: string;
  plantZone: string;
  registeredAt: string;
}

export interface ScanRecord {
  id: string;
  workerId: string;
  workerName: string;
  facility: string;
  zone: string;
  timestamp: string;
  shiftHoursElapsed: number;
  ppm: number;
  deltaE: number;
  opticalDensity: number;
  sampleLab: { L: number; a: number; b: number };
  sampleHex: string;
  nearestAnchorHex: string;
  status: SafetyAlertLevel;
  badgeClass: 'safe' | 'trace' | 'caution' | 'warning' | 'danger' | 'critical';
  confidenceScore: number;
  coordinates: { lat: number; lng: number };
  batteryLevel?: number;
  synced: boolean;
}

const PROFILE_KEY = 'h2s_safetrack_worker_profile';
const SCANS_KEY = 'h2s_safetrack_scan_logs';
const QUEUE_KEY = 'h2s_safetrack_offline_queue';

export const DEFAULT_FACILITIES = [
  'Jamnagar Refining Complex',
  'Mangalore Petrochemical Plant',
  'Barmer Upstream Facility',
  'Offshore Platform Alpha-4',
];

export const DEFAULT_PLANT_ZONES = [
  'Crude Distillation Unit 3 (CDU-3)',
  'Desulfurization Yard & Claus Sulfur Plant',
  'Sewer Manhole B-12 / Sump Trench',
  'Offshore Pigging & Flare Header Platform',
  'Amine Treating Unit & Sour Gas Separator',
  'Wastewater Effluent Neutralization Tank',
];

export const SEEDED_SHIFT_WORKERS: ScanRecord[] = [
  {
    id: 'SCAN-20260904-001',
    workerId: 'W1023',
    workerName: 'Rajesh Kumar',
    facility: 'Jamnagar Refining Complex',
    zone: 'Crude Distillation Unit 3 (CDU-3)',
    timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    shiftHoursElapsed: 4.2,
    ppm: 1.8,
    deltaE: 18.4,
    opticalDensity: 0.16,
    sampleLab: { L: 85.2, a: 1.2, b: 18.5 },
    sampleHex: '#DECBA4',
    nearestAnchorHex: '#DECBA4',
    status: 'SAFE / TRACE',
    badgeClass: 'trace',
    confidenceScore: 96,
    coordinates: { lat: 22.4712, lng: 70.0592 },
    batteryLevel: 88,
    synced: true,
  },
  {
    id: 'SCAN-20260904-002',
    workerId: 'W1024',
    workerName: 'Priya Sharma',
    facility: 'Jamnagar Refining Complex',
    zone: 'Desulfurization Yard & Claus Sulfur Plant',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    shiftHoursElapsed: 4.0,
    ppm: 7.2,
    deltaE: 49.5,
    opticalDensity: 0.54,
    sampleLab: { L: 60.5, a: 10.1, b: 38.8 },
    sampleHex: '#B8894A',
    nearestAnchorHex: '#B8894A',
    status: 'CAUTION',
    badgeClass: 'caution',
    confidenceScore: 92,
    coordinates: { lat: 22.4728, lng: 70.0571 },
    batteryLevel: 74,
    synced: true,
  },
  {
    id: 'SCAN-20260904-003',
    workerId: 'W1025',
    workerName: 'Amit Patel',
    facility: 'Jamnagar Refining Complex',
    zone: 'Sewer Manhole B-12 / Sump Trench',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    shiftHoursElapsed: 4.5,
    ppm: 14.8,
    deltaE: 69.8,
    opticalDensity: 0.82,
    sampleLab: { L: 36.8, a: 14.5, b: 28.2 },
    sampleHex: '#7A4B22',
    nearestAnchorHex: '#7A4B22',
    status: 'WARNING / EXCEEDS PEL',
    badgeClass: 'warning',
    confidenceScore: 94,
    coordinates: { lat: 22.4695, lng: 70.0560 },
    batteryLevel: 62,
    synced: true,
  },
  {
    id: 'SCAN-20260904-004',
    workerId: 'W1026',
    workerName: 'Vikram Singh',
    facility: 'Jamnagar Refining Complex',
    zone: 'Offshore Pigging & Flare Header Platform',
    timestamp: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    shiftHoursElapsed: 3.8,
    ppm: 0.4,
    deltaE: 2.1,
    opticalDensity: 0.02,
    sampleLab: { L: 96.8, a: -0.4, b: 4.0 },
    sampleHex: '#FAF7F0',
    nearestAnchorHex: '#FAF7F0',
    status: 'SAFE',
    badgeClass: 'safe',
    confidenceScore: 98,
    coordinates: { lat: 22.4735, lng: 70.0610 },
    batteryLevel: 91,
    synced: true,
  },
  {
    id: 'SCAN-20260904-005',
    workerId: 'W1028',
    workerName: 'Kavita Iyer',
    facility: 'Jamnagar Refining Complex',
    zone: 'Amine Treating Unit & Sour Gas Separator',
    timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    shiftHoursElapsed: 2.5,
    ppm: 28.5,
    deltaE: 84.5,
    opticalDensity: 1.25,
    sampleLab: { L: 18.2, a: 9.1, b: 13.5 },
    sampleHex: '#382012',
    nearestAnchorHex: '#382012',
    status: 'DANGER',
    badgeClass: 'danger',
    confidenceScore: 95,
    coordinates: { lat: 22.4701, lng: 70.0585 },
    batteryLevel: 55,
    synced: true,
  },
  {
    id: 'SCAN-20260904-006',
    workerId: 'W1031',
    workerName: 'Dinesh Nair',
    facility: 'Jamnagar Refining Complex',
    zone: 'Wastewater Effluent Neutralization Tank',
    timestamp: new Date(Date.now() - 30 * 1000).toISOString(),
    shiftHoursElapsed: 5.1,
    ppm: 68.0,
    deltaE: 95.8,
    opticalDensity: 1.92,
    sampleLab: { L: 4.5, a: 1.1, b: 1.6 },
    sampleHex: '#0F0B09',
    nearestAnchorHex: '#0F0B09',
    status: 'CRITICAL HAZARD - EVACUATE',
    badgeClass: 'critical',
    confidenceScore: 97,
    coordinates: { lat: 22.4688, lng: 70.0545 },
    batteryLevel: 48,
    synced: true,
  }
];

export function getStoredWorkerProfile(): WorkerProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveWorkerProfile(profile: WorkerProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getAllScanRecords(): ScanRecord[] {
  if (typeof window === 'undefined') return SEEDED_SHIFT_WORKERS;
  const raw = localStorage.getItem(SCANS_KEY);
  if (!raw) {
    localStorage.setItem(SCANS_KEY, JSON.stringify(SEEDED_SHIFT_WORKERS));
    return SEEDED_SHIFT_WORKERS;
  }
  try {
    const list: ScanRecord[] = JSON.parse(raw);
    return list.length > 0 ? list : SEEDED_SHIFT_WORKERS;
  } catch {
    return SEEDED_SHIFT_WORKERS;
  }
}

export function saveScanRecord(record: ScanRecord): void {
  if (typeof window === 'undefined') return;
  const records = getAllScanRecords();
  // Filter out any existing with same id
  const updated = [record, ...records.filter((r) => r.id !== record.id)];
  localStorage.setItem(SCANS_KEY, JSON.stringify(updated));

  // If offline, also enqueue
  if (!navigator.onLine) {
    const queueRaw = localStorage.getItem(QUEUE_KEY);
    const queue: ScanRecord[] = queueRaw ? JSON.parse(queueRaw) : [];
    queue.push(record);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

export function getOfflineQueueCount(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  try {
    return JSON.parse(raw).length;
  } catch {
    return 0;
  }
}

export function flushOfflineQueue(): ScanRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const queued: ScanRecord[] = JSON.parse(raw);
    localStorage.removeItem(QUEUE_KEY);
    return queued;
  } catch {
    return [];
  }
}
