/**
 * Sector Rotation Analysis
 * Shared core logic for analyzing sector rotation and relative strength
 */

export { SECTOR_ETFS, type SectorETF } from './etfs.ts';
export {
  analyzeSectorRotation,
  calculateRelativeStrength,
  calculateSimpleRSI,
  type SectorAnalysis,
  type SectorRotationResult,
} from './analyzer.ts';
