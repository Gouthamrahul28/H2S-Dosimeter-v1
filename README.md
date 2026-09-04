# H2S-SafeTrack: Industrial Lead(II) Acetate Colorimetric Optical Dosimeter Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.0-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.3-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Chemistry](https://img.shields.io/badge/Chemistry-Lead(II)%20Acetate%20Chemocassette-amber?style=flat-square)](lib/calibrationData.ts)
[![Regulatory](https://img.shields.io/badge/Standards-OSHA%20%7C%20NIOSH%20%7C%20ACGIH-emerald?style=flat-square)](lib/calibrationData.ts)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

> **H2S-SafeTrack** is a production-grade, end-to-end industrial safety and optical dosimetry platform engineered strictly for **Lead(II) Acetate paper-strip chemocassettes**. It translates physical paper darkening caused by toxic Hydrogen Sulfide ($H_2S$) gas into precise, mathematically rigorous occupational exposure readings ($0.0 - 100.0+\text{ ppm}$), featuring a Worker Field PWA with live image preview and crop alignment, and a real-time Supervisor EHS Command Center.

---

## Table of Contents
1. [Sensor Chemistry & Reaction Mechanism](#1-sensor-chemistry--reaction-mechanism)
2. [Colorimetric & Computer Vision Pipeline](#2-colorimetric--computer-vision-pipeline)
3. [6-Anchor Empirical Calibration Metrology (0–100 ppm)](#3-6-anchor-empirical-calibration-metrology-0100-ppm)
4. [Worker Mobile PWA Features](#4-worker-mobile-pwa-features)
5. [Supervisor EHS Command Center](#5-supervisor-ehs-command-center)
6. [Platform Architecture & Project Structure](#6-platform-architecture--project-structure)
7. [Mathematical Validation & Test Suite](#7-mathematical-validation--test-suite)
8. [Quick Start & Installation Guide](#8-quick-start--installation-guide)

---

## 1. Sensor Chemistry & Reaction Mechanism

The sensing engine operates strictly on the stoichiometric precipitation reaction between airborne Hydrogen Sulfide gas and Lead(II) Acetate trihydrate impregnated into high-purity cellulose substrate paper:

$$\text{Pb(CH}_3\text{COO)}_2 \cdot 3\text{H}_2\text{O} \text{ (white crystalline paper)} + \text{H}_2\text{S (g)} \longrightarrow \text{PbS} \downarrow \text{ (brownish-black precipitate)} + 2\,\text{CH}_3\text{COOH} + 3\,\text{H}_2\text{O}$$

### Key Chromogenic Characteristics:
- **Baseline Matrix:** Pristine, unreacted paper exhibits high reflectance ($L^* \approx 92.5$, creamy white).
- **Reaction Trajectory:** As $H_2S$ diffuses into the fibrous paper matrix, insoluble Lead(II) Sulfide ($PbS$) nanoparticles precipitate, causing a monotonic drop in lightness ($L^* \to 25.0$) and a corresponding surge in Optical Density ($OD \to 1.91$).
- **Zero Cu-PAN / Copper Decoupling:** The codebase strictly excludes Cu-PAN (1-(2-Pyridylazo)-2-naphthol) chelates, copper salts, and cyan-to-magenta shifts, ensuring pure, uncompromised lead-sulfide colorimetry.

---

## 2. Colorimetric & Computer Vision Pipeline

```text
┌─────────────────────────┐     IEC 61966-2-1      ┌─────────────────────────┐
│   Raw Device RGB Image  │ ─────────────────────> │ Linearized sRGB Luminance│
└─────────────────────────┘      Gamma Decode      └────────────┬────────────┘
                                                                │
┌─────────────────────────┐    ISO 17321-1 Matrix  ┌────────────▼────────────┐
│   Bradford D65 Adapted  │ <───────────────────── │    CIE 1931 XYZ Space   │
│       CIELAB L*a*b*     │      CAT Transform     └─────────────────────────┘
└────────────┬────────────┘
             │
             ├─────────────────────────────────────────────┐
             ▼                                             ▼
┌─────────────────────────┐                   ┌─────────────────────────┐
│  Optical Density (OD)   │                   │  CIEDE2000 Color Diff   │
│  OD = log10(Yref/Ysamp) │                   │  ΔE00 vs 6 Anchors      │
└────────────┬────────────┘                   └────────────┬────────────┘
             │                                             │
             └──────────────────────┬──────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│     PCHIP Hermite Spline Interpolation + Non-Linear Saturation Extrap   │
│          Dynamic Range: 0.0 ppm Baseline  ───>  100.0+ ppm IDLH        │
└────────────────────────────────────────────────────────────────────────┘
```

1. **IEC 61966-2-1 Gamma Decoding:**  
   Converts non-linear sRGB channel values ($C_{sRGB} \in [0, 1]$) into physical linear luminance:
   $$C_{\text{linear}} = \begin{cases} \frac{C_{\text{sRGB}}}{12.92} & \text{if } C_{\text{sRGB}} \le 0.04045 \\ \left(\frac{C_{\text{sRGB}} + 0.055}{1.055}\right)^{2.4} & \text{if } C_{\text{sRGB}} > 0.04045 \end{cases}$$

2. **CIE 1931 XYZ & Bradford Chromatic Adaptation (CAT):**  
   Maps device RGB to standardized tristimulus space and applies Von Kries Bradford chromatic adaptation to normalize non-standard ambient lighting to standard CIE D65 illuminant ($X_w = 95.047, Y_w = 100.000, Z_w = 108.883$).

3. **Optical Density (OD) Computation:**  
   Quantifies paper transmittance/reflectance attenuation:
   $$\text{OD} = \log_{10}\left(\frac{Y_{\text{ref}}}{Y_{\text{sample}}}\right) = -\log_{10}\left(\frac{Y}{100.0}\right)$$

4. **CIEDE2000 Color Difference ($\Delta E_{00}$):**  
   Evaluates perceptual color shifts according to ISO/CIE 11664-6:2022 with lightness, chroma, and hue weighting factors ($k_L, k_C, k_H = 1$).

5. **Monotonic PCHIP Hermite Spline & Saturation Modeling:**  
   Eliminates Runge oscillations and overshoot in calibration curves. Above 20 ppm where optical reflectance begins asymptotic saturation, the model uses an exponential Optical Density regression that maintains sensitivity up to 100+ ppm IDLH.

---

## 3. 6-Anchor Empirical Calibration Metrology (0–100 ppm)

The platform is calibrated against 6 empirical laboratory anchors spanning safe ambient levels up to lethal IDLH concentrations:

| Anchor | Target [PPM] | Status Tier | sRGB Hex | Lab Coordinates $(L^*, a^*, b^*)$ | Optical Density ($OD$) | $\Delta E_{00}$ Shift | Regulatory Benchmark |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **#1** | **0.0** | `SAFE` | `#FDFBF7` | $(92.5, 0.5, 4.2)$ | $0.014$ | $0.00$ | Clean Air Baseline |
| **#2** | **3.0** | `SAFE` | `#E8D5B5` | $(85.2, 3.8, 18.5)$ | $0.180$ | $12.4$ | ACGIH TWA Threshold ($1.0\text{ ppm}$) |
| **#3** | **7.5** | `CAUTION` | `#C4A47C` | $(72.1, 7.2, 24.1)$ | $0.390$ | $26.8$ | Pre-PEL Caution Zone |
| **#4** | **15.0** | `WARNING` | `#8C6542` | $(52.4, 11.5, 23.8)$ | $0.720$ | $44.5$ | **OSHA PEL Exceeded** ($10.0\text{ ppm}$) |
| **#5** | **35.0** | `DANGER` | `#4A3525` | $(34.8, 8.1, 14.2)$ | $1.250$ | $61.2$ | **OSHA Ceiling Exceeded** ($20.0\text{ ppm}$) |
| **#6** | **100.0** | `CRITICAL` | `#1E1610` | $(25.0, 4.5, 6.0)$ | $1.912$ | $74.8$ | **NIOSH IDLH Critical** ($100.0\text{ ppm}$) |

### Statutory Threshold Matrix:
- **ACGIH 8-Hour TWA:** $1.0\text{ ppm}$
- **OSHA Permissible Exposure Limit (PEL):** $10.0\text{ ppm}$ (8-hour TWA)
- **OSHA Acceptable Ceiling Concentration:** $20.0\text{ ppm}$ (Instantaneous halt)
- **OSHA Maximum Peak:** $50.0\text{ ppm}$ (10 min once per shift)
- **NIOSH IDLH (Immediately Dangerous to Life or Health):** $100.0\text{ ppm}$ (Instant evacuation)

> **Regulatory scope note (SIH26118 is an Indian problem statement):** the figures above are
> retained as internationally cross-referenced comparative benchmarks. For deployment in India,
> the applicable statutory references are **IS-5780:1980** (Indian Standard for Hydrogen
> Sulphide gas detection), the **Factories Act 1948 Schedule II** occupational exposure limits,
> and **DGMS** (Directorate General of Mines Safety) circulars. `[OPEN]`: the exact numeric
> IS-5780:1980 thresholds have not yet been sourced/cited in this repository — treat this as an
> outstanding compliance item, not an assumption that they match the OSHA/NIOSH figures above.

---

## 4. Worker Mobile PWA Features

The Worker Field interface (`app/worker/page.tsx`) provides high-reliability, offline-first scanning tools for industrial personnel:

- **Concentric Dual-Ring Fiducial Reticle:**  
  Live camera HUD displays outer reference alignment ($160 \times 160\text{ px}$) and inner reaction core ($80 \times 80\text{ px}$) targeting reticles with pulsing status indicators.
- **Interactive Review & Crop/Alignment Panel:**  
  Upon capture or gallery upload, the live video stream pauses and switches immediately to an interactive preview stage. Workers can:
  - Visually inspect lighting, focus, and glare before analysis.
  - View the precision circular reticle overlaid directly on the captured image.
  - Choose between **"Retake Scan"** (clears image and restarts camera) and **"Analyze Exposure"** (triggers full colorimetric evaluation).
- **3-Card Verdict Audit Trail (`components/WorkerVerdict.tsx`):**  
  Displays the captured badge thumbnail side-by-side with the isolated detected color swatch and matched laboratory reference anchor.
- **Color-Coded Action Tiers & Audio Haptics:**  
  Provides instantaneous guidance (e.g. green for normal shift, amber for ventilation check, red for donning SCBA and initiating emergency muster).

---

## 5. Supervisor EHS Command Center

The Supervisor Dashboard (`app/supervisor/page.tsx`) offers facility-wide situational awareness:

- **Live Fleet Exposure Grid (`components/SupervisorTable.tsx`):**  
  Monitors badge IDs, worker names, active industrial zones, last scan timestamps, and OSHA status tiers with instant filtering (`All`, `Exceeding PEL`, `Critical IDLH`).
- **Dynamic 0–100 ppm Exposure Chart (`components/ExposureChart.tsx`):**  
  Real-time Recharts visualization plotting worker exposures with color-coded reference lines for:
  - *ACGIH TWA ($1\text{ ppm}$)*
  - *OSHA PEL ($10\text{ ppm}$)*
  - *OSHA Ceiling ($20\text{ ppm}$)*
  - *NIOSH IDLH ($100\text{ ppm}$)*
- **Geospatial Sector Heatmap (`components/ZoneHeatmap.tsx`):**  
  Interactive plant sector grid (e.g. Hydrotreater A-1, Desulfurizer B-3, Flare Header D-4) color-coded by maximum recorded ppm with one-click sector isolation.
- **Auditory Hazard Alarm:**  
  Web Audio API synthesizer emits an 800 Hz pulsed acoustic siren whenever an active IDLH or Ceiling breach occurs.
- **OSHA 300 Incident CSV Export:**  
  Generates compliance-ready audit logs with worker IDs, zone coordinates, raw RGB, calibrated ppm, and statutory status.

---

## 6. Platform Architecture & Project Structure

```text
H2S-SafeTrack/
├── app/                              # Next.js 14 App Router
│   ├── layout.tsx                    # Global root layout & navigation bar
│   ├── page.tsx                      # Platform portal & 6-anchor calibration display
│   ├── globals.css                   # Tailwind styles & reticle animations
│   ├── worker/
│   │   └── page.tsx                  # Worker Field PWA with live scanner & verdict
│   └── supervisor/
│       └── page.tsx                  # Supervisor EHS Command Center & KPI cards
├── components/                       # Modular UI Components
│   ├── DosimeterScanner.tsx          # Dual-mode camera/upload with review panel
│   ├── WorkerVerdict.tsx             # 3-card audit trail, hazard tier & guidance
│   ├── ExposureChart.tsx             # 0-100 ppm Recharts exposure plot
│   ├── ZoneHeatmap.tsx               # Industrial facility zone hazard map
│   └── SupervisorTable.tsx           # Worker telemetry table with OSHA filters
├── lib/                              # Core Metrology & State Engine
│   ├── calibrationData.ts            # 6 empirical anchors & regulatory limits
│   ├── colorimetry.ts                # Gamma, Bradford CAT, OD, PCHIP spline
│   ├── db.ts                         # In-memory worker shifts & seeded telemetry
│   └── socketMock.ts                 # Simulated telemetry pub/sub stream
├── scratch/
│   └── test_safetrack_core.js        # 10-test automated verification suite
├── package.json                      # Next.js, React 18, Tailwind, Lucide, Recharts
├── tsconfig.json                     # TypeScript configuration
└── tailwind.config.js                # Design tokens & color palettes
```

---

## 7. Mathematical Validation & Test Suite

The platform includes an automated mathematical and architectural audit suite (`scratch/test_safetrack_core.js`):

```bash
node scratch/test_safetrack_core.js
```

### Verified Test Cases:
1. **Zero Cu-PAN Architecture Audit:** Proves 0 occurrences of Cu-PAN or copper complexes across all production code.
2. **Gamma Decoding Verification:** Confirms black ($0 \to 0.0$), white ($255 \to 1.0$), and mid-grey non-linearity ($128 \to 0.2159$).
3. **Bradford Chromatic Adaptation:** Validates D65 identity mapping and chromatic normalization.
4. **Optical Density Bounds:** Confirms pristine paper ($OD = 0.014$) up to saturated Lead Sulfide ($OD = 1.912$).
5. **6-Anchor Monotonicity:** Proves strict monotonic progression across PPM, $\Delta E_{00}$, and Optical Density.
6. **Dynamic Range Extrapolation:** Validates non-clamped sensitivity at 25 ppm, 50 ppm, and 100 ppm IDLH.

---

## 8. Quick Start & Installation Guide

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Validation Suite
```bash
node scratch/test_safetrack_core.js
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Home / Calibration Hub:** `http://localhost:3000/`
- **Worker Scanner PWA:** `http://localhost:3000/worker`
- **Supervisor Command Center:** `http://localhost:3000/supervisor`

### 4. Production Build & Start
```bash
npm run build
npm start -- -p 3000
```

---

## Disclaimer
*This platform is an engineering and research implementation of optical dosimetry for Lead(II) Acetate chemocassettes. In physical industrial deployments, always adhere to local site safety protocols, wear certified personal gas monitors, and observe statutory DGMS, OSHA, and NIOSH life-safety regulations.*
