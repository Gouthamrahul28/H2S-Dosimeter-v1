"""
h2s_dosimeter.color.linear_rgb
==============================
Inverse-gamma and forward-gamma transformations between non-linear sRGB
and radiometric Linear RGB color spaces (IEC 61966-2-1:1999 standard).

NOTE ON SENSOR PHYSICS & RAW DATA:
Standard smartphone JPEG images undergo non-linear gamma companding, white balancing,
and tone-mapping in the Image Signal Processor (ISP). Applying inverse sRGB gamma is
the standard photometric decoding approximation for processed sRGB images.
For production hardware, linear RAW Bayer CFA data directly from the camera sensor
bypassing non-linear ISP tone-curves is preferred and natively supported by this pipeline.
"""

from typing import Union
import numpy as np


def normalize_8bit_to_unit(rgb_8bit: Union[np.ndarray, list, tuple]) -> np.ndarray:
    """
    Convert 8-bit RGB values [0, 255] to normalized floating point [0.0, 1.0].
    
    Args:
        rgb_8bit: Array-like object of shape (..., 3) or scalar.
        
    Returns:
        np.ndarray: Floating point array in range [0.0, 1.0].
    """
    arr = np.asarray(rgb_8bit, dtype=np.float64)
    return np.clip(arr / 255.0, 0.0, 1.0)


def unit_to_8bit(rgb_unit: Union[np.ndarray, list, tuple]) -> np.ndarray:
    """
    Convert normalized floating point RGB [0.0, 1.0] to 8-bit integers [0, 255].
    
    Args:
        rgb_unit: Array-like object with values in [0.0, 1.0].
        
    Returns:
        np.ndarray: Integer array clamped to [0, 255], uint8.
    """
    arr = np.asarray(rgb_unit, dtype=np.float64)
    return np.clip(np.round(arr * 255.0), 0, 255).astype(np.uint8)


def srgb_to_linear(srgb: Union[np.ndarray, list, tuple, float]) -> np.ndarray:
    """
    Decode non-linear sRGB values to Linear RGB (inverse sRGB gamma transformation).
    
    Piecewise definition (IEC 61966-2-1):
        if C <= 0.04045:
            C_linear = C / 12.92
        else:
            C_linear = ((C + 0.055) / 1.055) ** 2.4
            
    Args:
        srgb: Non-linear sRGB values in [0.0, 1.0]. If values are in [0, 255],
              pass through normalize_8bit_to_unit first.
              
    Returns:
        np.ndarray: Linearized RGB values in range [0.0, 1.0].
    """
    arr = np.asarray(srgb, dtype=np.float64)
    # Ensure inputs are clamped to [0.0, 1.0] to avoid complex numbers with negative bases
    arr = np.clip(arr, 0.0, 1.0)
    
    linear = np.where(
        arr <= 0.04045,
        arr / 12.92,
        np.power((arr + 0.055) / 1.055, 2.4)
    )
    return np.clip(linear, 0.0, 1.0)


def linear_to_srgb(linear_rgb: Union[np.ndarray, list, tuple, float]) -> np.ndarray:
    """
    Encode Linear RGB values to non-linear sRGB (forward sRGB gamma transformation).
    
    Piecewise definition (IEC 61966-2-1):
        if C_linear <= 0.0031308:
            C = 12.92 * C_linear
        else:
            C = 1.055 * (C_linear ** (1.0 / 2.4)) - 0.055
            
    Args:
        linear_rgb: Linear RGB values in range [0.0, 1.0].
        
    Returns:
        np.ndarray: Non-linear sRGB values in range [0.0, 1.0].
    """
    arr = np.asarray(linear_rgb, dtype=np.float64)
    arr = np.clip(arr, 0.0, 1.0)
    
    srgb = np.where(
        arr <= 0.0031308,
        arr * 12.92,
        1.055 * np.power(arr, 1.0 / 2.4) - 0.055
    )
    return np.clip(srgb, 0.0, 1.0)
