"""
h2s_dosimeter.color.rgb_xyz
===========================
Transforms Linear RGB to CIE 1931 XYZ tristimulus values using a Camera
Color Correction Matrix (CCM).

CALIBRATION DISCLOSURE:
A universal RGB->XYZ matrix does NOT exist across different CMOS sensors, lens coatings,
and IR-cut filters. The default matrix below is the standard sRGB/BT.709 D65 reference
matrix, provided STRICTLY as a fallback for initial testing and synthetic validation.
Production deployments MUST calibrate and load a sensor-specific 3x3 CCM.
"""

from typing import Optional, Union
import numpy as np

# Standard sRGB/BT.709 to CIE 1931 XYZ (D65 reference white)
# NOTE: THIS IS A FALLBACK REFERENCE MATRIX, NOT A CAMERA-SPECIFIC CALIBRATION.
DEFAULT_SRGB_TO_XYZ_MATRIX = np.array([
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041]
], dtype=np.float64)

# Inverse XYZ to sRGB/BT.709 matrix
DEFAULT_XYZ_TO_SRGB_MATRIX = np.linalg.inv(DEFAULT_SRGB_TO_XYZ_MATRIX)


def linear_rgb_to_xyz(
    linear_rgb: Union[np.ndarray, list, tuple],
    ccm: Optional[np.ndarray] = None
) -> np.ndarray:
    """
    Transform Linear RGB to CIE 1931 XYZ tristimulus space via Color Correction Matrix (CCM).
    
    Formula:
        XYZ = CCM @ RGB_linear
        
    Args:
        linear_rgb: Linear RGB array with shape (3,), (N, 3), or (H, W, 3) in [0.0, 1.0].
        ccm: 3x3 Camera Color Correction Matrix. If None, uses DEFAULT_SRGB_TO_XYZ_MATRIX.
        
    Returns:
        np.ndarray: CIE XYZ tristimulus values (Y normalized such that D65 white Y=1.0).
    """
    matrix = np.asarray(ccm if ccm is not None else DEFAULT_SRGB_TO_XYZ_MATRIX, dtype=np.float64)
    if matrix.shape != (3, 3):
        raise ValueError(f"Color Correction Matrix must be 3x3, got shape {matrix.shape}")
        
    arr = np.asarray(linear_rgb, dtype=np.float64)
    
    # Handle single color vector (3,)
    if arr.ndim == 1 and arr.shape[0] == 3:
        return matrix @ arr
        
    # Handle batch of colors (N, 3) or image (H, W, 3)
    # Using Einstein summation for arbitrary leading dimensions: ...i, ji -> ...j
    return np.einsum('...i,ji->...j', arr, matrix.T)


def xyz_to_linear_rgb(
    xyz: Union[np.ndarray, list, tuple],
    ccm: Optional[np.ndarray] = None
) -> np.ndarray:
    """
    Transform CIE 1931 XYZ back to Linear RGB via inverse Color Correction Matrix.
    
    Formula:
        RGB_linear = inv(CCM) @ XYZ
        
    Args:
        xyz: CIE XYZ array of shape (3,), (N, 3), or (H, W, 3).
        ccm: 3x3 Camera Color Correction Matrix. If None, inverts DEFAULT_SRGB_TO_XYZ_MATRIX.
        
    Returns:
        np.ndarray: Linear RGB array clamped to [0.0, 1.0].
    """
    if ccm is not None:
        inv_matrix = np.linalg.inv(np.asarray(ccm, dtype=np.float64))
    else:
        inv_matrix = DEFAULT_XYZ_TO_SRGB_MATRIX
        
    arr = np.asarray(xyz, dtype=np.float64)
    
    if arr.ndim == 1 and arr.shape[0] == 3:
        res = inv_matrix @ arr
    else:
        res = np.einsum('...i,ji->...j', arr, inv_matrix.T)
        
    return np.clip(res, 0.0, 1.0)
