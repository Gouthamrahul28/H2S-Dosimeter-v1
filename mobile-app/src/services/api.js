/**
 * mobile-app/src/services/api.js
 * 
 * REST API client targeting the shared H2S Dosimeter backend contract.
 * Includes an offline queue mechanism to persist pending readings when
 * working in remote field/offshore sites without active internet.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const QUEUE_STORAGE_KEY = 'h2s_offline_pending_readings';

/**
 * Generic fetch wrapper with error handling
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || `HTTP error ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err);
    throw err;
  }
}

/**
 * Fetch all registered workers (with local cache fallback)
 */
export async function getWorkers() {
  try {
    const workers = await request('/workers');
    localStorage.setItem('h2s_cached_workers', JSON.stringify(workers));
    return workers;
  } catch (err) {
    const cached = localStorage.getItem('h2s_cached_workers');
    if (cached) {
      console.warn('[Offline Mode] Serving workers from local cache.');
      return JSON.parse(cached);
    }
    throw err;
  }
}

/**
 * Fetch a worker's cumulative exposure dose
 */
export async function getWorkerCumulativeDose(workerId) {
  return request(`/workers/${encodeURIComponent(workerId)}/cumulative-dose`);
}

/**
 * Fetch all past readings for a worker
 */
export async function getWorkerReadings(workerId) {
  return request(`/workers/${encodeURIComponent(workerId)}/readings`);
}

/**
 * Queue a reading for later upload if network is disconnected
 */
export function queueOfflineReading(payload) {
  const existing = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
  existing.push({
    ...payload,
    queuedAt: new Date().toISOString()
  });
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(existing));
}

/**
 * Retrieve pending offline readings
 */
export function getPendingOfflineQueue() {
  return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
}

/**
 * Synchronize pending offline readings to backend
 */
export async function syncPendingQueue() {
  const queue = getPendingOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let remaining = [];

  for (const item of queue) {
    try {
      await submitReading(item);
      synced++;
    } catch (e) {
      remaining.push(item);
    }
  }

  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
  return { synced, remaining: remaining.length };
}

/**
 * Submit a captured wristband photo for color extraction and dose calculation
 */
export async function submitReading(payload) {
  return request('/readings', {
    method: 'POST',
    body: JSON.stringify({
      workerId: payload.workerId,
      shiftId: payload.shiftId,
      imageBase64: payload.imageBase64,
      ambientTemp: Number(payload.ambientTemp) || 25.0,
      ambientHumidity: Number(payload.ambientHumidity) || 50.0,
      capturedAt: payload.capturedAt || new Date().toISOString()
    })
  });
}

// Auto-sync whenever internet connectivity is restored
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] Reconnected. Attempting offline queue synchronization...');
    syncPendingQueue()
      .then((res) => {
        if (res.synced > 0) {
          console.log(`[Sync] Successfully synced ${res.synced} offline readings.`);
        }
      })
      .catch((err) => console.warn('[Sync] Auto-sync failed:', err));
  });
}
