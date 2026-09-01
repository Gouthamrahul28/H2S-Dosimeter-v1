"""Linear sRGB decoding and encoding module.

Conforms to IEC 61966-2-1 / CIE 015:2018.
Decodes non-linear gamma-encoded 8-bit sRGB into normalized linear optical radiance
before any colorimetric or camera matrix transformations.
"""

from typing import Union
import numpy as np


def srgb_to_linear(rgb_gamma: Union[np.ndarray, list, tuple]) -> np.ndarray:
    """Decodes non-linear sRGB values [0, 255] or [0.0, 1.0] into linear RGB [0.0, 1.0].

    Formula (IEC 61966-2-1):
        C_lin = C_srgb / 12.92                        if C_srgb <= 0.04045
        C_lin = ((C_srgb + 0.055) / 1.055) ** 2.4     if C_srgb > 0.04045

    Args:
        rgb_gamma: Array-like gamma-encoded RGB values.

    Returns:
        np.ndarray: Linear RGB float array with values in [0.0, 1.0].
    """
    arr = np.asarray(rgb_gamma, dtype=np.float64)

    # Normalize [0, 255] to [0.0, 1.0] if needed
    if np.any(arr > 1.0):
        arr = arr / 255.0

    arr = np.clip(arr, 0.0, 1.0)

    # Piecewise inverse sRGB gamma
    linear = np.where(
        arr <= 0.04045,
        arr / 12.92,
        np.power((arr + 0.055) / 1.055, 2.4)
    )

    return linear


def linear_to_srgb(linear_rgb: Union[np.ndarray, list, tuple], to_255: bool = True) -> np.ndarray:
    """Encodes linear optical RGB [0.0, 1.0] into gamma-compressed sRGB.

    Formula (IEC 61966-2-1):
        C_srgb = 12.92 * C_lin                        if C_lin <= 0.0031308
        C_srgb = 1.055 * (C_lin ** (1/2.4)) - 0.055   if C_lin > 0.0031308

    Args:
        linear_rgb: Array-like linear RGB float values in [0.0, 1.0].
        to_255: If True, scales result to [0, 255] uint8-range.

    Returns:
        np.ndarray: Non-linear sRGB array.
    """
    arr = np.clip(np.asarray(linear_rgb, dtype=np.float64), 0.0, 1.0)

    gamma = np.where(
        arr <= 0.0031308,
        12.92 * arr,
        1.055 * np.power(arr, 1.0 / 2.4) - 0.055
    )

    if to_255:
        return np.clip(np.round(gamma * 255.0), 0, 255).astype(np.float64)
    return gamma
