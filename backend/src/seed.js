require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Worker = require('./models/Worker');
const Reading = require('./models/Reading');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

/**
 * Creates a synthetic dosimeter wristband image with 3 distinct color patches
 */
async function generateSampleWristbandImage(filename, stripRGB, refRGB = { r: 250, g: 250, b: 250 }, expiryRGB = { r: 240, g: 240, b: 240 }) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const width = 600;
  const height = 400;

  // Create an SVG with wristband layout
  const svgBuffer = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background / Wristband body -->
      <rect width="100%" height="100%" fill="#1e293b"/>
      <rect x="20" y="20" width="560" height="360" rx="16" fill="#334155" stroke="#475569" stroke-width="4"/>
      
      <!-- Top-Left: Reference Standard Patch (10%-30% bounds) -->
      <rect x="60" y="40" width="120" height="80" rx="8" fill="rgb(${refRGB.r}, ${refRGB.g}, ${refRGB.b})" stroke="#ffffff" stroke-width="2"/>
      <text x="120" y="85" font-family="Arial" font-size="12" fill="#000" text-anchor="middle" font-weight="bold">REF (WHITE)</text>

      <!-- Top-Right: Expiry / Shelf-Life Patch (70%-90% bounds) -->
      <rect x="420" y="40" width="120" height="80" rx="8" fill="rgb(${expiryRGB.r}, ${expiryRGB.g}, ${expiryRGB.b})" stroke="#cbd5e1" stroke-width="2"/>
      <text x="480" y="85" font-family="Arial" font-size="12" fill="#333" text-anchor="middle" font-weight="bold">EXPIRY</text>

      <!-- Center: Active H2S Chemical Strip (38%-62% bounds) -->
      <rect x="228" y="152" width="144" height="96" rx="8" fill="rgb(${stripRGB.r}, ${stripRGB.g}, ${stripRGB.b})" stroke="#0284c7" stroke-width="3"/>
      <text x="300" y="205" font-family="Arial" font-size="14" fill="#ffffff" text-anchor="middle" font-weight="bold">H2S STRIP</text>

      <!-- Wristband metadata printed text -->
      <text x="300" y="320" font-family="Arial" font-size="14" fill="#94a3b8" text-anchor="middle">DGMS/OISD CERTIFIED H2S DOSIMETER</text>
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

    console.log('[Seed] Clearing existing Workers and Readings...');
    await Worker.deleteMany({});
    await Reading.deleteMany({});

    console.log('[Seed] Creating 3 sample workers...');
    const workers = await Worker.create([
      {
        workerId: 'W1023',
        name: 'Rajesh Kumar',
        department: 'Drilling & Extraction'
      },
      {
        workerId: 'W1024',
        name: 'Priya Sharma',
        department: 'Refinery Unit 4'
      },
      {
        workerId: 'W1025',
        name: 'Amit Patel',
        department: 'Offshore Pipeline'
      }
    ]);
    console.log(`[Seed] Created ${workers.length} workers.`);

    console.log('[Seed] Generating sample wristband images & exposure readings...');

    // W1023 Readings (High Exposure -> Cumulative > 80 ppm*h)
    const img1 = await generateSampleWristbandImage('sample-w1023-shift1.jpg', { r: 140, g: 96, b: 210 });
    const img2 = await generateSampleWristbandImage('sample-w1023-shift2.jpg', { r: 110, g: 70, b: 180 });
    const img3 = await generateSampleWristbandImage('sample-w1023-shift3.jpg', { r: 90, g: 50, b: 150 });

    // W1024 Readings (Low Exposure -> Safe < 40 ppm*h)
    const img4 = await generateSampleWristbandImage('sample-w1024-shift1.jpg', { r: 210, g: 200, b: 220 });
    const img5 = await generateSampleWristbandImage('sample-w1024-shift2.jpg', { r: 195, g: 180, b: 210 });

    // W1025 Readings (Moderate / Approaching threshold ~ 72 ppm*h)
    const img6 = await generateSampleWristbandImage('sample-w1025-shift1.jpg', { r: 160, g: 130, b: 200 });
    const img7 = await generateSampleWristbandImage('sample-w1025-shift2.jpg', { r: 130, g: 100, b: 180 });

    const sampleReadings = [
      // Rajesh Kumar (W1023) - 3 shifts totaling ~106.8 ppm*h (OVER THRESHOLD)
      {
        workerId: 'W1023',
        shiftId: '2026-08-29-A',
        imageUrl: img1,
        stripColorRGB: { r: 140, g: 96, b: 210 },
        referenceColorRGB: { r: 250, g: 250, b: 250 },
        correctedColorRGB: { r: 143, g: 98, b: 214 },
        expiryPatchStatus: 'valid',
        ambientTemp: 31.0,
        ambientHumidity: 65,
        estimatedDosePpmHours: 32.4,
        calibrationCurveVersion: 'placeholder-v1',
        capturedAt: new Date('2026-08-29T14:30:00Z'),
        createdAt: new Date('2026-08-29T14:30:05Z')
      },
      {
        workerId: 'W1023',
        shiftId: '2026-08-30-A',
        imageUrl: img2,
        stripColorRGB: { r: 110, g: 70, b: 180 },
        referenceColorRGB: { r: 252, g: 252, b: 252 },
        correctedColorRGB: { r: 111, g: 71, b: 182 },
        expiryPatchStatus: 'valid',
        ambientTemp: 33.5,
        ambientHumidity: 70,
        estimatedDosePpmHours: 38.6,
        calibrationCurveVersion: 'placeholder-v1',
        capturedAt: new Date('2026-08-30T14:35:00Z'),
        createdAt: new Date('2026-08-30T14:35:04Z')
      },
      {
        workerId: 'W1023',
        shiftId: '2026-08-31-A',
        imageUrl: img3,
        stripColorRGB: { r: 90, g: 50, b: 150 },
        referenceColorRGB: { r: 250, g: 250, b: 250 },
        correctedColorRGB: { r: 92, g: 51, b: 153 },
        expiryPatchStatus: 'valid',
        ambientTemp: 32.0,
        ambientHumidity: 68,
        estimatedDosePpmHours: 42.7,
        calibrationCurveVersion: 'placeholder-v1',
        capturedAt: new Date('2026-08-31T14:05:00Z'),
        createdAt: new Date('2026-08-31T14:05:03Z')
      },

      // Priya Sharma (W1024) - 2 shifts totaling 28.5 ppm*h (SAFE)
      {
        workerId: 'W1024',
        shiftId: '2026-08-30-B',
        imageUrl: img4,
        stripColorRGB: { r: 210, g: 200, b: 220 },
        referenceColorRGB: { r: 254, g: 254, b: 254 },
        correctedColorRGB: { r: 211, g: 201, b: 221 },
        expiryPatchStatus: 'valid',
        ambientTemp: 28.0,
        ambientHumidity: 55,
        estimatedDosePpmHours: 12.3,
        calibrationCurveVersion: 'placeholder-v1',
        capturedAt: new Date('2026-08-30T22:15:00Z'),
        createdAt: new Date('2026-08-30T22:15:05Z')
      },
      {
        workerId: 'W1024',
        shiftId: '2026-08-31-B',
        imageUrl: img5,
        stripColorRGB: { r: 195, g: 180, b: 210 },
        referenceColorRGB: { r: 250, g: 250, b: 250 },
        correctedColorRGB: { r: 199, g: 184, b: 214 },
        expiryPatchStatus: 'valid',
        ambientTemp: 27.5,
        ambientHumidity: 52,
        estimatedDosePpmHours: 16.2,
        calibrationCurveVersion: 'placeholder-v1',
        capturedAt: new Date('2026-08-31T22:10:00Z'),
        createdAt: new Date('2026-08-31T22:10:04Z')
      },

      // Amit Patel (W1025) - 2 shifts totaling 71.8 ppm*h (APPROACHING THRESHOLD)
      {
        workerId: 'W1025',
        shiftId: '2026-08-30-C',
        imageUrl: img6,
        stripColorRGB: { r: 160, g: 130, b: 200 },
        referenceColorRGB: { r: 250, g: 250, b: 250 },
        correctedColorRGB: { r: 163, g: 133, b: 204 },
        expiryPatchStatus: 'valid',
        ambientTemp: 30.0,
        ambientHumidity: 60,
        estimatedDosePpmHours: 29.5,
        calibrationCurveVersion: 'placeholder-v1',
        capturedAt: new Date('2026-08-30T06:05:00Z'),
        createdAt: new Date('2026-08-30T06:05:03Z')
      },
      {
        workerId: 'W1025',
        shiftId: '2026-08-31-C',
        imageUrl: img7,
        stripColorRGB: { r: 130, g: 100, b: 180 },
        referenceColorRGB: { r: 252, g: 252, b: 252 },
        correctedColorRGB: { r: 132, g: 101, b: 182 },
        expiryPatchStatus: 'valid',
        ambientTemp: 31.5,
        ambientHumidity: 64,
        estimatedDosePpmHours: 42.3,
        calibrationCurveVersion: 'placeholder-v1',
        capturedAt: new Date('2026-08-31T06:10:00Z'),
        createdAt: new Date('2026-08-31T06:10:04Z')
      }
    ];

    await Reading.insertMany(sampleReadings);
    console.log(`[Seed] Seeded ${sampleReadings.length} exposure readings.`);
    console.log('[Seed] Database seeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
