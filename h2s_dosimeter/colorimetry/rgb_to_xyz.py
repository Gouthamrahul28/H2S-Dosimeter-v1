"""Camera-specific linear RGB to CIE XYZ transformation.

Conforms to ISO 17321-1:2012 / ISO/TR 17321-2:2012.
Applies the 3x3 Camera Color Correction Matrix (CCM):
    XYZ = CCM @ RGB_linear

Note:
    A camera's spectral sensitivity S(λ) is device-dependent.
    The CCM characterizes the specific camera sensor rather than assuming
    standard sRGB response for all hardware.
"""

from typing import Optional, Union
import numpy as np

# Standard IEC 61966-2-1 sRGB to CIE XYZ (D65) transformation matrix (Fallback)
SRGB_D65_MATRIX = np.array([
    [0.4124564, 0.3575761, 0.1804375],
    [0.2126729, 0.7151522, 0.0721750],
    [0.0193339, 0.1191920, 0.9503041]
], dtype=np.float64)


def rgb_to_xyz(
    linear_rgb: Union[np.ndarray, list, tuple],
    ccm: Optional[np.ndarray] = None
) -> np.ndarray:
    """Transforms linear RGB [0.0, 1.0] to CIE XYZ tristimulus values.

    Args:
        linear_rgb: 1D array of 3 elements [R_lin, G_lin, B_lin] or 2D array (N, 3).
        ccm: 3x3 Camera Color Correction Matrix. If None, falls back to standard sRGB D65 matrix.

    Returns:
        np.ndarray: CIE XYZ tristimulus values (Y normalized to 1.0 for perfect white).
    """
    rgb_arr = np.asarray(linear_rgb, dtype=np.float64)
    matrix = np.asarray(ccm, dtype=np.float64) if ccm is not None else SRGB_D65_MATRIX

    if matrix.shape != (3, 3):
        raise ValueError(f"CCM matrix must be 3x3, got shape {matrix.shape}")

    if rgb_arr.ndim == 1:
        if rgb_arr.shape[0] != 3:
            raise ValueError(f"linear_rgb must contain 3 elements, got shape {rgb_arr.shape}")
        xyz = matrix @ rgb_arr
    elif rgb_arr.ndim == 2:
        if rgb_arr.shape[1] != 3:
            raise ValueError(f"linear_rgb must have shape (N, 3), got shape {rgb_arr.shape}")
        xyz = (matrix @ rgb_arr.T).T
    else:
        raise ValueError(f"Unsupported array dimensions {rgb_arr.ndim}")

    return np.maximum(0.0, xyz)


def xyz_to_rgb(
    xyz: Union[np.ndarray, list, tuple],
    ccm: Optional[np.ndarray] = None
) -> np.ndarray:
    """Transforms CIE XYZ back to linear RGB via matrix inversion.

    Args:
        xyz: 1D array of 3 elements [X, Y, Z] or 2D array (N, 3).
        ccm: 3x3 Camera Color Correction Matrix.

    Returns:
        np.ndarray: Linear RGB float array.
    """
    xyz_arr = np.asarray(xyz, dtype=np.float64)
    matrix = np.asarray(ccm, dtype=np.float64) if ccm is not None else SRGB_D65_MATRIX
    inv_matrix = np.linalg.inv(matrix)

    if xyz_arr.ndim == 1:
        rgb = inv_matrix @ xyz_arr
    else:
        rgb = (inv_matrix @ xyz_arr.T).T

    return np.clip(rgb, 0.0, 1.0)
