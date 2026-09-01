# H₂S Dosimeter System (Component 4 — SIH26118)

> **Passive H₂S Exposure Dosimeter Wristband Software Suite**
>
> An integrated end-to-end platform for optical exposure reading, chromatic lighting normalization, swappable calibration curve estimation, and DGMS / OISD statutory occupational health reporting in oil & gas and mining operations in India.

---

## System Architecture

```
h2s-dosimeter-system/
├── README.md                 <- Root architecture & integration guide
├── h2s_dosimeter/            <- Scientific Camera Color Calibration & Dosimetry Engine (Python)
├── shared/
│   ├── colorimetricStandards.js  <- Shared ES module standards (CIELAB, Bradford, CIEDE2000)
│   ├── colorimetricStandards.cjs <- Shared CommonJS standards for Node backend
│   └── api-contract.md       <- Shared REST API specifications (Base: http://localhost:5000/api/v1)
├── backend/                  <- Node.js + Express + MongoDB + Sharp (Port 5000)
├── mobile-app/               <- React (Vite) PWA Field Camera App (Port 5173)
└── dashboard/                <- React (Vite) + Recharts Safety Supervisor Web App (Port 5174)
```

---

## Technology Stack & Ports

| Subsystem | Stack | Dev Port / CLI | Details |
|---|---|---|---|
| **`h2s_dosimeter`** | Python 3.13, NumPy, SciPy, OpenCV, Matplotlib, Pytest | CLI / Package | Linear RGB → CCM → Bradford CAT → CIELAB → CIEDE2000 → Calibrated Dose |
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

### Step 4: Run Scientific Python Color Calibration Engine
```bash
# Run automated colorimetry & CIEDE2000 unit test suite
pytest -v h2s_dosimeter/tests

# Analyze a wristband scan with full CIELAB & diagnostic trace
python -m h2s_dosimeter.cli analyze --image path/to/scan.jpg

# Fit calibration models on chamber dataset & generate validation plots
python -m h2s_dosimeter.scripts.train_calibration

# Run optical stability benchmark across illumination spectrum (2700K to 7500K)
python -m h2s_dosimeter.scripts.evaluate_stability
```

---

## Scientific Color Calibration & Dosimetry Pipeline

1. **Spatial Extraction & Outlier Rejection**: Bounding box extraction with automated rejection of saturated pixels ($>0.98$), underexposed pixels ($<0.05$), and specular glare ($>2.5\sigma$).
2. **sRGB Linearization**: Precise inverse gamma transformation ($C \le 0.04045 \to C/12.92$, $C > 0.04045 \to ((C+0.055)/1.055)^{2.4}$).
3. **Camera Characterization (CCM)**: Device-specific Color Correction Matrix transforming linear RGB to CIE XYZ tristimulus values.
4. **Bradford Chromatic Adaptation**: Cone-response transform mapping measured scene illuminant ($\mathbf{W}_{\text{src}}$) to Standard D65 daylight ($\mathbf{W}_{\text{ref}}$).
5. **CIE 1976 CIELAB**: Non-linear perceptual color coordinate conversion ($L^*, a^*, b^*$).
6. **CIEDE2000 ($\Delta E_{00}$)**: Standard total color difference metric accounting for lightness, chroma, hue non-linearities and blue rotation interactions.
7. **Experimental Dose Model**: Pluggable models (Piecewise spline and Polynomial surface regression) mapping $(\Delta E_{00}, T, RH) \to \text{Dose}$ [ppm·hours] with explicit `"OUTSIDE CALIBRATION RANGE"` detection.

---

## Statutory Safety Standards
- **DGMS (Directorate General of Mines Safety)** & **OISD-STD-114** compliance threshold: **80.0 ppm·hours**.
- Automatically alerts supervisors when any worker's cumulative exposure approaches (≥ 75%) or exceeds the limit.
- Printable statutory register with `@media print` styling for formal regulatory submissions.
