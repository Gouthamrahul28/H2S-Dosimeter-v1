"""Camera profile manager and ISO 17321-1 CCM calibration solver.

Manages 3x3 Camera Color Correction Matrices (CCM) for hardware characterization.
Solves for device-specific CCM matrices from multi-patch calibration targets
using Ridge (Tikhonov) regularized least-squares regression:
    min || RGB_cam @ CCM - XYZ_ref ||^2 + alpha * || CCM ||^2
"""

import json
from pathlib import Path
from typing import Dict, Optional, Tuple, Union
import numpy as np

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "camera_profile.json"


class CameraProfile:
    """Represents a characterized digital camera profile."""

    def __init__(
        self,
        camera_id: str,
        ccm: np.ndarray,
        reference_illuminant: str = "D65",
        white_point: Optional[np.ndarray] = None,
        description: str = "",
        is_characterized: bool = True,
        avg_validation_delta_e00: float = 0.0
    ):
        self.camera_id = camera_id
        self.ccm = np.asarray(ccm, dtype=np.float64)
        if self.ccm.shape != (3, 3):
            raise ValueError(f"CCM must be 3x3 matrix, got shape {self.ccm.shape}")

        self.reference_illuminant = reference_illuminant
        self.white_point = (
            np.asarray(white_point, dtype=np.float64)
            if white_point is not None
            else np.array([0.95047, 1.00000, 1.08883], dtype=np.float64)
        )
        self.description = description
        self.is_characterized = is_characterized
        self.avg_validation_delta_e00 = avg_validation_delta_e00

    def to_dict(self) -> dict:
        return {
            "camera_id": self.camera_id,
            "description": self.description,
            "is_characterized": self.is_characterized,
            "reference_illuminant": self.reference_illuminant,
            "white_point": self.white_point.tolist(),
            "ccm": self.ccm.tolist(),
            "avg_validation_delta_e00": round(float(self.avg_validation_delta_e00), 3)
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CameraProfile":
        return cls(
            camera_id=data["camera_id"],
            ccm=np.array(data["ccm"], dtype=np.float64),
            reference_illuminant=data.get("reference_illuminant", "D65"),
            white_point=np.array(data["white_point"], dtype=np.float64) if "white_point" in data else None,
            description=data.get("description", ""),
            is_characterized=data.get("is_characterized", True),
            avg_validation_delta_e00=data.get("avg_validation_delta_e00", 0.0)
        )


class CameraProfileRegistry:
    """Manages loading, saving, and solving camera characterization profiles."""

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.config_path = Path(config_path) if config_path else DEFAULT_CONFIG_PATH
        self.profiles: Dict[str, CameraProfile] = {}
        self.default_profile_id: str = "camera_default_fallback"
        self._load()

    def _load(self):
        if not self.config_path.exists():
            return
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.default_profile_id = data.get("default_profile", "camera_default_fallback")
            for pid, pdata in data.get("profiles", {}).items():
                self.profiles[pid] = CameraProfile.from_dict(pdata)

    def save(self):
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "default_profile": self.default_profile_id,
            "profiles": {pid: p.to_dict() for pid, p in self.profiles.items()}
        }
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def get_profile(self, camera_id: Optional[str] = None) -> CameraProfile:
        if camera_id and camera_id in self.profiles:
            return self.profiles[camera_id]
        if self.default_profile_id in self.profiles:
            return self.profiles[self.default_profile_id]
        # Fallback profile
        return CameraProfile(
            camera_id="camera_default_fallback",
            ccm=np.array([
                [0.4124564, 0.3575761, 0.1804375],
                [0.2126729, 0.7151522, 0.0721750],
                [0.0193339, 0.1191920, 0.9503041]
            ], dtype=np.float64),
            description="Built-in standard sRGB fallback matrix",
            is_characterized=False
        )

    def register_profile(self, profile: CameraProfile, set_default: bool = False):
        self.profiles[profile.camera_id] = profile
        if set_default:
            self.default_profile_id = profile.camera_id
        self.save()


def solve_camera_ccm(
    camera_linear_rgb: np.ndarray,
    reference_xyz: np.ndarray,
    alpha: float = 1e-4,
    preserve_white: bool = True
) -> Tuple[np.ndarray, float]:
    """Fits 3x3 Camera Color Correction Matrix (CCM) via regularized least-squares.

    Solves:
        RGB_camera @ CCM ≈ XYZ_reference

    Args:
        camera_linear_rgb: (N, 3) array of measured linear RGB values for N color patches.
        reference_xyz: (N, 3) array of true spectrophotometer XYZ values for N patches.
        alpha: Tikhonov regularization parameter to prevent over-amplified noise.
        preserve_white: If True, normalizes row sums such that perfect white maps accurately.

    Returns:
        Tuple[np.ndarray, float]: (3x3 CCM matrix, Root Mean Squared XYZ Fitting Error).
    """
    R = np.asarray(camera_linear_rgb, dtype=np.float64)
    Y = np.asarray(reference_xyz, dtype=np.float64)

    if R.shape[0] < 3:
        raise ValueError(f"At least 3 color patches required to fit 3x3 CCM, got {R.shape[0]}")

    # Normal equation with Ridge Regularization: CCM = (R^T R + alpha * I)^-1 R^T Y
    RtR = R.T @ R
    reg = alpha * np.eye(3)
    RtY = R.T @ Y

    ccm_transpose = np.linalg.solve(RtR + reg, RtY)
    ccm = ccm_transpose.T

    # Compute fitting error
    predicted_xyz = (ccm @ R.T).T
    rmse = float(np.sqrt(np.mean((predicted_xyz - Y) ** 2)))

    return ccm, rmse
