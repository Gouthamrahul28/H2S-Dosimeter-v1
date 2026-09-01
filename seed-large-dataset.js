/**
 * seed-large-dataset.js
 * 
 * High-Volume Industrial Dataset Generator for H2S Dosimeter System (SIH26118)
 * 
 * Generates configurable large-scale enterprise data:
 * - 50 to 500+ Industrial workers across 8 operational units
 * - Hundreds to thousands of multi-shift exposure readings spanning 30-90 days
 * - Varied exposure profiles: Safe (70%), Approaching Warning (20%), Over Statutory Limit (10%)
 * - Realistic physical color coordinates, lighting conditions, temperatures, and humidities
 * 
 * Usage:
 *   node seed-large-dataset.js [workerCount] [shiftsPerWorker]
 * 
 * Example:
 *   node seed-large-dataset.js 50 10    # 50 workers, 500 total exposure records
 *   node seed-large-dataset.js 100 20   # 100 workers, 2,000 exposure records
 */

const path = require('path');
const dotenv = require(path.join(__dirname, 'backend/node_modules/dotenv'));
dotenv.config({ path: path.join(__dirname, 'backend/.env') });
const mongoose = require(path.join(__dirname, 'backend/node_modules/mongoose'));
const Worker = require('./backend/src/models/Worker');
const Reading = require('./backend/src/models/Reading');
const { calculateDose, UNEXPOSED_BASELINE_RGB } = require('./backend/src/services/doseCalculator');
const { normalizeLighting } = require('./backend/src/services/lightingCorrection');

const DEFAULT_WORKER_COUNT = 50;
const DEFAULT_SHIFTS_PER_WORKER = 12;

const workerCountArg = parseInt(process.argv[2], 10) || DEFAULT_WORKER_COUNT;
const shiftsPerWorkerArg = parseInt(process.argv[3], 10) || DEFAULT_SHIFTS_PER_WORKER;

const FIRST_NAMES = [
  'Rajesh', 'Priya', 'Amit', 'Sunil', 'Kavita', 'Vikram', 'Deepak', 'Ananya', 'Rohan', 'Sneha',
  'Suresh', 'Manish', 'Pooja', 'Arjun', 'Meera', 'Gaurav', 'Neha', 'Alok', 'Swati', 'Harish',
  'Ramesh', 'Divya', 'Sanjay', 'Kiran', 'Naveen', 'Shweta', 'Abhishek', 'Bhavna', 'Vikas', 'Preeti',
  'Tarun', 'Anjali', 'Karthik', 'Jyoti', 'Manoj', 'Ritu', 'Pradeep', 'Suman', 'Ashish', 'Geeta',
  'Vivek', 'Nidhi', 'Sachin', 'Urmila', 'Pramod', 'Rekha', 'Hemant', 'Pallavi', 'Santosh', 'Vandana'
];

const LAST_NAMES = [
  'Kumar', 'Sharma', 'Patel', 'Verma', 'Singh', 'Gupta', 'Yadav', 'Mishra', 'Reddy', 'Chauhan',
  'Nair', 'Iyer', 'Joshi', 'Mehta', 'Rao', 'Deshmukh', 'Bose', 'Mukherjee', 'Das', 'Sen',
  'Thakur', 'Pandey', 'Shukla', 'Bhatt', 'Saxena', 'Bhardwaj', 'Pillai', 'Menon', 'Kulkarni', 'Patil'
];

const DEPARTMENTS = [
  'Drilling & Wellhead Operations',
  'Crude Distillation Unit (CDU-4)',
  'Coker & Vacuum Distillation',
  'Sour Gas Sweetening & Amine Plant',
  'Sulfur Recovery Unit (SRU & Claus)',
  'Offshore Rig Platform Alpha',
  'Cross-Country Pipeline & Pigging Hub',
  'Flare Header & Desulfurization'
];

const LIGHTING_PROFILES = [
  { name: 'Daylight 5500K', ref: { r: 255, g: 250, b: 245 } },
  { name: 'Warm Sodium 2700K', ref: { r: 255, g: 200, b: 145 } },
  { name: 'Cool Fluorescent 6500K', ref: { r: 235, g: 245, b: 255 } },
  { name: 'Industrial Metal Halide', ref: { r: 220, g: 255, b: 230 } },
  { name: 'Offshore Rig Floodlight', ref: { r: 242, g: 238, b: 255 } },
  { name: 'Twilight Shadow', ref: { r: 205, g: 218, b: 242 } }
];

function generateSimulatedPhysicalStrip(targetDosePpmHours) {
  // Calibrated linear Euclidean model: distance = targetDose / 0.38
  const distance = Math.max(0, targetDosePpmHours) / 0.38;
  const channelDelta = distance / Math.sqrt(3);

  // Ag2S darkening: green/red drop proportionally, blue channel absorbs strongly
  const r = Math.round(UNEXPOSED_BASELINE_RGB.r - channelDelta * 0.95);
  const g = Math.round(UNEXPOSED_BASELINE_RGB.g - channelDelta * 1.02);
  const b = Math.round(UNEXPOSED_BASELINE_RGB.b - channelDelta * 1.03);

  return {
    r: Math.max(15, Math.min(245, r)),
    g: Math.max(15, Math.min(245, g)),
    b: Math.max(15, Math.min(245, b))
  };
}

async function runSeeder() {
  console.log('========================================================================');
  console.log('⚡ H2S DOSIMETER — LARGE-SCALE DATABASE SEEDING ENGINE');
  console.log('========================================================================');
  console.log(`🏭 Target Workers:       ${workerCountArg}`);
  console.log(`📋 Shifts per Worker:     ${shiftsPerWorkerArg}`);
  console.log(`📊 Estimated Total Records: ~${workerCountArg * shiftsPerWorkerArg}`);
  console.log('========================================================================\n');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/h2s-dosimeter';
  console.log(`🔌 Connecting to MongoDB: ${mongoURI}`);
  await mongoose.connect(mongoURI);

  console.log('🧹 Clearing existing Workers and Readings collections...');
  await Worker.deleteMany({});
  await Reading.deleteMany({});

  console.log('👷 Generating industrial worker fleet...');
  const workers = [];
  const workerIds = [];

  for (let i = 1; i <= workerCountArg; i++) {
    const workerId = `W${(1000 + i).toString()}`;
    const firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const name = `${firstName} ${lastName}`;
    const department = DEPARTMENTS[(i - 1) % DEPARTMENTS.length];

    workers.push({
      workerId,
      name,
      department,
      createdAt: new Date(Date.now() - (60 * 24 * 60 * 60 * 1000))
    });
    workerIds.push({ workerId, department });
  }

  await Worker.insertMany(workers);
  console.log(`✅ Successfully seeded ${workers.length} workers across ${DEPARTMENTS.length} departments.`);

  console.log('\n📸 Generating multi-shift optical exposure histories with chromatic variability...');
  const readings = [];
  const now = Date.now();
  const shiftTypes = ['A', 'B', 'C']; // Morning, Evening, Night

  let safeCount = 0;
  let warningCount = 0;
  let overLimitCount = 0;

  for (let wIdx = 0; wIdx < workerIds.length; wIdx++) {
    const { workerId, department } = workerIds[wIdx];

    // Determine worker risk profile
    // 70% safe routine, 20% high-risk zone, 10% severe exposure incident
    const riskSeed = (wIdx * 17 + 13) % 100;
    const shiftCount = Math.max(4, Math.floor(shiftsPerWorkerArg * (0.8 + ((wIdx % 5) * 0.1))));

    // Target cumulative dose across all shifts for this worker
    let targetCumulative = 10.0 + (Math.random() * 35.0); // Safe (< 45 ppm*h)
    if (riskSeed > 85) {
      targetCumulative = 82.0 + (Math.random() * 45.0); // Over Limit (> 80 ppm*h)
    } else if (riskSeed > 68) {
      targetCumulative = 61.0 + (Math.random() * 17.0); // Warning (61 - 78 ppm*h)
    }

    const avgShiftDose = targetCumulative / shiftCount;

    for (let s = 0; s < shiftCount; s++) {
      const daysAgo = (shiftCount - s) * 1.8 + ((wIdx % 3) * 0.4);
      const shiftDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
      const shiftLetter = shiftTypes[s % 3];
      const shiftId = `${shiftDate.toISOString().slice(0, 10)}-${shiftLetter}`;

      // Calculate shift dose with realistic shift-to-shift variance
      const variance = 0.7 + (Math.random() * 0.6);
      const targetDose = Math.max(0.2, avgShiftDose * variance);
      const ambientTemp = Math.round((24.0 + Math.random() * 18.0) * 10) / 10; // 24°C - 42°C
      const ambientHumidity = Math.round(35 + Math.random() * 50); // 35% - 85%

      // Pick a random lighting condition
      const lightProfile = LIGHTING_PROFILES[(s + wIdx) % LIGHTING_PROFILES.length];
      const refGainR = lightProfile.ref.r / 255.0;
      const refGainG = lightProfile.ref.g / 255.0;
      const refGainB = lightProfile.ref.b / 255.0;

      // True physical color under ideal reference white
      const trueStripRGB = generateSimulatedPhysicalStrip(targetDose);

      // Raw camera capture with ambient lighting tint + slight sensor noise
      const rawStripRGB = {
        r: Math.max(10, Math.min(255, Math.round(trueStripRGB.r * refGainR + (Math.random() * 2 - 1)))),
        g: Math.max(10, Math.min(255, Math.round(trueStripRGB.g * refGainG + (Math.random() * 2 - 1)))),
        b: Math.max(10, Math.min(255, Math.round(trueStripRGB.b * refGainB + (Math.random() * 2 - 1))))
      };

      const rawRefRGB = {
        r: Math.max(10, Math.min(255, Math.round(lightProfile.ref.r + (Math.random() * 2 - 1)))),
        g: Math.max(10, Math.min(255, Math.round(lightProfile.ref.g + (Math.random() * 2 - 1)))),
        b: Math.max(10, Math.min(255, Math.round(lightProfile.ref.b + (Math.random() * 2 - 1))))
      };

      // Run lighting normalization
      const correctedRGB = normalizeLighting(rawStripRGB, rawRefRGB);

      // Calculate calibrated dose from corrected color
      const estimatedDose = calculateDose(correctedRGB, ambientTemp, ambientHumidity, 'placeholder-v1');

      // Expiry status: 97% valid, 3% expired badge alert
      const expiryPatchStatus = (s === shiftCount - 1 && riskSeed === 99) ? 'expired' : 'valid';

      readings.push({
        workerId,
        shiftId,
        imageUrl: `/uploads/sample-${workerId.toLowerCase()}-shift${s + 1}.jpg`,
        stripColorRGB: rawStripRGB,
        referenceColorRGB: rawRefRGB,
        correctedColorRGB: correctedRGB,
        expiryPatchStatus,
        ambientTemp,
        ambientHumidity,
        estimatedDosePpmHours: estimatedDose,
        calibrationCurveVersion: 'placeholder-v1',
        capturedAt: shiftDate,
        createdAt: shiftDate
      });
    }
  }

  // Bulk insert in chunks of 500
  console.log(`💾 Writing ${readings.length} exposure records to MongoDB...`);
  const CHUNK_SIZE = 500;
  for (let i = 0; i < readings.length; i += CHUNK_SIZE) {
    const chunk = readings.slice(i, i + CHUNK_SIZE);
    await Reading.insertMany(chunk);
    process.stdout.write(`  ... inserted ${Math.min(i + CHUNK_SIZE, readings.length)} / ${readings.length} records\r`);
  }
  console.log(`\n✅ Bulk insertion of ${readings.length} records complete!`);

  // Compute fleet breakdown statistics
  console.log('\n========================================================================');
  console.log('📈 DATABASE SEEDING SUMMARY & COMPLIANCE METRICS');
  console.log('========================================================================');

  const workersList = await Worker.find();
  const allReadings = await Reading.find();

  const workerTotals = new Map();
  allReadings.forEach((r) => {
    const prev = workerTotals.get(r.workerId) || 0;
    workerTotals.set(r.workerId, prev + r.estimatedDosePpmHours);
  });

  workersList.forEach((w) => {
    const total = workerTotals.get(w.workerId) || 0;
    if (total > 80.0) overLimitCount++;
    else if (total >= 60.0) warningCount++;
    else safeCount++;
  });

  console.log(`👥 Total Registered Workers:         ${workersList.length}`);
  console.log(`📋 Total Exposure Shift Records:      ${allReadings.length}`);
  console.log(`🟢 Safe Fleet (<60 ppm·h):           ${safeCount} workers (${((safeCount / workersList.length) * 100).toFixed(1)}%)`);
  console.log(`🟡 Warning Approaching Limit (60-80): ${warningCount} workers (${((warningCount / workersList.length) * 100).toFixed(1)}%)`);
  console.log(`🔴 Over DGMS/OISD Limit (>80 ppm·h): ${overLimitCount} workers (${((overLimitCount / workersList.length) * 100).toFixed(1)}%)`);
  console.log('========================================================================');
  console.log('\n🚀 Open the Supervisor Dashboard to explore the large dataset:');
  console.log('   👉 http://localhost:5174');
  console.log('========================================================================\n');

  process.exit(0);
}

runSeeder().catch((err) => {
  console.error('❌ Seeder Error:', err);
  process.exit(1);
});
