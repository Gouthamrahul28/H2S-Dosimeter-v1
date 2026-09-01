/**
 * dashboard/src/services/api.js
 * 
 * API service for the Supervisor Dashboard.
 * Interacts with the backend according to shared/api-contract.md.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.error || `HTTP error ${res.status}: ${res.statusText}`;
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err);
    throw err;
  }
}

/**
 * List all workers
 */
export async function getWorkers() {
  return request('/workers');
}

/**
 * Register a new worker
 */
export async function createWorker(workerData) {
  return request('/workers', {
    method: 'POST',
    body: JSON.stringify(workerData)
  });
}

/**
 * Get cumulative exposure dose for a specific worker
 */
export async function getWorkerCumulativeDose(workerId) {
  return request(`/workers/${encodeURIComponent(workerId)}/cumulative-dose`);
}

/**
 * Get all reading-by-reading history for a worker
 */
export async function getWorkerReadings(workerId) {
  return request(`/workers/${encodeURIComponent(workerId)}/readings`);
}

/**
 * Generate DGMS / OISD occupational health compliance report for date range
 */
export async function getDGMSReport(from = '', to = '') {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  return request(`/reports/dgms${queryStr}`);
}
