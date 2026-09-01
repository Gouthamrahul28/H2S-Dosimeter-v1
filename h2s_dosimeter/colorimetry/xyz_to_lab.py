"""CIE 1976 CIELAB (L*, a*, b*) color space conversion.

Conforms to CIE 015:2018 / ISO 11664-4:2019.
Transforms CIE XYZ tristimulus values to perceptual CIELAB coordinates
using exact standard piecewise cubic equations and explicit reference white point.
"""

from typing import Dict, Tuple, Union
import numpy as np

# Standard D65 2-degree reference white point [Xn, Yn, Zn]
WHITE_POINT_D65 = np.array([0.95047, 1.00000, 1.08883], dtype=np.float64)

# CIE standard threshold constants
CIE_DELTA = 6.0 / 29.0
CIE_DELTA_CUBED = CIE_DELTA ** 3.0  # ≈ 0.008856
CIE_FACTOR = 1.0 / (3.0 * (CIE_DELTA ** 2.0))  # ≈ 7.787
CIE_OFFSET = 4.0 / 29.0  # ≈ 0.13793


def _f_cie(t: np.ndarray) -> np.ndarray:
    """Standard piecewise CIE transformation function f(t)."""
    return np.where(
        t > CIE_DELTA_CUBED,
        np.cbrt(np.maximum(1e-12, t)),
        CIE_FACTOR * t + CIE_OFFSET
    )


def _f_inv_cie(t: np.ndarray) -> np.ndarray:
    """Inverse standard piecewise CIE transformation function f^-1(t)."""
    return np.where(
        t > CIE_DELTA,
        np.power(t, 3.0),
        3.0 * (CIE_DELTA ** 2.0) * (t - CIE_OFFSET)
    )


def xyz_to_lab(
    xyz: Union[np.ndarray, list, tuple],
    white_point: Union[np.ndarray, list, tuple] = WHITE_POINT_D65
) -> np.ndarray:
    """Converts CIE XYZ tristimulus values to CIE 1976 CIELAB (L*, a*, b*).

    Args:
        xyz: Array-like CIE XYZ values of shape (3,) or (N, 3).
        white_point: Explicit reference white point [Xn, Yn, Zn] (defaults to D65).

    Returns:
        np.ndarray: CIELAB array with L* in [0, 100], a* in [-128, +127], b* in [-128, +127].
    """
    xyz_arr = np.asarray(xyz, dtype=np.float64)
    wn = np.asarray(white_point, dtype=np.float64)

    if wn.shape != (3,):
        raise ValueError(f"white_point must have shape (3,), got {wn.shape}")

    wn = np.maximum(wn, 1e-6)

    if xyz_arr.ndim == 1:
        if xyz_arr.shape[0] != 3:
            raise ValueError(f"xyz must contain 3 elements, got {xyz_arr.shape}")
        x_r = xyz_arr[0] / wn[0]
        y_r = xyz_arr[1] / wn[1]
        z_r = xyz_arr[2] / wn[2]

        fx = _f_cie(x_r)
        fy = _f_cie(y_r)
        fz = _f_cie(z_r)

        L = 116.0 * fy - 16.0
        a = 500.0 * (fx - fy)
        b = 200.0 * (fy - fz)

        return np.array([np.clip(L, 0.0, 100.0), a, b], dtype=np.float64)

    elif xyz_arr.ndim == 2:
        if xyz_arr.shape[1] != 3:
            raise ValueError(f"xyz must have shape (N, 3), got {xyz_arr.shape}")
        x_r = xyz_arr[:, 0] / wn[0]
        y_r = xyz_arr[:, 1] / wn[1]
        z_r = xyz_arr[:, 2] / wn[2]

        fx = _f_cie(x_r)
        fy = _f_cie(y_r)
        fz = _f_cie(z_r)

        L = 116.0 * fy - 16.0
        a = 500.0 * (fx - fy)
        b = 200.0 * (fy - fz)

        return np.column_stack([np.clip(L, 0.0, 100.0), a, b])

    else:
        raise ValueError(f"Unsupported array dimensions {xyz_arr.ndim}")


def lab_to_xyz(
    lab: Union[np.ndarray, list, tuple],
    white_point: Union[np.ndarray, list, tuple] = WHITE_POINT_D65
) -> np.ndarray:
    """Converts CIE 1976 CIELAB (L*, a*, b*) back to CIE XYZ.

    Args:
        lab: Array-like CIELAB values [L*, a*, b*].
        white_point: Explicit reference white point [Xn, Yn, Zn].

    Returns:
        np.ndarray: CIE XYZ tristimulus array.
    """
    lab_arr = np.asarray(lab, dtype=np.float64)
    wn = np.asarray(white_point, dtype=np.float64)

    if lab_arr.ndim == 1:
        L, a, b = lab_arr[0], lab_arr[1], lab_arr[2]
        fy = (L + 16.0) / 116.0
        fx = a / 500.0 + fy
        fz = fy - b / 200.0

        x = _f_inv_cie(fx) * wn[0]
        y = _f_inv_cie(fy) * wn[1]
        z = _f_inv_cie(fz) * wn[2]

        return np.maximum(0.0, np.array([x, y, z], dtype=np.float64))
    else:
        L = lab_arr[:, 0]
        a = lab_arr[:, 1]
        b = lab_arr[:, 2]

        fy = (L + 16.0) / 116.0
        fx = a / 500.0 + fy
        fz = fy - b / 200.0

        x = _f_inv_cie(fx) * wn[0]
        y = _f_inv_cie(fy) * wn[1]
        z = _f_inv_cie(fz) * wn[2]

        return np.maximum(0.0, np.column_stack([x, y, z]))
