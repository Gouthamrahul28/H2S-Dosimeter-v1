"""ISO/CIE 11664-6:2022 / CIE 142-2001 CIEDE2000 Color Difference Formula.

Calculates perceptual color difference ΔE_00 between two CIELAB coordinates
with lightness, chroma, and hue weighting functions (k_L=1, k_C=1, k_H=1),
neutral chroma rotation term R_T, and arithmetic mean hue angle logic.

Conforms strictly to standard published test vectors (Sharma, Wu, Dalal 2005).
"""

from typing import Union
import numpy as np


def ciede2000(
    lab1: Union[np.ndarray, list, tuple],
    lab2: Union[np.ndarray, list, tuple],
    k_L: float = 1.0,
    k_C: float = 1.0,
    k_H: float = 1.0
) -> float:
    """Calculates ISO/CIE 11664-6:2022 CIEDE2000 total color difference ΔE_00.

    Args:
        lab1: First CIELAB color [L1*, a1*, b1*] (Reference/Standard).
        lab2: Second CIELAB color [L2*, a2*, b2*] (Sample/Batch).
        k_L: Lightness parametric weighting factor (default 1.0 for industrial evaluation).
        k_C: Chroma parametric weighting factor (default 1.0).
        k_H: Hue parametric weighting factor (default 1.0).

    Returns:
        float: Scalar perceptual color difference ΔE_00.
    """
    L1, a1, b1 = float(lab1[0]), float(lab1[1]), float(lab1[2])
    L2, a2, b2 = float(lab2[0]), float(lab2[1]), float(lab2[2])

    # 1. Calculate C_i and mean chroma C_bar
    C1 = np.hypot(a1, b1)
    C2 = np.hypot(a2, b2)
    C_bar = (C1 + C2) / 2.0

    # 2. Compute G factor for neutral chroma expansion
    C_bar7 = C_bar ** 7.0
    G = 0.5 * (1.0 - np.sqrt(C_bar7 / (C_bar7 + 25.0 ** 7.0 + 1e-18)))

    # 3. Transformed a' and C'
    a1_prime = (1.0 + G) * a1
    a2_prime = (1.0 + G) * a2
    C1_prime = np.hypot(a1_prime, b1)
    C2_prime = np.hypot(a2_prime, b2)

    # 4. Transformed hue angles h' in degrees [0, 360)
    h1_prime = np.degrees(np.arctan2(b1, a1_prime)) % 360.0
    h2_prime = np.degrees(np.arctan2(b2, a2_prime)) % 360.0

    # 5. Delta terms: ΔL', ΔC', ΔH'
    delta_L_prime = L2 - L1
    delta_C_prime = C2_prime - C1_prime

    # Compute Δh' with circular wrap-around
    if C1_prime * C2_prime == 0.0:
        delta_h_prime = 0.0
    elif np.abs(h2_prime - h1_prime) <= 180.0:
        delta_h_prime = h2_prime - h1_prime
    elif h2_prime - h1_prime > 180.0:
        delta_h_prime = (h2_prime - h1_prime) - 360.0
    else:
        delta_h_prime = (h2_prime - h1_prime) + 360.0

    delta_H_prime = 2.0 * np.sqrt(C1_prime * C2_prime) * np.sin(np.radians(delta_h_prime / 2.0))

    # 6. Mean values: L_bar', C_bar', h_bar'
    L_bar_prime = (L1 + L2) / 2.0
    C_bar_prime = (C1_prime + C2_prime) / 2.0

    if C1_prime * C2_prime == 0.0:
        h_bar_prime = h1_prime + h2_prime
    elif np.abs(h1_prime - h2_prime) <= 180.0:
        h_bar_prime = (h1_prime + h2_prime) / 2.0
    elif (h1_prime + h2_prime) < 360.0:
        h_bar_prime = (h1_prime + h2_prime + 360.0) / 2.0
    else:
        h_bar_prime = (h1_prime + h2_prime - 360.0) / 2.0

    # 7. Weighting functions: S_L, S_C, S_H
    T = (
        1.0
        - 0.17 * np.cos(np.radians(h_bar_prime - 30.0))
        + 0.24 * np.cos(np.radians(2.0 * h_bar_prime))
        + 0.32 * np.cos(np.radians(3.0 * h_bar_prime + 6.0))
        - 0.20 * np.cos(np.radians(4.0 * h_bar_prime - 63.0))
    )

    L_bar_minus_50_sq = (L_bar_prime - 50.0) ** 2.0
    S_L = 1.0 + (0.015 * L_bar_minus_50_sq) / np.sqrt(20.0 + L_bar_minus_50_sq)
    S_C = 1.0 + 0.045 * C_bar_prime
    S_H = 1.0 + 0.015 * C_bar_prime * T

    # 8. Rotation term R_T for blue/violet interaction
    delta_theta = 30.0 * np.exp(-(((h_bar_prime - 275.0) / 25.0) ** 2.0))
    C_bar_prime7 = C_bar_prime ** 7.0
    R_C = 2.0 * np.sqrt(C_bar_prime7 / (C_bar_prime7 + 25.0 ** 7.0 + 1e-18))
    R_T = -R_C * np.sin(np.radians(2.0 * delta_theta))

    # 9. Total color difference ΔE_00
    term_L = delta_L_prime / (k_L * S_L)
    term_C = delta_C_prime / (k_C * S_C)
    term_H = delta_H_prime / (k_H * S_H)

    delta_E00 = np.sqrt(
        term_L ** 2.0
        + term_C ** 2.0
        + term_H ** 2.0
        + R_T * term_C * term_H
    )

    return float(delta_E00)
