require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Worker = require('./models/Worker');
const Reading = require('./models/Reading');
const Strip = require('./models/Strip');
const StripBatch = require('./models/StripBatch');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

/**
 * Creates a synthetic dosimeter wristband image with 3 distinct color patches:
 * 1. White Reference Standard Patch (Top-Left)
 * 2. Active Cu-PAN Chemical Strip (Center: Purple -> Yellow/Orange)
 * 3. Grey Reference Standard Patch (Top-Right)
 */
async function generateSampleWristbandImage(filename, stripRGB, refRGB = { r: 250, g: 250, b: 250 }, greyRGB = { r: 128, g: 128, b: 128 }) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const width = 600;
  const height = 400;

  const svgBuffer = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1e293b"/>
      <rect x="20" y="20" width="560" height="360" rx="16" fill="#334155" stroke="#475569" stroke-width="4"/>
      
      <!-- Top-Left: White Reference Standard Patch -->
      <rect x="60" y="40" width="120" height="80" rx="8" fill="rgb(${refRGB.r}, ${refRGB.g}, ${refRGB.b})" stroke="#ffffff" stroke-width="2"/>
      <text x="120" y="85" font-family="Arial" font-size="12" fill="#000" text-anchor="middle" font-weight="bold">REF (WHITE)</text>

      <!-- Top-Right: Grey Reference Standard Patch -->
      <rect x="420" y="40" width="120" height="80" rx="8" fill="rgb(${greyRGB.r}, ${greyRGB.g}, ${greyRGB.b})" stroke="#cbd5e1" stroke-width="2"/>
      <text x="480" y="85" font-family="Arial" font-size="12" fill="#333" text-anchor="middle" font-weight="bold">GREY REF</text>

      <!-- Center: Active Cu-PAN Chemical Strip -->
      <rect x="228" y="152" width="144" height="96" rx="8" fill="rgb(${stripRGB.r}, ${stripRGB.g}, ${stripRGB.b})" stroke="#0284c7" stroke-width="3"/>
      <text x="300" y="205" font-family="Arial" font-size="13" fill="#ffffff" text-anchor="middle" font-weight="bold">Cu-PAN STRIP</text>

      <text x="300" y="320" font-family="Arial" font-size="14" fill="#94a3b8" text-anchor="middle">DGMS/OISD CERTIFIED Cu-PAN H2S DOSIMETER</text>
    </svg>
  `);

  const filePath = path.join(UPLOADS_DIR, filename);
  await sharp(svgBuffer).jpeg({ quality: 90 }).toFile(filePath);
  return `/uploads/${filename}`;
}

async function seedDatabase() {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/h2s-dosimeter';
    console.log(`[Seed] Connecting to MongoDB: ${mongoURI}`);
    await mongoose.connect(mongoURI);

    console.log('[Seed] Clearing existing collections (Workers, Readings, Strips, StripBatches)...');
    await Worker.deleteMany({});
    await Reading.deleteMany({});
    await Strip.deleteMany({});
    await StripBatch.deleteMany({});

    console.log('[Seed] Creating Cu-PAN manufacturing batches...');
    const now = new Date();
    const batch1 = await StripBatch.create({
      batchId: 'CUPAN-BATCH-001',
      chemistry: 'Cu-PAN',
      manufacturedAt: new Date(now.getTime() - 15 * 86400 * 1000), // 15 days ago
      validatedShelfLifeDays: 180, // 6 months
      expiryAt: new Date(now.getTime() + (180 - 15) * 86400 * 1000),
      validatedActiveLifeHours: 120, // 5 days (120 hours) active wear life
      storageMinTemp: 15.0,
      storageMaxTemp: 25.0,
      storageMaxHumidity: 60.0,
      packaging: 'Sealed Foil with Desiccant Barrier',
      stabilityTestReference: 'Accelerated Arrhenius 40°C/75% RH (ASTM F1980)',
      status: 'VALIDATED',
      isDemo: true
    });

    const batch2 = await StripBatch.create({
      batchId: 'CUPAN-BATCH-002',
      chemistry: 'Cu-PAN',
      manufacturedAt: now,
      validatedShelfLifeDays: null,
      expiryAt: null,
      validatedActiveLifeHours: null,
      status: 'NOT_YET_VALIDATED'
    });

    const batch3 = await StripBatch.create({
      batchId: 'CUPAN-BATCH-003-RECALLED',
      chemistry: 'Cu-PAN',
      manufacturedAt: new Date(now.getTime() - 40 * 86400 * 1000),
      validatedShelfLifeDays: 90,
      expiryAt: new Date(now.getTime() + 50 * 86400 * 1000),
      status: 'RECALLED'
    });

    console.log(`[Seed] Created 3 Cu-PAN batches: ${batch1.batchId}, ${batch2.batchId}, ${batch3.batchId}`);

    console.log('[Seed] Creating disposable Cu-PAN strips and worker assignments...');

    // Strip 1: Active for W1023 (Cumulative 113.7 / 160 -> 71% used, 29% remaining -> REPLACE_SOON)
    const strip1 = await Strip.create({
      stripId: 'CUPAN-2026-000123',
      batchId: 'CUPAN-BATCH-001',
      workerId: 'W1023',
      qrCodePayload: 'CUPAN-B001-000123',
      assignedAt: new Date(now.getTime() - 12 * 3600 * 1000),
      activatedAt: new Date(now.getTime() - 12 * 3600 * 1000),
      activeExpiryAt: new Date(now.getTime() + (120 - 12) * 3600 * 1000),
      status: 'ACTIVE',
      stripStatus: 'REPLACE_SOON',
      scanCount: 3,
      currentDose: 40.0,
      cumulativeDosePpmH: 113.7,
      maxValidatedDosePpmH: 160.0,
      lifeUsedPercent: 71,
      lifeRemainingPercent: 29
    });

    // Strip 2: Active for W1024 (Cumulative 16.5 / 160 -> 10% used, 90% remaining -> GOOD)
    const strip2 = await Strip.create({
      stripId: 'CUPAN-2026-000124',
      batchId: 'CUPAN-BATCH-001',
      workerId: 'W1024',
      qrCodePayload: 'CUPAN-B001-000124',
      assignedAt: new Date(now.getTime() - 24 * 3600 * 1000),
      activatedAt: new Date(now.getTime() - 24 * 3600 * 1000),
      activeExpiryAt: new Date(now.getTime() + (120 - 24) * 3600 * 1000),
      status: 'ACTIVE',
      stripStatus: 'GOOD',
      scanCount: 2,
      currentDose: 9.0,
      cumulativeDosePpmH: 16.5,
      maxValidatedDosePpmH: 160.0,
      lifeUsedPercent: 10,
      lifeRemainingPercent: 90
    });

    // Strip 3: Expiring soon for W1025 (Cumulative 71.8 / 160 -> 45% used, 55% remaining -> EXPIRING_SOON by time)
    const strip3 = await Strip.create({
      stripId: 'CUPAN-2026-000125',
      batchId: 'CUPAN-BATCH-001',
      workerId: 'W1025',
      qrCodePayload: 'CUPAN-B001-000125',
      assignedAt: new Date(now.getTime() - 110 * 3600 * 1000),
      activatedAt: new Date(now.getTime() - 110 * 3600 * 1000),
      activeExpiryAt: new Date(now.getTime() + (120 - 110) * 3600 * 1000),
      status: 'EXPIRING_SOON',
      stripStatus: 'REPLACE_SOON',
      scanCount: 2,
      currentDose: 36.8,
      cumulativeDosePpmH: 71.8,
      maxValidatedDosePpmH: 160.0,
      lifeUsedPercent: 45,
      lifeRemainingPercent: 55
    });

    // Strip 4: Expired test strip
    const strip4 = await Strip.create({
      stripId: 'CUPAN-2026-000128-EXPIRED',
      batchId: 'CUPAN-BATCH-001',
      workerId: 'W1025',
      qrCodePayload: 'CUPAN-B001-000128',
      assignedAt: new Date(now.getTime() - 130 * 3600 * 1000),
      activatedAt: new Date(now.getTime() - 130 * 3600 * 1000),
      activeExpiryAt: new Date(now.getTime() - 10 * 3600 * 1000),
      status: 'EXPIRED',
      stripStatus: 'EXPIRED',
      scanCount: 1,
      currentDose: 40.0,
      cumulativeDosePpmH: 40.0,
      maxValidatedDosePpmH: 160.0,
      lifeUsedPercent: 25,
      lifeRemainingPercent: 0
    });

    // Strip 5: Unissued inventory strip
    const strip5 = await Strip.create({
      stripId: 'CUPAN-2026-000199',
      batchId: 'CUPAN-BATCH-001',
      qrCodePayload: 'CUPAN-B001-000199',
      status: 'UNISSUED',
      stripStatus: 'UNISSUED',
      maxValidatedDosePpmH: 160.0,
      cumulativeDosePpmH: 0.0,
      lifeUsedPercent: 0,
      lifeRemainingPercent: 100
    });

    console.log('[Seed] Creating worker personnel records with registration & status...');
    const workers = await Worker.create([
      {
        workerId: 'W1023',
        name: 'Rajesh Kumar',
        workerCode: 'EMP-1023',
        department: 'Drilling & Extraction',
        worksite: 'Refinery Sector 4A',
        status: 'ACTIVE',
        assignedStripId: 'CUPAN-2026-000123',
        registrationDate: new Date(now.getTime() - 60 * 86400 * 1000)
      },
      {
        workerId: 'W1024',
        name: 'Priya Sharma',
        workerCode: 'EMP-1024',
        department: 'Refinery Unit 4',
        worksite: 'Distillation Complex CDU-4',
        status: 'ACTIVE',
        assignedStripId: 'CUPAN-2026-000124',
        registrationDate: new Date(now.getTime() - 60 * 86400 * 1000)
      },
      {
        workerId: 'W1025',
        name: 'Amit Patel',
        workerCode: 'EMP-1025',
        department: 'Offshore Pipeline',
        worksite: 'Platform Alpha Hub',
        status: 'ACTIVE',
        assignedStripId: 'CUPAN-2026-000125',
        registrationDate: new Date(now.getTime() - 45 * 86400 * 1000)
      },
      {
        workerId: 'W1026',
        name: 'Vikram Singh',
        workerCode: 'EMP-1026',
        department: 'Maintenance & Turnaround',
        worksite: 'Offshore Pigging Facility',
        status: 'INACTIVE',
        assignedStripId: null,
        registrationDate: new Date(now.getTime() - 30 * 86400 * 1000)
      },
      {
        workerId: 'W1027',
        name: 'Suresh Raina',
        workerCode: 'EMP-1027',
        department: 'Sour Water Stripper',
        worksite: 'Sector 9 Sump',
        status: 'BLOCKED',
        assignedStripId: 'CUPAN-2026-000123',
        registrationDate: new Date(now.getTime() - 20 * 86400 * 1000)
      }
    ]);
    console.log(`[Seed] Created ${workers.length} workers with access control flags.`);

    console.log('[Seed] Generating sample Cu-PAN wristband images & exposure readings...');

    // W1023 Readings (High Exposure -> Yellow/Orange progression)
    const img1 = await generateSampleWristbandImage('sample-w1023-shift1.jpg', { r: 195, g: 135, b: 90 });
    const img2 = await generateSampleWristbandImage('sample-w1023-shift2.jpg', { r: 210, g: 145, b: 65 });
    const img3 = await generateSampleWristbandImage('sample-w1023-shift3.jpg', { r: 222, g: 153, b: 48 });

    // W1024 Readings (Low Exposure -> Purple/Violet dominant)
    const img4 = await generateSampleWristbandImage('sample-w1024-shift1.jpg', { r: 143, g: 88, b: 165 });
    const img5 = await generateSampleWristbandImage('sample-w1024-shift2.jpg', { r: 154, g: 100, b: 150 });

    // W1025 Readings (Moderate Exposure)
    const img6 = await generateSampleWristbandImage('sample-w1025-shift1.jpg', { r: 175, g: 120, b: 120 });
    const img7 = await generateSampleWristbandImage('sample-w1025-shift2.jpg', { r: 204, g: 142, b: 78 });

    const sampleReadings = [
      // Rajesh Kumar (W1023)
      {
        workerId: 'W1023',
        shiftId: '2026-08-29-A',
        scanId: 'cupan_scan_1023_01',
        stripId: 'CUPAN-2026-000123',
        stripBatch: 'CUPAN-BATCH-001',
        cameraProfile: 'mobile_001',
        imageUrl: img1,
        chemistry: 'Cu-PAN',
        stripColorRGB: { r: 195, g: 135, b: 90 },
        referenceColorRGB: { r: 250, g: 250, b: 245 },
        greyColorRGB: { r: 128, g: 128, b: 128 },
        correctedColorRGB: { r: 195, g: 135, b: 92 },
        lab: { L: 58.20, a: 21.80, b: 19.40 },
        deltaE00: 30.5,
        confidence: 0.94,
        calibrationStatus: 'VALID',
        expiryPatchStatus: 'valid',
        ambientTemp: 32.0,
        ambientHumidity: 65,
        estimatedDosePpmHours: 32.5,
        calibrationCurveVersion: 'cupan-cielab-v1',
        capturedAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
      },
      {
        workerId: 'W1023',
        shiftId: '2026-08-30-B',
        scanId: 'cupan_scan_1023_02',
        stripId: 'CUPAN-2026-000123',
        stripBatch: 'CUPAN-BATCH-001',
        cameraProfile: 'mobile_001',
        imageUrl: img2,
        chemistry: 'Cu-PAN',
        stripColorRGB: { r: 210, g: 145, b: 65 },
        referenceColorRGB: { r: 245, g: 240, b: 235 },
        greyColorRGB: { r: 128, g: 128, b: 128 },
        correctedColorRGB: { r: 214, g: 151, b: 69 },
        lab: { L: 64.50, a: 18.20, b: 36.80 },
        deltaE00: 45.2,
        confidence: 0.94,
        calibrationStatus: 'VALID',
        expiryPatchStatus: 'valid',
        ambientTemp: 35.5,
        ambientHumidity: 70,
        estimatedDosePpmHours: 41.2,
        calibrationCurveVersion: 'cupan-cielab-v1',
        capturedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      {
        workerId: 'W1023',
        shiftId: '2026-08-31-C',
        scanId: 'cupan_scan_1023_03',
        stripId: 'CUPAN-2026-000123',
        stripBatch: 'CUPAN-BATCH-001',
        cameraProfile: 'mobile_001',
        imageUrl: img3,
        chemistry: 'Cu-PAN',
        stripColorRGB: { r: 222, g: 153, b: 48 },
        referenceColorRGB: { r: 250, g: 250, b: 250 },
        greyColorRGB: { r: 128, g: 128, b: 128 },
        correctedColorRGB: { r: 222, g: 153, b: 48 },
        lab: { L: 70.50, a: 15.20, b: 56.20 },
        deltaE00: 61.1,
        confidence: 0.94,
        calibrationStatus: 'VALID',
        expiryPatchStatus: 'valid',
        ambientTemp: 37.0,
        ambientHumidity: 75,
        estimatedDosePpmHours: 40.0,
        calibrationCurveVersion: 'cupan-cielab-v1',
        capturedAt: new Date()
      },

      // Priya Sharma (W1024)
      {
        workerId: 'W1024',
        shiftId: '2026-08-30-A',
        scanId: 'cupan_scan_1024_01',
        stripId: 'CUPAN-2026-000124',
        stripBatch: 'CUPAN-BATCH-001',
        cameraProfile: 'mobile_001',
        imageUrl: img4,
        chemistry: 'Cu-PAN',
        stripColorRGB: { r: 143, g: 88, b: 165 },
        referenceColorRGB: { r: 255, g: 250, b: 245 },
        greyColorRGB: { r: 128, g: 128, b: 128 },
        correctedColorRGB: { r: 140, g: 89, b: 168 },
        lab: { L: 44.10, a: 35.40, b: -21.80 },
        deltaE00: 4.85,
        confidence: 0.94,
        calibrationStatus: 'VALID',
        expiryPatchStatus: 'valid',
        ambientTemp: 26.0,
        ambientHumidity: 45,
        estimatedDosePpmHours: 7.5,
        calibrationCurveVersion: 'cupan-cielab-v1',
        capturedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      },
      {
        workerId: 'W1024',
        shiftId: '2026-08-31-B',
        scanId: 'cupan_scan_1024_02',
        stripId: 'CUPAN-2026-000124',
        stripBatch: 'CUPAN-BATCH-001',
        cameraProfile: 'mobile_001',
        imageUrl: img5,
        chemistry: 'Cu-PAN',
        stripColorRGB: { r: 154, g: 100, b: 150 },
        referenceColorRGB: { r: 240, g: 245, b: 255 },
        greyColorRGB: { r: 128, g: 128, b: 128 },
        correctedColorRGB: { r: 160, g: 102, b: 147 },
        lab: { L: 47.30, a: 31.20, b: -11.50 },
        deltaE00: 10.2,
        confidence: 0.94,
        calibrationStatus: 'VALID',
        expiryPatchStatus: 'valid',
        ambientTemp: 28.0,
        ambientHumidity: 50,
        estimatedDosePpmHours: 9.0,
        calibrationCurveVersion: 'cupan-cielab-v1',
        capturedAt: new Date()
      },

      // Amit Patel (W1025)
      {
        workerId: 'W1025',
        shiftId: '2026-08-30-C',
        scanId: 'cupan_scan_1025_01',
        stripId: 'CUPAN-2026-000125',
        stripBatch: 'CUPAN-BATCH-001',
        cameraProfile: 'mobile_001',
        imageUrl: img6,
        chemistry: 'Cu-PAN',
        stripColorRGB: { r: 175, g: 120, b: 120 },
        referenceColorRGB: { r: 250, g: 250, b: 250 },
        greyColorRGB: { r: 128, g: 128, b: 128 },
        correctedColorRGB: { r: 175, g: 120, b: 120 },
        lab: { L: 52.00, a: 26.50, b: 2.80 },
        deltaE00: 19.6,
        confidence: 0.94,
        calibrationStatus: 'VALID',
        expiryPatchStatus: 'valid',
        ambientTemp: 30.0,
        ambientHumidity: 55,
        estimatedDosePpmHours: 35.0,
        calibrationCurveVersion: 'cupan-cielab-v1',
        capturedAt: new Date(Date.now() - 20 * 60 * 60 * 1000)
      },
      {
        workerId: 'W1025',
        shiftId: '2026-08-31-A',
        scanId: 'cupan_scan_1025_02',
        stripId: 'CUPAN-2026-000125',
        stripBatch: 'CUPAN-BATCH-001',
        cameraProfile: 'mobile_001',
        imageUrl: img7,
        chemistry: 'Cu-PAN',
        stripColorRGB: { r: 204, g: 142, b: 78 },
        referenceColorRGB: { r: 250, g: 250, b: 250 },
        greyColorRGB: { r: 128, g: 128, b: 128 },
        correctedColorRGB: { r: 204, g: 142, b: 78 },
        lab: { L: 60.50, a: 19.50, b: 28.00 },
        deltaE00: 36.8,
        confidence: 0.94,
        calibrationStatus: 'VALID',
        expiryPatchStatus: 'valid',
        ambientTemp: 33.0,
        ambientHumidity: 60,
        estimatedDosePpmHours: 36.8,
        calibrationCurveVersion: 'cupan-cielab-v1',
        capturedAt: new Date()
      }
    ];

    await Reading.insertMany(sampleReadings);
    console.log(`[Seed] Seeded ${sampleReadings.length} Cu-PAN exposure readings across strips.`);

    console.log('[Seed] Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Database seeding error:', error);
    process.exit(1);
  }
}

seedDatabase();
