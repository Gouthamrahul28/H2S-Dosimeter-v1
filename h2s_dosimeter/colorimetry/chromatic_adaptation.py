"""Bradford Chromatic Adaptation Transform (CAT).

Conforms to CIE 015:2018 / ISO 17321-2:2012.
Transforms CIE XYZ tristimulus values from a source illuminant white point W_src
to a reference illuminant white point W_ref (e.g. D65).

Important:
    Chromatic adaptation is an OPTIONAL stage in this pipeline.
    It is applied only when the physical capture illuminant differs from the
    calibration reference illuminant (W_src != W_ref).
    It does not replace device-specific camera characterization (CCM).
"""

from typing import Optional, Union
import numpy as np

# Standard Bradford cone response matrix
M_BRADFORD = np.array([
    [0.8951, 0.2664, -0.1614],
    [-0.7502, 1.7135, 0.0367],
    [0.0389, -0.0685, 1.0296]
], dtype=np.float64)

M_BRADFORD_INV = np.linalg.inv(M_BRADFORD)

# Standard CIE Illuminant White Points [Xn, Yn, Zn] (normalized Yn = 1.0)
ILLUMINANTS = {
    "D65": np.array([0.95047, 1.00000, 1.08883], dtype=np.float64),
    "D50": np.array([0.96422, 1.00000, 0.82521], dtype=np.float64),
    "A": np.array([1.09850, 1.00000, 0.35585], dtype=np.float64),
    "E": np.array([1.00000, 1.00000, 1.00000], dtype=np.float64),
    "LED_5000K": np.array([0.96420, 1.00000, 0.82500], dtype=np.float64)
}


def bradford_adaptation(
    xyz: Union[np.ndarray, list, tuple],
    white_source: Union[np.ndarray, list, tuple, str],
    white_target: Union[np.ndarray, list, tuple, str] = "D65",
    threshold: float = 1e-4
) -> np.ndarray:
    """Applies Bradford chromatic adaptation to map XYZ from white_source to white_target.

    Args:
        xyz: CIE XYZ array of shape (3,) or (N, 3).
        white_source: Source illuminant XYZ [X, Y, Z] or illuminant name key (e.g. 'D50').
        white_target: Target illuminant XYZ [X, Y, Z] or illuminant name key (defaults to 'D65').
        threshold: Euclidean distance threshold below which white points are considered identical.

    Returns:
        np.ndarray: Chromatically adapted CIE XYZ tristimulus values.
    """
    xyz_arr = np.asarray(xyz, dtype=np.float64)

    # Resolve white point vectors
    w_src = ILLUMINANTS.get(white_source, white_source) if isinstance(white_source, str) else np.asarray(white_source, dtype=np.float64)
    w_tgt = ILLUMINANTS.get(white_target, white_target) if isinstance(white_target, str) else np.asarray(white_target, dtype=np.float64)

    w_src = np.asarray(w_src, dtype=np.float64)
    w_tgt = np.asarray(w_tgt, dtype=np.float64)

    # Numerical safety: avoid adaptation if white points match
    if np.linalg.norm(w_src - w_tgt) < threshold:
        return xyz_arr.copy()

    # Avoid zero division
    w_src = np.maximum(w_src, 1e-6)
    w_tgt = np.maximum(w_tgt, 1e-6)

    # Convert white points to cone response space (LMS)
    lms_src = M_BRADFORD @ w_src
    lms_tgt = M_BRADFORD @ w_tgt

    # Guard against division by near-zero LMS
    lms_src = np.where(np.abs(lms_src) < 1e-6, 1e-6, lms_src)
    lms_gain = lms_tgt / lms_src

    # Compute Bradford adaptation matrix: M_adapt = M_inv @ diag(gain) @ M
    diag_gain = np.diag(lms_gain)
    m_adapt = M_BRADFORD_INV @ diag_gain @ M_BRADFORD

    # Apply adaptation transform
    if xyz_arr.ndim == 1:
        adapted = m_adapt @ xyz_arr
    elif xyz_arr.ndim == 2:
        adapted = (m_adapt @ xyz_arr.T).T
    else:
        raise ValueError(f"Unsupported array dimensions {xyz_arr.ndim}")

    return np.maximum(0.0, adapted)
