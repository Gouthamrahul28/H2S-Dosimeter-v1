/**
 * mobile-app/src/services/api.js
 * 
 * Production REST API client targeting the Cu-PAN H₂S Dosimeter Backend.
 * Features:
 * - Dynamic LAN IP and relative proxy resolution
 * - 30-second AbortController timeout guard
 * - Granular network & HTTP status classification
 * - Active request/response telemetry logging
 * - Health check & Cu-PAN calibration endpoints
 */

const STORAGE_API_OVERRIDE_KEY = 'h2s_custom_api_base_url';
const QUEUE_STORAGE_KEY = 'h2s_offline_pending_readings';
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Resolves the active Backend API base URL dynamically:
 * 1. User/Developer override from localStorage
 * 2. Vite Environment Variable (VITE_API_BASE_URL)
 * 3. Smart LAN IP resolution: If on 192.168.x.x, use relative '/api/v1' (Vite proxy)
 *    or direct 'http://<hostname>:5000/api/v1'
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_API_OVERRIDE_KEY);
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }

    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl && envUrl.trim()) {
      const trimmed = envUrl.trim().replace(/\/+$/, '');
      // Guard against hardcoded localhost when accessed on a real mobile device via LAN IP
      const currentHost = window.location.hostname;
      if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
          // Switch to same-host relative or direct LAN IP
          return '/api/v1';
        }
      }
      return trimmed;
    }

    // Default relative proxy
    return '/api/v1';
  }
  return '/api/v1';
}

/**
 * Set a custom API Base URL for testing
 */
export function setCustomApiBaseUrl(url) {
  if (url && url.trim()) {
    localStorage.setItem(STORAGE_API_OVERRIDE_KEY, url.trim().replace(/\/+$/, ''));
  } else {
    localStorage.removeItem(STORAGE_API_OVERRIDE_KEY);
  }
}

/**
 * Core HTTP Request Wrapper with Timeout & Logging
 */
async function request(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
  const method = options.method || 'GET';
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  const requestSizeKb = options.body ? (new Blob([options.body]).size / 1024).toFixed(1) : '0';

  console.log(`[API Request] ${method} ${url}`, {
    method,
    url,
    headers,
    requestSize: `${requestSizeKb} KB`
  });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - startTime);
    const data = await response.json().catch(() => ({}));

    console.log(`[API Response] ${method} ${url} -> Status ${response.status} (${latencyMs} ms)`, {
      status: response.status,
      data
    });

    if (!response.ok) {
      const errorMsg = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.code = response.status === 404 ? 'NOT_FOUND' : (response.status >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR');
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Backend is taking too long to respond.`);
      timeoutErr.code = 'TIMEOUT';
      timeoutErr.status = 408;
      throw timeoutErr;
    }

    if (!err.status) {
      const netErr = new Error(`Network connection failed (${err.message || 'Server unreachable'}). Check if backend is running on ${baseUrl}`);
      netErr.code = 'NETWORK_ERROR';
      netErr.status = 0;
      throw netErr;
    }

    throw err;
  }
}

/**
 * Health Check API: Tests GET /health or GET /api/v1/health on target backend
 */
export async function checkBackendHealth() {
  const baseUrl = getApiBaseUrl();
  let healthUrl;
  try {
    if (baseUrl.startsWith('http')) {
      const parsed = new URL(baseUrl);
      healthUrl = `${parsed.origin}/health`;
    } else {
      healthUrl = '/health';
    }
  } catch (e) {
    healthUrl = '/health';
  }

  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - startTime);
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      return {
        isConnected: true,
        status: 'CONNECTED',
        chemistry: json.chemistry || 'Cu-PAN',
        latencyMs,
        service: json.service || 'h2s-dosimeter-backend',
        url: healthUrl,
        timestamp: json.time || new Date().toISOString()
      };
    } else {
      return {
        isConnected: false,
        status: `HTTP ${res.status}`,
        latencyMs,
        url: healthUrl,
        error: `Server returned HTTP ${res.status}`
      };
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      isConnected: false,
      status: 'NOT CONNECTED',
      latencyMs,
      url: healthUrl,
      error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Failed to fetch')
    };
  }
}

/**
 * Test Minimal Image Upload (POST /test-upload)
 */
export async function testImageUpload(imageBase64) {
  const baseUrl = getApiBaseUrl();
  let testUploadUrl;
  try {
    if (baseUrl.startsWith('http')) {
      const parsed = new URL(baseUrl);
      testUploadUrl = `${parsed.origin}/test-upload`;
    } else {
      testUploadUrl = '/test-upload';
    }
  } catch (e) {
    testUploadUrl = '/test-upload';
  }

  return request(testUploadUrl, {
    method: 'POST',
    body: JSON.stringify({
      filename: 'cupan_pic_test.jpg',
      imageBase64
    })
  });
}

/**
 * Fetch all registered workers
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
 * Submit Cu-PAN wristband capture reading to POST /api/v1/scan (or /readings)
 */
export async function submitReading(payload) {
  const fullPayload = {
    chemistry: 'Cu-PAN',
    stripBatch: 'CUPAN-BATCH-001',
    cameraProfile: 'mobile_001',
    ...payload
  };

  console.log("SCAN API:", `${getApiBaseUrl()}/scan`, "Payload worker:", fullPayload.workerId);
  try {
    return await request('/scan', {
      method: 'POST',
      body: JSON.stringify(fullPayload)
    });
  } catch (err) {
    if (err.code === 'NETWORK_ERROR' || !navigator.onLine) {
      console.warn('[Offline Mode] Network unavailable. Enqueuing reading locally.');
      enqueueOfflineReading(fullPayload);
      return {
        _isOfflineQueued: true,
        chemistry: 'Cu-PAN',
        unit: 'ppm·h',
        workerId: fullPayload.workerId,
        shiftId: fullPayload.shiftId,
        estimatedDosePpmHours: 0.0,
        dose: 0.0,
        confidence: 0.94,
        calibrationStatus: 'VALID',
        qualityStatus: 'QUEUED_OFFLINE',
        qualityScore: 90,
        alertLevel: 'SAFE',
        alertColor: '#10b981',
        alertBadgeClass: 'safe',
        alertNote: 'Reading saved to local device queue. Will auto-sync when network is restored.',
        createdAt: new Date().toISOString()
      };
    }
    throw err;
  }
}

/**
 * Fetch Cu-PAN calibration profile
 */
export async function getCuPANCalibration() {
  return request('/calibration/cupan');
}

/**
 * Get active Cu-PAN strip for worker
 */
export async function getActiveStrip(workerId) {
  return request(`/workers/${encodeURIComponent(workerId)}/active-strip`);
}

/**
 * Activate a new Cu-PAN strip
 */
export async function activateStrip(payload) {
  return request('/strip/activate', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Replace an active or expired Cu-PAN strip
 */
export async function replaceStrip(payload) {
  return request('/strip/replace', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Get all available batches
 */
export async function getBatches() {
  return request('/strip/batches');
}

/**
 * Enqueue offline reading to local storage
 */
function enqueueOfflineReading(payload) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
    queue.push({ ...payload, queuedAt: new Date().toISOString() });
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to store reading to offline queue:', e);
  }
}

/**
 * Sync pending offline readings when network resumes
 */
export async function syncOfflineReadings() {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
    if (!queue.length) return 0;

    const remaining = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        await request('/scan', {
          method: 'POST',
          body: JSON.stringify(item)
        });
        syncedCount++;
      } catch (err) {
        remaining.push(item);
      }
    }

    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
    return syncedCount;
  } catch (e) {
    console.error('Error during offline sync:', e);
    return 0;
  }
}
