# H₂S Dosimeter — Supervisor Dashboard

Office-facing web application for safety officers, industrial hygienists, and plant managers to monitor worker cumulative H₂S exposure, evaluate shift trend charts, track statutory threshold exceedances, and generate printable DGMS / OISD-STD-114 compliance reports (SIH26118).

## Port & Config
- **Dev Port**: `5174`
- **Backend API**: `http://localhost:5000/api/v1` (configured via `VITE_API_BASE_URL`)

## Directory Structure
```
dashboard/
├── src/
│   ├── components/
│   │   ├── ExposureChart.jsx   # Recharts area & bar charts for shift exposure trends
│   │   ├── WorkerTable.jsx     # Sortable roster table with over-threshold visual flags
│   │   └── ThresholdBadge.jsx  # Reusable status pill (Safe / Approaching / Over Limit)
│   ├── pages/
│   │   ├── Overview.jsx        # Fleet KPI metrics, alarm alerts & worker table
│   │   ├── WorkerHistory.jsx   # Single worker exposure progression & audit trail
│   │   └── DGMSReport.jsx      # Directorate General of Mines Safety official report generator
│   ├── services/
│   │   └── api.js              # REST API client
│   ├── App.jsx                 # Sidebar navigation & page router
│   ├── main.jsx
│   └── index.css               # Theme tokens & @media print styles
├── package.json
├── vite.config.js
└── .env.example
```

## Quick Start

### 1. Install Dependencies
```bash
cd dashboard
npm install
```

### 2. Environment Setup
Create a `.env` file (copied from `.env.example`):
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### 3. Run Development Server
```bash
npm run dev
```
Dashboard will be running on `http://localhost:5174`.

## Features
- **Fleet Exposure Overview**: Displays all registered workers, cumulative ppm·hours, and automatic visual highlighting for workers exceeding the 80 ppm·h DGMS limit.
- **Exposure Progression Analysis**: Interactive Recharts visualization comparing shift doses against the statutory threshold line.
- **Reading-by-Reading Audit**: Full transparency into raw strip RGB, reference standard RGB, lighting-corrected RGB, and expiry status for each shift.
- **DGMS / OISD-STD-114 Compliance Export**: Generates date-filtered statutory registers with CSV export and official print stylesheet (`@media print`) ready for formal safety audits.
