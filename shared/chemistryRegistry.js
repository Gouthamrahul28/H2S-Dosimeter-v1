/**
 * shared/chemistryRegistry.js
 * 
 * Authoritative Sensor Chemistry Registry for H₂S Dosimeter System (SIH26118).
 * Provides centralized configuration, identification, and isolation guards
 * for all supported and candidate chemical sensing indicators.
 * 
 * Chemistries:
 * 1. CU_PAN: Copper(II) 1-(2-pyridylazo)-2-naphthol complex on cellulose substrate.
 * 2. LEAD_ACETATE: Lead(II) acetate Pb(CH3COO)2 sensing paper (darkens to PbS).
 */

export const CHEMISTRY_IDS = Object.freeze({
  CU_PAN: 'CU_PAN',
  LEAD_ACETATE: 'LEAD_ACETATE'
});

/**
 * Normalizes input string to canonical chemistry identifier.
 * Handles legacy aliases ('Cu-PAN', 'cu-pan', 'Lead-Acetate', etc.)
 * 
 * @param {string} rawId
 * @returns {string|null} Canonical CHEMISTRY_IDS value or null if unrecognized
 */
export function normalizeChemistryId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  const clean = rawId.trim().toUpperCase().replace(/[-_ ]+/g, '_');
  
  if (clean === 'CU_PAN' || clean === 'CUPAN' || clean === 'COPPER_PAN') {
    return CHEMISTRY_IDS.CU_PAN;
  }
  if (clean === 'LEAD_ACETATE' || clean === 'LEADACETATE' || clean === 'LEAD' || clean === 'PBS') {
    return CHEMISTRY_IDS.LEAD_ACETATE;
  }
  return null;
}

/**
 * Authoritative Central Chemistry Configuration Registry.
 * Strict Scientific Rule: Values are populated ONLY when supported by real experimental data.
 * Unvalidated or uncharacterized parameters are explicitly null.
 */
export const CHEMISTRY_CONFIGS = Object.freeze({
  [CHEMISTRY_IDS.CU_PAN]: Object.freeze({
    id: CHEMISTRY_IDS.CU_PAN,
    legacyAlias: 'Cu-PAN',
    displayName: 'Cu-PAN (Copper(II)-PAN)',
    targetGas: 'H2S',
    primaryUnit: 'ppm·h',
    reactionDescription: 'Cu(II)-PAN + H2S -> CuS + H-PAN (Purple/Violet -> Yellow/Orange)',
    substrate: 'Regenerated Cellulose / Porous Paper Matrix',
    opticalTransition: {
      initialColorName: 'PURPLE_VIOLET',
      finalColorName: 'YELLOW_ORANGE',
      virginBaselineLab: Object.freeze({ L: 42.50, a: 38.20, b: -28.40 })
    },
    calibrationStatus: 'EXPERIMENTAL_VALIDATED',
    calibrationDataset: 'CUPAN-DATA-v4',
    calibrationModel: 'cupan-cielab-v1',
    environmentalModel: Object.freeze({
      type: 'Arrhenius',
      eaOverR: 1420.0,
      rhExponent: 0.38,
      referenceTempC: 25.0,
      referenceRhPct: 50.0,
      isValidated: false // Literature parameter estimate; marked unvalidated per master instruction
    }),
    validatedRange: Object.freeze({
      minDosePpmH: 0.0,
      maxDosePpmH: 160.0,
      minTempC: 10.0,
      maxTempC: 50.0,
      minRhPct: 15.0,
      maxRhPct: 90.0
    }),
    sensingCapacity: Object.freeze({
      maxValidatedCumulativeDosePpmH: 160.0
    })
  }),

  [CHEMISTRY_IDS.LEAD_ACETATE]: Object.freeze({
    id: CHEMISTRY_IDS.LEAD_ACETATE,
    legacyAlias: 'Lead-Acetate',
    displayName: 'Lead Acetate (Pb(OAc)₂)',
    targetGas: 'H2S',
    primaryUnit: 'ppm·h',
    reactionDescription: 'Pb(CH3COO)2 + H2S -> PbS + 2 CH3COOH (Colorless/White -> Brown/Black PbS)',
    substrate: 'Porous Filter Paper Impregnated with Lead Acetate',
    opticalTransition: {
      initialColorName: 'WHITE_OFFWHITE',
      finalColorName: 'BROWN_BLACK',
      virginBaselineLab: null // Uncalibrated: DO NOT FABRICATE
    },
    calibrationStatus: 'CALIBRATION_DATA_REQUIRED',
    calibrationDataset: 'LEAD_ACETATE_DATASET_V1', // Assigned dataset schema (status remains CALIBRATION_DATA_REQUIRED)
    calibrationModel: 'lead_acetate_model_v1',     // Dedicated model architecture
    environmentalModel: null, // Temperature/humidity kinetics not yet characterized
    validatedRange: null,     // Uncalibrated domain
    sensingCapacity: null     // Experimental saturation threshold not yet determined
  })
});

/**
 * Returns configuration object for a chemistry identifier.
 * 
 * @param {string} chemistryId
 * @returns {object} Authoritative chemistry config
 * @throws {Error} If chemistry ID is unrecognized
 */
export function getChemistryConfig(chemistryId) {
  const canonical = normalizeChemistryId(chemistryId);
  if (!canonical || !CHEMISTRY_CONFIGS[canonical]) {
    throw new Error(`UNSUPPORTED_CHEMISTRY: Unknown chemistry '${chemistryId}'. Supported: ${Object.keys(CHEMISTRY_IDS).join(', ')}`);
  }
  return CHEMISTRY_CONFIGS[canonical];
}

/**
 * Hard Isolation Rule Validator:
 * Ensures a scan for chemistry A never accidentally evaluates against calibration model for chemistry B.
 * 
 * @param {string} sensorChemistry - Chemistry of the strip/sample
 * @param {string} modelChemistry - Chemistry of the calibration model
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateModelChemistryMatch(sensorChemistry, modelChemistry) {
  const normSensor = normalizeChemistryId(sensorChemistry);
  const normModel = normalizeChemistryId(modelChemistry);

  if (!normSensor) {
    return {
      valid: false,
      errorCode: 'INVALID_SENSOR_CHEMISTRY',
      error: `Sensor chemistry '${sensorChemistry}' is not recognized.`
    };
  }

  if (!normModel) {
    return {
      valid: false,
      errorCode: 'INVALID_MODEL_CHEMISTRY',
      error: `Model chemistry '${modelChemistry}' is not recognized.`
    };
  }

  if (normSensor !== normModel) {
    return {
      valid: false,
      errorCode: 'MODEL_CHEMISTRY_MISMATCH',
      error: `HARD ISOLATION VIOLATION: Cannot execute ${normModel} calibration model on a ${normSensor} sensor strip.`
    };
  }

  return { valid: true };
}
