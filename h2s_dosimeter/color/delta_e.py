"""
h2s_dosimeter.color.delta_e
===========================
Standard CIEDE2000 (ΔE00) Total Color Difference Metric implementation
conforming strictly to CIE Technical Report 142-2001 and ISO/CIE 11664-6:2014.

REFERENCE:
G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference Formula:
Implementation Notes, Supplementary Test Data, and Mathematical Observations,"
Color Research & Application, vol. 30, no. 1, pp. 21-30, Feb. 2005.

WHY CIEDE2000 INSTEAD OF EUCLIDEAN RGB:
RGB color space is non-uniform: Euclidean distance in RGB severely distorts perceptual
chemical changes (e.g., small shifts in dark greys/browns have massive perceptual and
dosimetric meaning). CIEDE2000 corrects for luminance non-linearity, chroma-dependent
weighting, hue rotation in the blue region, and neutral gray/dark saturation interactions.
"""

from typing import Union
import numpy as np


def ciede2000(
    lab1: Union[np.ndarray, list, tuple],
    lab2: Union[np.ndarray, list, tuple],
    k_l: float = 1.0,
    k_c: float = 1.0,
    k_h: float = 1.0
) -> Union[float, np.ndarray]:
    """
    Calculate CIEDE2000 (ΔE00) color difference between two CIELAB colors (or arrays of colors).
    
    Args:
        lab1: Standard reference sample [L1*, a1*, b1*].
        lab2: Measured test sample [L2*, a2*, b2*].
        k_l: Parametric lightness weighting factor (default 1.0).
        k_c: Parametric chroma weighting factor (default 1.0).
        k_h: Parametric hue weighting factor (default 1.0).
        
    Returns:
        float or np.ndarray: CIEDE2000 color difference ΔE00.
    """
    arr1 = np.asarray(lab1, dtype=np.float64)
    arr2 = np.asarray(lab2, dtype=np.float64)
    
    is_scalar = (arr1.ndim == 1 and arr2.ndim == 1)
    
    l1, a1, b1 = arr1[..., 0], arr1[..., 1], arr1[..., 2]
    l2, a2, b2 = arr2[..., 0], arr2[..., 1], arr2[..., 2]
    
    # Step 1: Calculate C*ab and mean C*ab
    c1_ab = np.hypot(a1, b1)
    c2_ab = np.hypot(a2, b2)
    c_bar_ab = (c1_ab + c2_ab) / 2.0
    
    c_bar_ab_7 = np.power(c_bar_ab, 7.0)
    g = 0.5 * (1.0 - np.sqrt(c_bar_ab_7 / (c_bar_ab_7 + 25.0**7 + 1e-15)))
    
    a1_prime = (1.0 + g) * a1
    a2_prime = (1.0 + g) * a2
    
    c1_prime = np.hypot(a1_prime, b1)
    c2_prime = np.hypot(a2_prime, b2)
    
    # Calculate hue angles in degrees [0, 360)
    h1_prime = np.degrees(np.arctan2(b1, a1_prime)) % 360.0
    h2_prime = np.degrees(np.arctan2(b2, a2_prime)) % 360.0
    
    # Step 2: Calculate ΔL', ΔC', ΔH'
    delta_l_prime = l2 - l1
    delta_c_prime = c2_prime - c1_prime
    
    # Hue difference Δh' calculation
    # When either chroma is zero, hue difference is zero
    diff_h = h2_prime - h1_prime
    abs_diff_h = np.abs(diff_h)
    
    delta_h_prime = np.where(
        (c1_prime * c2_prime) == 0.0,
        0.0,
        np.where(
            abs_diff_h <= 180.0,
            diff_h,
            np.where(
                h2_prime <= h1_prime,
                diff_h + 360.0,
                diff_h - 360.0
            )
        )
    )
    
    delta_h_big = 2.0 * np.sqrt(c1_prime * c2_prime) * np.sin(np.radians(delta_h_prime / 2.0))
    
    # Step 3: Calculate CIEDE2000 Mean Terms
    l_bar_prime = (l1 + l2) / 2.0
    c_bar_prime = (c1_prime + c2_prime) / 2.0
    
    # Mean hue angle h_bar_prime
    sum_h = h1_prime + h2_prime
    h_bar_prime = np.where(
        (c1_prime * c2_prime) == 0.0,
        sum_h,
        np.where(
            abs_diff_h <= 180.0,
            sum_h / 2.0,
            np.where(
                sum_h < 360.0,
                (sum_h + 360.0) / 2.0,
                (sum_h - 360.0) / 2.0
            )
        )
    )
    
    # Step 4: Weighting functions T, SL, SC, SH, RT
    t = (
        1.0
        - 0.17 * np.cos(np.radians(h_bar_prime - 30.0))
        + 0.24 * np.cos(np.radians(2.0 * h_bar_prime))
        + 0.32 * np.cos(np.radians(3.0 * h_bar_prime + 6.0))
        - 0.20 * np.cos(np.radians(4.0 * h_bar_prime - 63.0))
    )
    
    l_diff_sq = (l_bar_prime - 50.0) ** 2
    s_l = 1.0 + (0.015 * l_diff_sq) / np.sqrt(20.0 + l_diff_sq)
    s_c = 1.0 + 0.045 * c_bar_prime
    s_h = 1.0 + 0.015 * c_bar_prime * t
    
    # Hue rotation interaction term RT
    delta_theta = 30.0 * np.exp(-((h_bar_prime - 275.0) / 25.0) ** 2)
    c_bar_prime_7 = np.power(c_bar_prime, 7.0)
    r_c = 2.0 * np.sqrt(c_bar_prime_7 / (c_bar_prime_7 + 25.0**7 + 1e-15))
    r_t = -np.sin(np.radians(2.0 * delta_theta)) * r_c
    
    # Step 5: Total color difference ΔE00
    term_l = delta_l_prime / (k_l * s_l)
    term_c = delta_c_prime / (k_c * s_c)
    term_h = delta_h_big / (k_h * s_h)
    
    delta_e_sq = (term_l ** 2) + (term_c ** 2) + (term_h ** 2) + (r_t * term_c * term_h)
    delta_e = np.sqrt(np.maximum(0.0, delta_e_sq))
    
    if is_scalar:
        return float(delta_e)
    return delta_e
