"""
h2s_dosimeter.calibration.camera_matrix
=======================================
Management of sensor-specific Camera Color Correction Matrices (CCM).

CALIBRATION DISCLOSURE:
A universal RGB->XYZ matrix does NOT exist across different smartphone camera models.
The default configuration uses the standard sRGB/BT.709 D65 matrix and is clearly
flagged as a FALLBACK testing configuration.
"""

from dataclasses import dataclass, asdict
import json
import os
from typing import Dict, Optional, Union
import numpy as np
from ..color.rgb_xyz import DEFAULT_SRGB_TO_XYZ_MATRIX


@dataclass
class CameraCalibrationConfig:
    """Camera color characterization profile."""
    camera_model: str
    ccm_matrix: np.ndarray
    is_fallback: bool
    calibration_date: str
    notes: str

    def to_dict(self) -> Dict:
        return {
            "camera_model": self.camera_model,
            "ccm_matrix": self.ccm_matrix.tolist(),
            "is_fallback": self.is_fallback,
            "calibration_date": self.calibration_date,
            "notes": self.notes
        }


def get_default_camera_config() -> CameraCalibrationConfig:
    """Return fallback sRGB testing configuration."""
    return CameraCalibrationConfig(
        camera_model="Generic-sRGB-Fallback",
        ccm_matrix=DEFAULT_SRGB_TO_XYZ_MATRIX.copy(),
        is_fallback=True,
        calibration_date="2026-01-01",
        notes="Standard ITU-R BT.709 sRGB matrix (D65). FALLBACK ONLY — calibrate sensor for production."
    )


def load_camera_matrix(config_path_or_dict: Optional[Union[str, Dict]] = None) -> CameraCalibrationConfig:
    """
    Load a camera calibration profile from file path or dictionary.
    
    Args:
        config_path_or_dict: File path to JSON config, or dictionary containing matrix definition.
                             If None, returns the fallback sRGB profile.
                             
    Returns:
        CameraCalibrationConfig instance.
    """
    if config_path_or_dict is None:
        return get_default_camera_config()
        
    data = None
    if isinstance(config_path_or_dict, str):
        if not os.path.exists(config_path_or_dict):
            raise FileNotFoundError(f"Camera config file not found: {config_path_or_dict}")
        with open(config_path_or_dict, "r", encoding="utf-8") as f:
            data = json.load(f)
    elif isinstance(config_path_or_dict, dict):
        data = config_path_or_dict
    else:
        raise TypeError(f"Expected file path or dict, got {type(config_path_or_dict)}")
        
    raw_matrix = data.get("ccm_matrix") or data.get("CCM") or data.get("matrix")
    if raw_matrix is None:
        return get_default_camera_config()
        
    matrix_np = np.asarray(raw_matrix, dtype=np.float64)
    if matrix_np.shape != (3, 3):
        raise ValueError(f"Loaded CCM matrix must be 3x3, got shape {matrix_np.shape}")
        
    is_fallback = bool(data.get("is_fallback", False))
    camera_model = str(data.get("camera_model", "Custom-Calibrated-Camera"))
    cal_date = str(data.get("calibration_date", "Unspecified"))
    notes = str(data.get("notes", "Calibrated CCM profile."))
    
    return CameraCalibrationConfig(
        camera_model=camera_model,
        ccm_matrix=matrix_np,
        is_fallback=is_fallback,
        calibration_date=cal_date,
        notes=notes
    )


def save_camera_matrix(config: CameraCalibrationConfig, output_path: str) -> None:
    """Save camera calibration profile to JSON file."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(config.to_dict(), f, indent=2)
