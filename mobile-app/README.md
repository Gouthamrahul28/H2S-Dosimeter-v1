# H₂S Dosimeter — Mobile Capture App

Field-facing Progressive Web App (PWA) for workers and shift supervisors to capture end-of-shift wristband photos, extract optical exposure levels, and log data to the central safety database (SIH26118).

## Port & Config
- **Dev Port**: `5173`
- **Backend API**: `http://localhost:5000/api/v1` (configured via `VITE_API_BASE_URL`)

## Directory Structure
```
mobile-app/
├── src/
│   ├── components/
│   │   ├── CameraCapture.jsx          # Live camera feed, frame grabber & sensors
│   │   └── ReferencePatchOverlay.jsx  # Viewfinder alignment HUD overlay
│   ├── screens/
│   │   ├── WorkerIdScreen.jsx         # Worker ID & Shift ID selection
│   │   ├── CaptureScreen.jsx          # Viewfinder with real-time processing
│   │   └── ResultScreen.jsx           # Shift dose result, expiry check & RGB swatch matrix
│   ├── services/
│   │   └── api.js                     # REST API client
│   ├── App.jsx                        # Screen router & state management
│   ├── main.jsx
│   └── index.css                      # Modern dark theme styles
├── package.json
├── vite.config.js
└── .env.example
```

## Quick Start

### 1. Install Dependencies
```bash
cd mobile-app
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
App will be running on `http://localhost:5173`.

## Features
- **Native Camera Access**: Uses `navigator.mediaDevices.getUserMedia` with rear camera preference and front/back toggle.
- **Reference Standard HUD**: Visual overlay aligning the 3 wristband zones (Reference Standard, H₂S Strip, Expiry Patch).
- **Environmental Sensor Input**: Temperature and humidity adjustment sliders with live compensation.
- **Instant Optical Analysis**: Displays raw strip color, reference standard, lighting-corrected RGB, and estimated dose in ppm·hours.
- **Expiry Patch Verification**: Alerts workers immediately if the physical badge has expired or is unreadable.
- **Desktop Simulator Mode**: Includes one-click test pattern generators for rapid testing on devices without physical cameras.
