/**
 * H2S-SafeTrack: Real-Time Telemetry Event Bus
 * 
 * Uses the HTML5 BroadcastChannel API to synchronize telemetry between
 * Worker Mobile PWA and Supervisor EHS Dashboard in real-time across tabs/windows.
 * Chemocassette: Lead(II) Acetate (Pb(CH3COO)2) Trihydrate.
 */

import { ScanRecord, saveScanRecord } from './db';

export type TelemetryEventType =
  | 'NEW_SCAN'
  | 'RESCAN_REQUEST'
  | 'EMERGENCY_ALARM'
  | 'ALARM_DISMISSED';

export interface TelemetryEvent {
  type: TelemetryEventType;
  payload: any;
  timestamp: string;
}

type EventCallback = (event: TelemetryEvent) => void;

class TelemetryEventBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<EventCallback> = new Set();
  private isBrowser: boolean;

  constructor() {
    this.isBrowser = typeof window !== 'undefined';
    if (this.isBrowser && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('h2s_safetrack_telemetry');
        this.channel.onmessage = (messageEvent) => {
          const data: TelemetryEvent = messageEvent.data;
          this.notifyListeners(data);
        };
      } catch (err) {
        console.warn('[TelemetryBus] BroadcastChannel not available, using storage events:', err);
      }
    }

    if (this.isBrowser) {
      // Fallback cross-tab sync using storage events
      window.addEventListener('storage', (ev) => {
        if (ev.key === 'h2s_safetrack_broadcast_event' && ev.newValue) {
          try {
            const data: TelemetryEvent = JSON.parse(ev.newValue);
            this.notifyListeners(data);
          } catch (e) {
            console.error('[TelemetryBus] Error parsing storage event:', e);
          }
        }
      });
    }
  }

  public subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(event: TelemetryEvent) {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (e) {
        console.error('[TelemetryBus] Listener error:', e);
      }
    });
  }

  public broadcast(type: TelemetryEventType, payload: any) {
    const event: TelemetryEvent = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    // If new scan, persist
    if (type === 'NEW_SCAN' && payload) {
      saveScanRecord(payload as ScanRecord);
    }

    // Broadcast across tabs
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (e) {
        console.warn('[TelemetryBus] postMessage failed:', e);
      }
    }

    if (this.isBrowser) {
      try {
        localStorage.setItem('h2s_safetrack_broadcast_event', JSON.stringify(event));
      } catch {
        // quota exceeded or private mode
      }
    }

    // Also notify listeners in current window
    this.notifyListeners(event);
  }

  public broadcastScan(record: ScanRecord) {
    this.broadcast('NEW_SCAN', record);
    if (record.ppm >= 10.0) {
      this.broadcast('EMERGENCY_ALARM', record);
    }
  }

  public requestRescan(workerId: string, zone: string) {
    this.broadcast('RESCAN_REQUEST', { workerId, zone, requestedAt: new Date().toISOString() });
  }

  public dismissAlarm(workerId: string) {
    this.broadcast('ALARM_DISMISSED', { workerId });
  }
}

export const telemetryBus = new TelemetryEventBus();
