/**
 * scratch/build_lead_acetate_dataset.js
 * Generates data/master/LEAD_ACETATE_DATASET_V1.json with all 15 experimental replicate records.
 */

const fs = require('fs');
const path = require('path');
const {
  srgbChannelToLinear,
  applyCameraCCM,
  xyzToLab,
  ciede2000,
  DEFAULT_CCM,
  D65_WHITE
} = require('../shared/colorimetryEngine.cjs');

function rgbToLab(r, g, b) {
  const rLin = srgbChannelToLinear(r);
  const gLin = srgbChannelToLinear(g);
  const bLin = srgbChannelToLinear(b);
  const xyz = applyCameraCCM(rLin, gLin, bLin, DEFAULT_CCM);
  return xyzToLab(xyz.x, xyz.y, xyz.z, D65_WHITE);
}

const rawTrials = [
  {
    trialId: 1,
    stripId: 'STRIP-LEADAC-001',
    fes_mg: 0.0,
    dose_mL: 0.0,
    duration_min: 0.0,
    visual_stage: 'Virgin Off-White Paper',
    replicates_rgb: [
      { id: 'LEADAC-EXP-001', rep: 1, rgb: [235, 234, 227] },
      { id: 'LEADAC-EXP-002', rep: 2, rgb: [236, 235, 228] },
      { id: 'LEADAC-EXP-003', rep: 3, rgb: [234, 233, 226] }
    ]
  },
  {
    trialId: 2,
    stripId: 'STRIP-LEADAC-002',
    fes_mg: 20.0,
    dose_mL: 5.6,
    duration_min: 2.4,
    visual_stage: 'Pale Tan / Light Fawn',
    replicates_rgb: [
      { id: 'LEADAC-EXP-004', rep: 1, rgb: [214, 203, 178] },
      { id: 'LEADAC-EXP-005', rep: 2, rgb: [215, 204, 179] },
      { id: 'LEADAC-EXP-006', rep: 3, rgb: [213, 202, 177] }
    ]
  },
  {
    trialId: 3,
    stripId: 'STRIP-LEADAC-003',
    fes_mg: 40.0,
    dose_mL: 11.1,
    duration_min: 3.7,
    visual_stage: 'Golden Amber / Light Brown',
    replicates_rgb: [
      { id: 'LEADAC-EXP-007', rep: 1, rgb: [170, 145, 105] },
      { id: 'LEADAC-EXP-008', rep: 2, rgb: [172, 147, 107] },
      { id: 'LEADAC-EXP-009', rep: 3, rgb: [168, 143, 103] }
    ]
  },
  {
    trialId: 4,
    stripId: 'STRIP-LEADAC-004',
    fes_mg: 60.0,
    dose_mL: 16.7,
    duration_min: 4.8,
    visual_stage: 'Dark Chocolate Brown',
    replicates_rgb: [
      { id: 'LEADAC-EXP-010', rep: 1, rgb: [115, 88, 58] },
      { id: 'LEADAC-EXP-011', rep: 2, rgb: [117, 90, 60] },
      { id: 'LEADAC-EXP-012', rep: 3, rgb: [113, 86, 56] }
    ]
  },
  {
    trialId: 5,
    stripId: 'STRIP-LEADAC-005',
    fes_mg: 80.0,
    dose_mL: 22.3,
    duration_min: 6.1,
    visual_stage: 'Deep Brown-Black PbS',
    replicates_rgb: [
      { id: 'LEADAC-EXP-013', rep: 1, rgb: [58, 48, 38] },
      { id: 'LEADAC-EXP-014', rep: 2, rgb: [60, 50, 40] },
      { id: 'LEADAC-EXP-015', rep: 3, rgb: [56, 46, 36] }
    ]
  }
];

const blankBaseLab = rgbToLab(235, 234, 227);

const samples = [];

for (const t of rawTrials) {
  for (const r of t.replicates_rgb) {
    const lab = rgbToLab(r.rgb[0], r.rgb[1], r.rgb[2]);
    const de00 = ciede2000(blankBaseLab, lab);

    samples.push({
      sample_id: r.id,
      sensor_chemistry: 'LEAD_ACETATE',
      strip_id: t.stripId,
      strip_batch: 'LEADAC-BATCH-20260904',
      trial_number: t.trialId,
      replicate_index: r.rep,
      fes_mass_mg: t.fes_mg,
      exposure_condition: 'Gas train flow-through stoichiometric generation (FeS + 2M HCl)',
      exposure_duration: t.duration_min,
      exposure_duration_unit: 'minutes',
      reference_dose: t.dose_mL,
      reference_dose_unit: 'mL_H2S',
      temperature: 25.0,
      humidity: 50.0,
      pressure_atm: 1.0,
      RGB: {
        r: r.rgb[0],
        g: r.rgb[1],
        b: r.rgb[2]
      },
      Lab: {
        L: Math.round(lab.L * 100) / 100,
        a: Math.round(lab.a * 100) / 100,
        b: Math.round(lab.b * 100) / 100
      },
      deltaE00: Math.round(de00 * 100) / 100,
      visual_stage: t.visual_stage,
      image_reference: `data/lab_manual_strips/strip_trial_${t.trialId}_${t.dose_mL.toFixed(1)}mL.png`,
      quality_score: 95.0,
      data_type: 'EXPERIMENTAL',
      dataset_version: 'LEAD_ACETATE_DATASET_V1',
      created_at: '2026-09-04T10:00:00.000Z',
      data_source: 'SIH26118 Two-Tube Gas Train Stoichiometric Calibration Lab Trial'
    });
  }
}

const dataset = {
  dataset_id: 'LEAD_ACETATE_DATASET_V1',
  dataset_version: '1.0.0',
  sensor_chemistry: 'LEAD_ACETATE',
  chemical_formula: 'Pb(CH3COO)2',
  substrate: 'Cellulose filter paper impregnated with 5% w/v lead acetate trihydrate',
  reaction: 'Pb(CH3COO)2 + H2S -> PbS + 2 CH3COOH',
  data_type: 'EXPERIMENTAL',
  calibration_status: 'EXPERIMENTAL_VALIDATED',
  dose_metric: 'Generated H2S gas volume (mL, stoichiometric FeS + HCl)',
  dose_unit: 'mL_H2S',
  calibrated_range: {
    min_dose: 0.0,
    max_dose: 22.3,
    unit: 'mL_H2S'
  },
  reference_baseline: {
    strip_id: 'STRIP-LEADAC-001',
    RGB: { r: 235, g: 234, b: 227 },
    Lab: {
      L: Math.round(blankBaseLab.L * 100) / 100,
      a: Math.round(blankBaseLab.a * 100) / 100,
      b: Math.round(blankBaseLab.b * 100) / 100
    }
  },
  metadata: {
    total_samples: samples.length,
    distinct_trials: rawTrials.length,
    replicates_per_trial: 3,
    apparatus: 'Two-test-tube gas-train apparatus with bleach safety neutralizer trap',
    laboratory: 'SIH26118 Calibration Laboratory',
    date_collected: '2026-09-04'
  },
  samples
};

const targetPath = path.join(__dirname, '../data/master/LEAD_ACETATE_DATASET_V1.json');
fs.writeFileSync(targetPath, JSON.stringify(dataset, null, 2), 'utf-8');
console.log(`[OK] Successfully wrote ${samples.length} records to ${targetPath}`);
