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

/**
 * Get active Cu-PAN calibration profile
 */
export async function getCuPanCalibration() {
  return request('/calibration/cupan');
}

/**
 * Get recent readings across all workers
 */
export async function getRecentReadings(limit = 10) {
  try {
    const workers = await getWorkers();
    if (!workers || workers.length === 0) return [];
    const allReadings = await Promise.all(
      workers.slice(0, 3).map((w) => getWorkerReadings(w.workerId).catch(() => []))
    );
    return allReadings.flat().slice(0, limit);
  } catch (e) {
    return [];
  }
}

/**
 * Get all Cu-PAN manufacturing batches
 */
export async function getBatches() {
  return request('/strip/batches');
}

/**
 * Create a new Cu-PAN batch
 */
export async function createBatch(batchData) {
  return request('/admin/batches', {
    method: 'POST',
    body: JSON.stringify(batchData)
  });
}

/**
 * Update batch validation parameters
 */
export async function validateBatch(batchId, validationData) {
  return request(`/admin/batches/${encodeURIComponent(batchId)}/validate`, {
    method: 'POST',
    body: JSON.stringify(validationData)
  });
}

/**
 * Recall a contaminated/expired batch
 */
export async function recallBatch(batchId) {
  return request(`/admin/batches/${encodeURIComponent(batchId)}/recall`, {
    method: 'POST'
  });
}

/**
 * Get Cu-PAN Calibration Summary KPI & Status
 */
export async function getCalibrationSummary() {
  return request('/calibration/summary');
}

/**
 * Get 200-sample calibration dataset with filters & pagination
 */
export async function getCalibrationDataset(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/calibration/dataset${query ? `?${query}` : ''}`);
}

/**
 * Get Multi-Model comparison metrics
 */
export async function getCalibrationMetrics() {
  return request('/calibration/metrics');
}

/**
 * Get coordinates for all 5 calibration & model visualization graphs
 */
export async function getCalibrationGraphs() {
  return request('/calibration/graphs');
}

/**
 * Get active published model metadata
 */
export async function getCalibrationModel() {
  return request('/calibration/model');
}

/**
 * Ingest new experimental calibration data (Single or Batch)
 */
export async function addCalibrationData(samples) {
  return request('/calibration/data/add', {
    method: 'POST',
    body: JSON.stringify(samples)
  });
}

/**
 * Get pending calibration samples awaiting approval
 */
export async function getPendingCalibrationData() {
  return request('/calibration/data/pending');
}

/**
 * Approve pending data and create next cumulative master dataset version
 */
export async function approvePendingCalibrationData() {
  return request('/calibration/data/approve', {
    method: 'POST'
  });
}

/**
 * Get all historical dataset and model versions
 */
export async function getCalibrationVersions() {
  return request('/calibration/versions');
}

/**
 * Train a candidate model on the cumulative master dataset
 */
export async function trainCandidateModel() {
  return request('/calibration/candidate/train', {
    method: 'POST'
  });
}

/**
 * Compare current published model vs candidate model side-by-side
 */
export async function compareCandidateModel() {
  return request('/calibration/candidate/compare');
}

/**
 * Publish candidate model to production
 */
export async function publishCandidateModel() {
  return request('/calibration/candidate/publish', {
    method: 'POST'
  });
}

/**
 * Rollback production model to a previous version
 */
export async function rollbackCalibrationModel(targetVersion) {
  return request('/calibration/rollback', {
    method: 'POST',
    body: JSON.stringify({ target_version: targetVersion })
  });
}

/**
 * Get 2D Dose x Temperature calibration coverage matrix & priority
 */
export async function getCalibrationCoverage() {
  return request('/calibration/coverage');
}

/**
 * Get real dataset growth and accuracy progression trends over versions
 */
export async function getCalibrationTrends() {
  return request('/calibration/trends');
}

/**
 * Get Lead Acetate experimental calibration dataset and fit metrics
 */
export async function getLeadAcetateDataset() {
  return request('/calibration/lead-acetate/dataset');
}


