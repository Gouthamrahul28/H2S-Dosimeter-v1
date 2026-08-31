# H₂S Dosimeter System (Component 4 — SIH26118)

> **Passive H₂S Exposure Dosimeter Wristband Software Suite**
>
> An integrated end-to-end platform for optical exposure reading, chromatic lighting normalization, swappable calibration curve estimation, and DGMS / OISD statutory occupational health reporting in oil & gas and mining operations in India.

---

## System Architecture

```
h2s-dosimeter-system/
├── README.md                 <- Root architecture & integration guide
├── shared/
│   ├── api-contract.md       <- Shared REST API specifications (Base: http://localhost:5000/api/v1)
│   └── schema.js             <- Mongoose & data model contract definitions
├── backend/                  <- Node.js + Express + MongoDB + Sharp (Port 5000)
├── mobile-app/               <- React (Vite) PWA Field Camera App (Port 5173)
└── dashboard/                <- React (Vite) + Recharts Safety Supervisor Web App (Port 5174)
```

---

## Technology Stack & Ports

| Subsystem | Stack | Dev Port | Environment Config |
|---|---|---|---|
| **`backend`** | Node.js, Express, MongoDB (Mongoose), Sharp | `5000` | `PORT=5000`<br>`MONGODB_URI=mongodb://localhost:27017/h2s-dosimeter` |
| **`mobile-app`** | React 18, Vite, Lucide Icons, getUserMedia PWA | `5173` | `VITE_API_BASE_URL=http://localhost:5000/api/v1` |
| **`dashboard`** | React 18, Vite, Recharts, Lucide Icons | `5174` | `VITE_API_BASE_URL=http://localhost:5000/api/v1` |

---

## Quick Start & Complete Run Guide

### Step 1: Start Backend (Port 5000)
```bash
cd backend
npm install
npm run seed      # Seeds 3 test workers & sample wristband exposure history
npm start         # Starts Express API at http://localhost:5000
```

### Step 2: Start Mobile Field App (Port 5173)
```bash
cd mobile-app
npm install
npm run dev       # Runs Vite dev server at http://localhost:5173
```

### Step 3: Start Supervisor Dashboard (Port 5174)
```bash
cd dashboard
npm install
npm run dev       # Runs Vite dev server at http://localhost:5174
```

---

## Calibration & Optical Pipeline

1. **Spatial Extraction**: Configurable region sampling extracts RGB values from:
   - **Reference Patch** (Top-Left Quadrant, 10%–30% bounds): Standard white reference standard.
   - **Active H₂S Strip** (Center, 38%–62% bounds): Chemical indicator that darkens permanently with cumulative H₂S exposure.
   - **Expiry Patch** (Top-Right Quadrant, 70%–90% bounds): Shelf-life validity indicator.
2. **Lighting Normalization**: Chromatic adaptation scales raw strip RGB against the measured reference patch to eliminate ambient illumination tint and phone sensor variance.
3. **Swappable Calibration Engine**: Versioned curve registry (`CALIBRATION_CURVES`) maps corrected optical darkening metrics to cumulative exposure in **ppm·hours** (`placeholder-v1`), ready for empirical laboratory calibration curve drop-in.
4. **Expiry Patch Verification**: Automatically assesses image quality and expiry degradation, flagging badges as `valid`, `expired`, or `unreadable`.

---

## Statutory Safety Standards
- **DGMS (Directorate General of Mines Safety)** & **OISD-STD-114** compliance threshold: **80.0 ppm·hours**.
- Automatically alerts supervisors when any worker's cumulative exposure approaches (≥ 75%) or exceeds the limit.
- Printable statutory register with `@media print` styling for formal regulatory submissions.
