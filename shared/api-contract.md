# Shared API Contract — H₂S Dosimeter System

Base URL: `http://localhost:5000/api/v1`

---

## Endpoints

### 1. Submit Reading
**`POST /readings`**

Submit a captured wristband photo for processing (color extraction, lighting correction, dose calculation, and logging).

**Request Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "workerId": "W1023",
  "shiftId": "2026-08-31-A",
  "imageBase64": "data:image/jpeg;base64,...",
  "ambientTemp": 32.5,
  "ambientHumidity": 61,
  "capturedAt": "2026-08-31T14:05:00.000Z"
}
```

**Response `201 Created`:**
```json
{
  "readingId": "665f...",
  "workerId": "W1023",
  "shiftId": "2026-08-31-A",
  "stripColorRGB": { "r": 140, "g": 96, "b": 210 },
  "referenceColorRGB": { "r": 255, "g": 255, "b": 255 },
  "correctedColorRGB": { "r": 150, "g": 90, "b": 200 },
  "expiryPatchStatus": "valid",
  "estimatedDosePpmHours": 42.7,
  "calibrationCurveVersion": "placeholder-v1",
  "createdAt": "2026-08-31T14:05:03.120Z"
}
```

---

### 2. List Workers
**`GET /workers`**

List all registered workers in the system.

**Response `200 OK`:**
```json
[
  {
    "workerId": "W1023",
    "name": "Rajesh Kumar",
    "department": "Drilling & Extraction"
  },
  {
    "workerId": "W1024",
    "name": "Priya Sharma",
    "department": "Refinery Unit 4"
  }
]
```

---

### 3. Create Worker
**`POST /workers`**

Register a new worker.

**Request Body:**
```json
{
  "workerId": "W1023",
  "name": "Rajesh Kumar",
  "department": "Drilling & Extraction"
}
```

**Response `201 Created`:**
```json
{
  "workerId": "W1023",
  "name": "Rajesh Kumar",
  "department": "Drilling & Extraction"
}
```

---

### 4. Worker Exposure Readings
**`GET /workers/:workerId/readings`**

All readings for a specific worker, sorted with most recent first.

**Response `200 OK`:**
```json
[
  {
    "readingId": "665f...",
    "workerId": "W1023",
    "shiftId": "2026-08-31-A",
    "stripColorRGB": { "r": 140, "g": 96, "b": 210 },
    "referenceColorRGB": { "r": 255, "g": 255, "b": 255 },
    "correctedColorRGB": { "r": 150, "g": 90, "b": 200 },
    "expiryPatchStatus": "valid",
    "estimatedDosePpmHours": 42.7,
    "calibrationCurveVersion": "placeholder-v1",
    "createdAt": "2026-08-31T14:05:03.120Z"
  }
]
```

---

### 5. Worker Cumulative Dose
**`GET /workers/:workerId/cumulative-dose`**

Get aggregated cumulative exposure dose across all shifts for a worker and check against safety threshold.

**Response `200 OK`:**
```json
{
  "workerId": "W1023",
  "totalDosePpmHours": 187.4,
  "readingCount": 6,
  "thresholdPpmHours": 80,
  "overThreshold": true
}
```

---

### 6. DGMS / OISD Compliance Report
**`GET /reports/dgms?from=YYYY-MM-DD&to=YYYY-MM-DD`**

Returns per-worker exposure summaries for DGMS / OISD occupational health reporting for the specified date range.

**Response `200 OK`:**
```json
[
  {
    "workerId": "W1023",
    "name": "Rajesh Kumar",
    "department": "Drilling & Extraction",
    "totalDosePpmHours": 187.4,
    "readingCount": 6,
    "thresholdPpmHours": 80,
    "overThreshold": true
  }
]
```

---

## Error Handling

All endpoints return a uniform error object on failure with standard HTTP 4xx/5xx status codes:

```json
{
  "error": "human readable message"
}
```
