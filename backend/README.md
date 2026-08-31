# H₂S Dosimeter — Backend & Calibration Engine

Component 4 REST API, MongoDB storage, image color-extraction, lighting correction, and swappable dose calculation engine for the H₂S dosimeter wristband system (SIH26118).

## Port & Config
- **Default Port**: `5000`
- **Base URL**: `http://localhost:5000/api/v1`
- **MongoDB URI**: `mongodb://localhost:27017/h2s-dosimeter`

## Directory Structure
```
backend/
├── uploads/                # Saved wristband photo captures
├── src/
│   ├── config/
│   │   └── db.js           # Mongoose MongoDB connection
│   ├── models/
│   │   ├── Worker.js       # Worker data model
│   │   └── Reading.js      # Exposure reading data model
│   ├── services/
│   │   ├── colorExtraction.js    # Sharp region sampling (Ref, Strip, Expiry)
│   │   ├── lightingCorrection.js # Chromatic normalization against reference
│   │   └── doseCalculator.js     # Swappable versioned calibration engine
│   ├── controllers/
│   │   ├── readingController.js
│   │   ├── workerController.js
│   │   └── reportController.js
│   ├── routes/
│   │   ├── readingRoutes.js
│   │   ├── workerRoutes.js
│   │   └── reportRoutes.js
│   ├── seed.js             # Database seeder (3 sample workers + readings)
│   └── server.js           # Express application entrypoint
├── package.json
└── .env.example
```

## Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Environment Setup
Create a `.env` file (copied from `.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/h2s-dosimeter
CALIBRATION_CURVE_VERSION=placeholder-v1
THRESHOLD_PPM_HOURS=80
```

### 3. Seed Database
Seeds 3 sample workers (`W1023`, `W1024`, `W1025`) and generates sample wristband images with test exposure history:
```bash
npm run seed
```

### 4. Start Server
```bash
npm start
```
Or for auto-reloading during development:
```bash
npm run dev
```

## Endpoints Implemented

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/readings` | Process wristband photo & calculate dose |
| `GET` | `/api/v1/workers` | List all workers |
| `POST` | `/api/v1/workers` | Register a new worker |
| `GET` | `/api/v1/workers/:workerId/readings` | Exposure history for one worker |
| `GET` | `/api/v1/workers/:workerId/cumulative-dose` | Aggregated cumulative dose & threshold status |
| `GET` | `/api/v1/reports/dgms?from=...&to=...` | DGMS/OISD occupational health compliance report |
