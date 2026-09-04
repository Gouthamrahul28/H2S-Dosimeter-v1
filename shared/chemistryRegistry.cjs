/**
 * shared/chemistryRegistry.cjs
 * 
 * CommonJS export mirror of shared/chemistryRegistry.js for Node.js backend.
 */

const registry = require('./chemistryRegistry.js');

module.exports = {
  CHEMISTRY_IDS: registry.CHEMISTRY_IDS,
  CHEMISTRY_CONFIGS: registry.CHEMISTRY_CONFIGS,
  normalizeChemistryId: registry.normalizeChemistryId,
  getChemistryConfig: registry.getChemistryConfig,
  validateModelChemistryMatch: registry.validateModelChemistryMatch
};
