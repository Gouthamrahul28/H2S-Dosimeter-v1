# Shared API Contract — Cu-PAN H₂S Dosimeter System (SIH26118)

Base URL: `http://localhost:5000/api/v1` (and `http://<host-ip>:5000/api/v1`)

---

## Chemistry Specification
- **Chemistry:** Cu-PAN (copper(II) complex of 1-(2-pyridylazo)-2-naphthol)
- **Primary Dosimetry Unit:** `ppm·h` (Cumulative Exposure Dose = $\int C(t) dt$)
- **Reaction:** $\text{Cu(II)-PAN} + \text{H}_2\text{S} \to \text{CuS} + \text{H-PAN}$ (Purple/Violet $\to$ Yellow/Orange)

---

## Endpoints

### 1. Optical Scan & Exposure Analysis
**`POST /api/v1/scan`** (alias: `POST /api/v1/readings`)

Submit a captured Cu-PAN wristband photo for chromatic normalization, CIEDE2000 analysis, and cumulative dose calculation.

**Request Body:**
```json
{
  "workerId": "W1023",
  "shiftId": "2026-09-01-A",
  "imageBase64": "data:image/jpeg;base64,...",
  "ambientTemp": 25.0,
  "ambientHumidity": 60.0,
  "capturedAt": "2026-09-01T14:05:00.000Z"
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "chemistry": "Cu-PAN",
  "dose": 7.4,
  "unit": "ppm·h",
  "confidence": 0.94,
  "calibration_status": "VALID",
  "readingId": "665f...",
  "workerId": "W1023",
  "shiftId": "2026-09-01-A",
  "stripColorRGB": { "r": 168, "g": 115, "b": 130 },
  "referenceColorRGB": { "r": 250, "g": 250, "b": 250 },
  "greyColorRGB": { "r": 128, "g": 128, "b": 128 },
  "correctedColorRGB": { "r": 168, "g": 115, "b": 130 },
  "lab": { "L": 52.0, "a": 26.5, "b": 2.8 },
  "deltaE00": 19.6,
  "alertLevel": "CAUTION",
  "alertColor": "#06b6d4",
  "alertBadgeClass": "caution",
  "alertNote": "Approaching ACGIH TWA threshold.",
  "qualityStatus": "GOOD",
  "qualityScore": 94,
  "rateFactor": 1.05,
  "createdAt": "2026-09-01T14:05:03.120Z"
}
```

If the sample optical change exceeds experimental bounds:
```json
{
  "success": false,
  "chemistry": "Cu-PAN",
  "dose": 0.0,
  "unit": "ppm·h",
  "confidence": 0.20,
  "calibration_status": "OUTSIDE CALIBRATION RANGE",
  "reason": "OUTSIDE_CALIBRATION_RANGE"
}
```

---

### 2. Camera Calibration Matrix (CCM)
**`POST /api/v1/calibration/camera`**

Submit camera reference target captures to characterize device-specific CCM.

**Request Body:**
```json
{
  "cameraId": "mobile_001",
  "referenceIlluminant": "D65",
  "measuredPatches": [
    { "patchId": 1, "rgb": [245, 245, 245], "referenceXyz": [0.9504, 1.0000, 1.0888] }
  ]
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "camera_id": "mobile_001",
  "ccm": [
    [0.4124, 0.3575, 0.1804],
    [0.2126, 0.7151, 0.0721],
    [0.0193, 0.1191, 0.9503]
  ],
  "reference_white": "D65",
  "avg_delta_e00": 1.15
}
```

---

### 3. Record Experimental Cu-PAN Calibration Point
**`POST /api/v1/calibration/cupan`**

Log empirical gas calibration chamber sample.

**Request Body:**
```json
{
  "sample_id": "CUPAN_001",
  "chemistry": "Cu-PAN",
  "h2s_ppm": 5.0,
  "exposure_minutes": 30,
  "dose_ppm_min": 150.0,
  "temperature_c": 25.0,
  "humidity_percent": 60.0,
  "rgb": { "r": 154, "g": 100, "b": 150 },
  "lab": { "L": 47.30, "a": 31.20, "b": -11.50 },
  "delta_e00": 11.20
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "sample_id": "CUPAN_001",
  "chemistry": "Cu-PAN",
  "dose_ppm_h": 2.5,
  "recorded_at": "2026-09-01T14:00:00Z"
}
```

---

### 4. Retrieve Active Cu-PAN Calibration Profile
**`GET /api/v1/calibration/cupan`**

Get active Cu-PAN calibration dataset, baseline coordinates, and model parameters.

**Response `200 OK`:**
```json
{
  "chemistry": "Cu-PAN",
  "indicator": "Copper(II)-PAN",
  "substrate": "Regenerated Cellulose / Paper Matrix",
  "virgin_baseline_lab": { "L": 42.50, "a": 38.20, "b": -28.40 },
  "domain": {
    "min_dose_ppm_h": 0.0,
    "max_dose_ppm_h": 160.0,
    "min_delta_e00": 0.0,
    "max_delta_e00": 75.0
  },
  "sample_count": 11,
  "models": ["Piecewise-Interpolation", "Polynomial-Surface-Regression"]
}
```

---

### 5. Health Check
**`GET /health`** and **`GET /api/v1/health`**

**Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "h2s-dosimeter-backend",
  "chemistry": "Cu-PAN",
  "time": "2026-09-01T14:00:00.000Z"
}
```

---

### 6. Workers & DGMS Statutory Reporting
- **`GET /api/v1/workers`**: List workers
- **`POST /api/v1/workers`**: Register worker
- **`GET /api/v1/workers/:workerId/readings`**: List readings for worker
- **`GET /api/v1/workers/:workerId/cumulative-dose`**: Worker cumulative shift dose vs DGMS 80 ppm·h limit
- **`GET /api/v1/reports/dgms?from=YYYY-MM-DD&to=YYYY-MM-DD`**: Multi-worker DGMS statutory compliance report
