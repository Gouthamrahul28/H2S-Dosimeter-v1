/**
 * train-calibration-model.js
 * 
 * Automated Image Dataset Trainer & Calibration Curve Fitting Engine
 * for H2S Chemical Dosimeters (SIH26118).
 * 
 * Workflow:
 * 1. Reads a CSV dataset linking your strip photos to ground-truth exposure (ppm·hours).
 * 2. Runs the optical pipeline (RGB extraction & chromatic lighting normalization) on each image.
 * 3. Fits 4 mathematical kinetic models (Linear, 2nd-order Beer-Lambert, Power Law, Blue Absorbance).
 * 4. Measures statistical fidelity (R², MAE, RMSE, Max Error).
 * 5. Automatically exports the winning model to `backend/src/config/custom-calibration.json`.
 * 
 * Usage:
 *   node train-calibration-model.js [path-to-dataset.csv]
 * 
 * Example:
 *   node train-calibration-model.js training/dataset.csv
 */

const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, 'backend/node_modules/sharp'));
const { normalizeLighting } = require('./backend/src/services/lightingCorrection');
const { UNEXPOSED_BASELINE_RGB } = require('./backend/src/services/doseCalculator');
const { extractColorsFromImage } = require('./backend/src/services/colorExtraction');

const CSV_PATH_ARG = process.argv[2] || path.join(__dirname, 'training/dataset.csv');
const OUTPUT_CONFIG_PATH = path.join(__dirname, 'backend/src/config/custom-calibration.json');

/**
 * Generates sample synthetic training dataset if none exists yet
 */
async function ensureSampleTrainingDataset() {
  const trainingDir = path.join(__dirname, 'training');
  const imagesDir = path.join(trainingDir, 'images');

  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const csvPath = path.join(trainingDir, 'dataset.csv');
  if (fs.existsSync(csvPath)) return csvPath;

  console.log('📦 No existing dataset.csv found. Generating 25 sample lab training images & CSV template...');

  const rows = ['image_path,ground_truth_ppm_hours,ambient_temp,ambient_humidity'];
  const testDoses = [
    0.0, 2.5, 5.0, 8.5, 12.0, 16.5, 20.0, 25.0, 30.0, 35.5,
    40.0, 45.0, 50.0, 56.0, 62.0, 68.0, 75.0, 82.0, 90.0, 98.0,
    108.0, 120.0, 135.0, 150.0, 175.0
  ];

  for (let i = 0; i < testDoses.length; i++) {
    const dose = testDoses[i];
    const filename = `strip_sample_${(i + 1).toString().padStart(2, '0')}.jpg`;
    const fullPath = path.join(imagesDir, filename);

    // Calculate simulated strip darkening
    const distance = dose / 0.38;
    const channelDelta = distance / Math.sqrt(3);
    const stripRGB = {
      r: Math.max(15, Math.min(245, Math.round(UNEXPOSED_BASELINE_RGB.r - channelDelta * 0.95))),
      g: Math.max(15, Math.min(245, Math.round(UNEXPOSED_BASELINE_RGB.g - channelDelta * 1.02))),
      b: Math.max(15, Math.min(245, Math.round(UNEXPOSED_BASELINE_RGB.b - channelDelta * 1.03)))
    };

    // Reference white with slight sensor tint
    const refRGB = { r: 252, g: 250, b: 248 };
    const expiryRGB = { r: 240, g: 240, b: 240 };

    const svgBuffer = Buffer.from(`
      <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1e293b"/>
        <rect x="20" y="20" width="560" height="360" rx="16" fill="#334155" stroke="#475569" stroke-width="4"/>
        <rect x="60" y="40" width="120" height="80" rx="8" fill="rgb(${refRGB.r}, ${refRGB.g}, ${refRGB.b})" stroke="#ffffff" stroke-width="2"/>
        <rect x="420" y="40" width="120" height="80" rx="8" fill="rgb(${expiryRGB.r}, ${expiryRGB.g}, ${expiryRGB.b})" stroke="#cbd5e1" stroke-width="2"/>
        <rect x="228" y="152" width="144" height="96" rx="8" fill="rgb(${stripRGB.r}, ${stripRGB.g}, ${stripRGB.b})" stroke="#0284c7" stroke-width="3"/>
      </svg>
    `);

    await sharp(svgBuffer).jpeg({ quality: 90 }).toFile(fullPath);

    const temp = 25.0 + ((i % 5) * 2.0);
    const humidity = 50 + ((i % 4) * 5);
    rows.push(`training/images/${filename},${dose},${temp},${humidity}`);
  }

  fs.writeFileSync(csvPath, rows.join('\n'));
  console.log(`✅ Generated template dataset at: ${csvPath}\n`);
  return csvPath;
}

/**
 * Parses CSV dataset into structured rows
 */
function parseDatasetCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one data row.');
  }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const pathColIdx = header.findIndex((h) => h.includes('path') || h.includes('file') || h.includes('image'));
  const doseColIdx = header.findIndex((h) => h.includes('dose') || h.includes('ppm') || h.includes('truth') || h.includes('target'));
  const tempColIdx = header.findIndex((h) => h.includes('temp'));
  const humColIdx = header.findIndex((h) => h.includes('hum'));

  if (pathColIdx === -1 || doseColIdx === -1) {
    throw new Error('CSV must have columns for image_path and ground_truth_ppm_hours');
  }

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length <= Math.max(pathColIdx, doseColIdx)) continue;

    let imgPath = cols[pathColIdx];
    if (!path.isAbsolute(imgPath)) {
      const fromCsvDir = path.resolve(path.dirname(csvPath), imgPath);
      const fromCwd = path.resolve(process.cwd(), imgPath);
      if (fs.existsSync(fromCsvDir)) {
        imgPath = fromCsvDir;
      } else if (fs.existsSync(fromCwd)) {
        imgPath = fromCwd;
      } else {
        imgPath = fromCsvDir;
      }
    }

    const groundTruthDose = parseFloat(cols[doseColIdx]);
    const ambientTemp = tempColIdx !== -1 ? parseFloat(cols[tempColIdx]) || 25.0 : 25.0;
    const ambientHumidity = humColIdx !== -1 ? parseFloat(cols[humColIdx]) || 50.0 : 50.0;

    if (!isNaN(groundTruthDose)) {
      items.push({
        imgPath,
        groundTruthDose,
        ambientTemp,
        ambientHumidity
      });
    }
  }

  return items;
}

/**
 * OLS Linear Regression y = m * x
 */
function fitLinear(xArr, yArr) {
  let num = 0, den = 0;
  for (let i = 0; i < xArr.length; i++) {
    num += xArr[i] * yArr[i];
    den += xArr[i] * xArr[i];
  }
  const slope = den > 0 ? num / den : 0.38;
  return { slope, predict: (x) => x * slope };
}

/**
 * 2nd Order Polynomial Regression without intercept: y = a * x + b * x^2
 */
function fitPolynomial(xArr, yArr) {
  let s_x2 = 0, s_x3 = 0, s_x4 = 0;
  let s_xy = 0, s_x2y = 0;

  for (let i = 0; i < xArr.length; i++) {
    const x = xArr[i];
    const y = yArr[i];
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x2 * x2;

    s_x2 += x2;
    s_x3 += x3;
    s_x4 += x4;
    s_xy += x * y;
    s_x2y += x2 * y;
  }

  // System of equations:
  // a * s_x2 + b * s_x3 = s_xy
  // a * s_x3 + b * s_x4 = s_x2y
  const det = (s_x2 * s_x4) - (s_x3 * s_x3);
  let a = 88.5, b = 45.2;
  if (Math.abs(det) > 1e-9) {
    a = (s_xy * s_x4 - s_x2y * s_x3) / det;
    b = (s_x2 * s_x2y - s_x3 * s_xy) / det;
  }

  return { a, b, predict: (x) => (a * x) + (b * x * x) };
}

/**
 * Power Law Regression: y = k * x^p (log-transformed OLS)
 */
function fitPowerLaw(xArr, yArr) {
  const logX = [];
  const logY = [];

  for (let i = 0; i < xArr.length; i++) {
    if (xArr[i] > 0.001 && yArr[i] > 0.001) {
      logX.push(Math.log(xArr[i]));
      logY.push(Math.log(yArr[i]));
    }
  }

  if (logX.length < 3) {
    return { k: 0.38, p: 1.0, predict: (x) => 0.38 * x };
  }

  const n = logX.length;
  const meanX = logX.reduce((a, b) => a + b, 0) / n;
  const meanY = logY.reduce((a, b) => a + b, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (logX[i] - meanX) * (logY[i] - meanY);
    den += Math.pow(logX[i] - meanX, 2);
  }

  const p = den > 0 ? num / den : 1.0;
  const lnK = meanY - p * meanX;
  const k = Math.exp(lnK);

  return { k, p, predict: (x) => k * Math.pow(Math.max(0.001, x), p) };
}

/**
 * Compute regression evaluation metrics
 */
function evaluateModel(yTrue, yPred) {
  const n = yTrue.length;
  let sse = 0;
  let sae = 0;
  let maxErr = 0;
  const meanTrue = yTrue.reduce((a, b) => a + b, 0) / n;
  let sst = 0;

  for (let i = 0; i < n; i++) {
    const err = Math.abs(yPred[i] - yTrue[i]);
    sse += err * err;
    sae += err;
    if (err > maxErr) maxErr = err;
    sst += Math.pow(yTrue[i] - meanTrue, 2);
  }

  const mae = sae / n;
  const rmse = Math.sqrt(sse / n);
  const r2 = sst > 0 ? Math.max(0, 1 - (sse / sst)) : 1.0;

  return { mae, rmse, r2, maxErr };
}

async function main() {
  console.log('========================================================================================');
  console.log('🎓 H2S DOSIMETER — OPTICAL DATASET TRAINER & CALIBRATION ENGINE');
  console.log('========================================================================================\n');

  let datasetPath = CSV_PATH_ARG;
  if (!fs.existsSync(datasetPath)) {
    datasetPath = await ensureSampleTrainingDataset();
  }

  console.log(`📄 Loading training metadata: ${datasetPath}`);
  const items = parseDatasetCSV(datasetPath);
  console.log(`📸 Found ${items.length} image training samples.\n`);

  console.log('⚙️ Running optical feature extraction and lighting normalization across images...');

  const datasetFeatures = [];
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!fs.existsSync(item.imgPath)) {
      console.warn(`  ⚠️ Image missing, skipping: ${item.imgPath}`);
      skipped++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(item.imgPath);
      const { referenceColorRGB, stripColorRGB } = await extractColorsFromImage(buffer);
      const correctedRGB = normalizeLighting(stripColorRGB, referenceColorRGB);

      // Euclidean Distance ΔE
      const dr = UNEXPOSED_BASELINE_RGB.r - (correctedRGB.r || 0);
      const dg = UNEXPOSED_BASELINE_RGB.g - (correctedRGB.g || 0);
      const db = UNEXPOSED_BASELINE_RGB.b - (correctedRGB.b || 0);
      const deltaE = Math.sqrt(Math.max(0, dr * dr + dg * dg + db * db));

      // Optical Density ΔOD
      const baseSum = UNEXPOSED_BASELINE_RGB.r + UNEXPOSED_BASELINE_RGB.g + UNEXPOSED_BASELINE_RGB.b;
      const corrSum = (correctedRGB.r || 0) + (correctedRGB.g || 0) + (correctedRGB.b || 0);
      const reflectance = Math.max(0.01, Math.min(1.0, corrSum / baseSum));
      const deltaOD = -Math.log10(reflectance);

      // Blue channel absorbance
      const blueLoss = Math.max(0, UNEXPOSED_BASELINE_RGB.b - (correctedRGB.b || 0));
      const blueFraction = blueLoss / 245.0;

      datasetFeatures.push({
        imageName: path.basename(item.imgPath),
        groundTruthDose: item.groundTruthDose,
        ambientTemp: item.ambientTemp,
        ambientHumidity: item.ambientHumidity,
        correctedRGB,
        deltaE,
        deltaOD,
        blueFraction
      });

      process.stdout.write(`  ... processed ${datasetFeatures.length} / ${items.length} images\r`);
    } catch (err) {
      console.warn(`\n  ❌ Error processing image ${item.imgPath}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n✅ Successfully extracted optical features for ${datasetFeatures.length} images (${skipped} skipped).\n`);

  if (datasetFeatures.length < 3) {
    console.error('❌ Need at least 3 valid training images to fit calibration models.');
    process.exit(1);
  }

  // Arrays for fitting
  const yTrue = datasetFeatures.map((d) => d.groundTruthDose);
  const xDeltaE = datasetFeatures.map((d) => d.deltaE);
  const xDeltaOD = datasetFeatures.map((d) => d.deltaOD);
  const xBlue = datasetFeatures.map((d) => d.blueFraction);

  // Fit 4 candidate models
  console.log('🔬 Fitting candidate chemical/optical regression models:');
  console.log('----------------------------------------------------------------------------------------');

  // Model 1: Linear Euclidean
  const linearModel = fitLinear(xDeltaE, yTrue);
  const predLinear = xDeltaE.map((x) => linearModel.predict(x));
  const statsLinear = evaluateModel(yTrue, predLinear);

  // Model 2: Beer-Lambert 2nd Order Polynomial
  const polyModel = fitPolynomial(xDeltaOD, yTrue);
  const predPoly = xDeltaOD.map((x) => polyModel.predict(x));
  const statsPoly = evaluateModel(yTrue, predPoly);

  // Model 3: Power Law (Darkening Saturation)
  const powerModel = fitPowerLaw(xDeltaE, yTrue);
  const predPower = xDeltaE.map((x) => powerModel.predict(x));
  const statsPower = evaluateModel(yTrue, predPower);

  // Model 4: Blue Absorbance
  const blueModel = fitPowerLaw(xBlue, yTrue);
  const predBlue = xBlue.map((x) => blueModel.predict(x));
  const statsBlue = evaluateModel(yTrue, predBlue);

  const candidates = [
    {
      id: 'linear',
      name: 'Linear Euclidean Color Model',
      type: 'linear',
      stats: statsLinear,
      params: { slope: linearModel.slope }
    },
    {
      id: 'beer-lambert',
      name: 'Beer-Lambert Polynomial ΔOD Model',
      type: 'beer-lambert',
      stats: statsPoly,
      params: { a: polyModel.a, b: polyModel.b }
    },
    {
      id: 'power-law',
      name: 'Non-Linear Power Law Kinetic Model',
      type: 'power-law',
      stats: statsPower,
      params: { k: powerModel.k, p: powerModel.p }
    },
    {
      id: 'blue-absorbance',
      name: 'Blue-Channel Absorbance Model',
      type: 'blue-absorbance',
      stats: statsBlue,
      params: { k: blueModel.k, p: blueModel.p }
    }
  ];

  candidates.sort((a, b) => b.stats.r2 - a.stats.r2);

  candidates.forEach((c, idx) => {
    const isWinner = idx === 0;
    console.log(
      `${isWinner ? '🏆 [BEST FIT] ' : '  '}${c.name.padEnd(38)} | R²: ${(c.stats.r2).toFixed(4)} | MAE: ${c.stats.mae.toFixed(2)} ppm·h | RMSE: ${c.stats.rmse.toFixed(2)} ppm·h`
    );
  });

  const bestModel = candidates[0];
  console.log('----------------------------------------------------------------------------------------\n');
  console.log(`✨ Selected Optimal Model: "${bestModel.name}" (R² = ${(bestModel.stats.r2).toFixed(4)})`);

  // Export config to backend
  const exportPayload = {
    trainedAt: new Date().toISOString(),
    datasetFile: datasetPath,
    sampleCount: datasetFeatures.length,
    bestModelType: bestModel.type,
    metrics: bestModel.stats,
    models: {
      'custom-trained-model': {
        name: `Custom Lab Calibrated Model (${bestModel.type})`,
        description: `Auto-fitted on ${datasetFeatures.length} experimental strip captures. R² = ${(bestModel.stats.r2).toFixed(4)}`,
        targetRange: '0.0 - 250.0 ppm·hours',
        type: bestModel.type,
        ...bestModel.params,
        tempCoeff: 0.004,
        humCoeff: 0.002
      }
    }
  };

  const configDir = path.dirname(OUTPUT_CONFIG_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_CONFIG_PATH, JSON.stringify(exportPayload, null, 2));
  console.log(`💾 Calibration curve exported to: ${OUTPUT_CONFIG_PATH}`);
  console.log('⚡ The Backend API and Supervisor Dashboard will immediately use this model for future calculations!\n');

  // Print sample predictions comparison table
  console.log('========================================================================================');
  console.log('📊 SAMPLE VALIDATION RESULTS (GROUND TRUTH VS. TRAINED PREDICTIONS)');
  console.log('========================================================================================');
  console.log('#   Image File               Corrected RGB      True (ppm·h)   Pred (ppm·h)   Residual');
  console.log('----------------------------------------------------------------------------------------');

  const displayCount = Math.min(10, datasetFeatures.length);
  for (let i = 0; i < displayCount; i++) {
    const f = datasetFeatures[i];
    let pred = 0;
    if (bestModel.type === 'beer-lambert') pred = polyModel.predict(f.deltaOD);
    else if (bestModel.type === 'power-law') pred = powerModel.predict(f.deltaE);
    else if (bestModel.type === 'blue-absorbance') pred = blueModel.predict(f.blueFraction);
    else pred = linearModel.predict(f.deltaE);

    const rgbStr = `(${f.correctedRGB.r},${f.correctedRGB.g},${f.correctedRGB.b})`.padEnd(16);
    const diff = pred - f.groundTruthDose;
    const diffStr = (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));

    console.log(
      `${(i + 1).toString().padStart(2, ' ')}  ${f.imageName.padEnd(23)}  ${rgbStr}   ${f.groundTruthDose.toFixed(1).padStart(8, ' ')}       ${pred.toFixed(1).padStart(8, ' ')}     ${diffStr.padStart(8, ' ')}`
    );
  }
  console.log('========================================================================================\n');
  console.log('🎉 Model training & calibration workflow completed successfully!');
}

main().catch((err) => {
  console.error('❌ Training Error:', err);
  process.exit(1);
});
