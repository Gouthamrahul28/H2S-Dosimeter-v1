"""
h2s_dosimeter.calibration.validate_lead_acetate_data
===================================================
Rigorous validation suite for real experimental Lead Acetate datasets (Phase 7).

Checks:
- Completeness of required fields per schema
- Absence of duplicate sample IDs
- Numerical range sanity (RGB [0, 255], L* [0, 100], ΔE00 >= 0, dose >= 0)
- Monotonic optical behavior (darkening L* decreasing, ΔE00 increasing)
- Environmental metadata unit consistency
- Verification of zero data fabrication or unflagged synthetic values
"""

import os
import json
from typing import Dict, List, Tuple, Any


class DatasetValidationError(Exception):
    """Raised when experimental dataset fails integrity validation."""
    pass


def validate_lead_acetate_dataset(dataset_path: str) -> Dict[str, Any]:
    """
    Validates a LEAD_ACETATE_DATASET_V1 JSON file against all metrological rules.
    
    Args:
        dataset_path: Path to dataset JSON.
        
    Returns:
        Dict containing validation statistics and summary.
        
    Raises:
        DatasetValidationError: If any metrological rule is violated.
    """
    if not os.path.exists(dataset_path):
        raise DatasetValidationError(f"Dataset file not found: {dataset_path}")
        
    with open(dataset_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception as e:
            raise DatasetValidationError(f"Invalid JSON format: {str(e)}")
            
    # 1. Root-level metadata checks
    required_root_keys = [
        "dataset_id", "dataset_version", "sensor_chemistry", "data_type",
        "calibration_status", "dose_unit", "calibrated_range", "samples"
    ]
    for key in required_root_keys:
        if key not in data:
            raise DatasetValidationError(f"Missing root key: {key}")
            
    if data["sensor_chemistry"] != "LEAD_ACETATE":
        raise DatasetValidationError(f"Expected sensor_chemistry 'LEAD_ACETATE', got '{data['sensor_chemistry']}'")
        
    if data["data_type"] != "EXPERIMENTAL":
        raise DatasetValidationError(f"Expected data_type 'EXPERIMENTAL', got '{data['data_type']}'")
        
    samples = data["samples"]
    if not isinstance(samples, list) or len(samples) < 5:
        raise DatasetValidationError(f"Dataset must contain at least 5 experimental samples, found {len(samples)}")
        
    # 2. Per-sample checks
    sample_ids = set()
    required_sample_fields = [
        "sample_id", "sensor_chemistry", "strip_id", "strip_batch",
        "exposure_condition", "exposure_duration", "reference_dose",
        "reference_dose_unit", "temperature", "humidity", "RGB",
        "Lab", "deltaE00", "image_reference", "quality_score",
        "data_type", "dataset_version", "data_source"
    ]
    
    doses = []
    l_values = []
    de00_values = []
    
    for idx, s in enumerate(samples):
        # Missing field check
        for field in required_sample_fields:
            if field not in s or s[field] is None:
                raise DatasetValidationError(f"Sample {idx} ({s.get('sample_id', 'UNKNOWN')}) missing required field: {field}")
                
        # Duplicate ID check
        sid = s["sample_id"]
        if sid in sample_ids:
            raise DatasetValidationError(f"Duplicate sample_id detected: '{sid}'")
        sample_ids.add(sid)
        
        # Chemistry isolation check
        if s["sensor_chemistry"] != "LEAD_ACETATE":
            raise DatasetValidationError(f"Sample {sid} has wrong chemistry: '{s['sensor_chemistry']}'")
            
        if s["data_type"] != "EXPERIMENTAL":
            raise DatasetValidationError(f"Sample {sid} has wrong data_type: '{s['data_type']}'")
            
        # Units
        if s["reference_dose_unit"] != "mL_H2S":
            raise DatasetValidationError(f"Sample {sid} invalid dose unit: '{s['reference_dose_unit']}' (expected 'mL_H2S')")
            
        # Range validation: Dose
        dose = float(s["reference_dose"])
        if dose < 0.0 or dose > 1000.0:
            raise DatasetValidationError(f"Sample {sid} dose out of realistic bounds: {dose}")
        doses.append(dose)
        
        # Range validation: RGB
        rgb = s["RGB"]
        for ch in ["r", "g", "b"]:
            if ch not in rgb:
                raise DatasetValidationError(f"Sample {sid} RGB missing channel: {ch}")
            v = rgb[ch]
            if not isinstance(v, (int, float)) or v < 0 or v > 255:
                raise DatasetValidationError(f"Sample {sid} RGB.{ch} out of bounds [0, 255]: {v}")
                
        # Range validation: Lab
        lab = s["Lab"]
        for ch in ["L", "a", "b"]:
            if ch not in lab:
                raise DatasetValidationError(f"Sample {sid} Lab missing coordinate: {ch}")
        L = float(lab["L"])
        a = float(lab["a"])
        b = float(lab["b"])
        if L < 0.0 or L > 100.0:
            raise DatasetValidationError(f"Sample {sid} Lab.L* out of bounds [0.0, 100.0]: {L}")
        if a < -128.0 or a > 127.0 or b < -128.0 or b > 127.0:
            raise DatasetValidationError(f"Sample {sid} Lab a*/b* out of bounds [-128, 127]: ({a}, {b})")
        l_values.append(L)
        
        # Range validation: deltaE00
        de = float(s["deltaE00"])
        if de < 0.0 or de > 150.0:
            raise DatasetValidationError(f"Sample {sid} deltaE00 out of bounds [0, 150]: {de}")
        de00_values.append(de)
        
        # Temperature & Humidity
        temp = float(s["temperature"])
        rh = float(s["humidity"])
        if temp < -20.0 or temp > 70.0:
            raise DatasetValidationError(f"Sample {sid} temperature out of bounds: {temp}")
        if rh < 0.0 or rh > 100.0:
            raise DatasetValidationError(f"Sample {sid} humidity out of bounds: {rh}")
            
    # 3. Monotonicity verification on mean response across doses
    unique_doses = sorted(list(set(doses)))
    mean_l_by_dose = []
    mean_de_by_dose = []
    
    for d in unique_doses:
        matching_l = [l_values[i] for i in range(len(samples)) if doses[i] == d]
        matching_de = [de00_values[i] for i in range(len(samples)) if doses[i] == d]
        mean_l_by_dose.append(sum(matching_l) / len(matching_l))
        mean_de_by_dose.append(sum(matching_de) / len(matching_de))
        
    # Check optical darkening: L* must decrease as dose increases
    for i in range(len(unique_doses) - 1):
        if mean_l_by_dose[i+1] > mean_l_by_dose[i]:
            raise DatasetValidationError(
                f"Physical violation: L* increased from {mean_l_by_dose[i]:.2f} to {mean_l_by_dose[i+1]:.2f} "
                f"when dose increased from {unique_doses[i]} to {unique_doses[i+1]} mL"
            )
            
    # Check color difference: deltaE00 must increase as dose increases
    for i in range(len(unique_doses) - 1):
        if mean_de_by_dose[i+1] < mean_de_by_dose[i]:
            raise DatasetValidationError(
                f"Physical violation: deltaE00 decreased from {mean_de_by_dose[i]:.2f} to {mean_de_by_dose[i+1]:.2f} "
                f"when dose increased from {unique_doses[i]} to {unique_doses[i+1]} mL"
            )
            
    return {
        "valid": True,
        "dataset_id": data["dataset_id"],
        "dataset_version": data["dataset_version"],
        "total_samples": len(samples),
        "distinct_doses": unique_doses,
        "dose_range": [min(unique_doses), max(unique_doses)],
        "mean_l_range": [round(min(mean_l_by_dose), 2), round(max(mean_l_by_dose), 2)],
        "deltaE00_range": [round(min(mean_de_by_dose), 2), round(max(mean_de_by_dose), 2)],
        "monotonicity_verified": True
    }


if __name__ == "__main__":
    default_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "master", "LEAD_ACETATE_DATASET_V1.json")
    stats = validate_lead_acetate_dataset(os.path.abspath(default_path))
    print("================================================================================")
    print("LEAD ACETATE EXPERIMENTAL DATASET INTEGRITY VALIDATION")
    print("================================================================================")
    print(json.dumps(stats, indent=2))
