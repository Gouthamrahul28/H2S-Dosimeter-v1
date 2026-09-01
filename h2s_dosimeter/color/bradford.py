"""
h2s_dosimeter.color.bradford
============================
Chromatic Adaptation Transforms (CAT) using the Bradford cone response model
(and optional Von Kries model) to map colors from the illumination state of the
measured scene (source white point) to a standard reference white point (default D65).

THEORY:
The human visual system adapts to ambient illumination color temperature.
A camera sensor records raw radiance. By measuring a known physical white reference
patch in the exact same frame as the chemical strip, the source white point W_src
is captured. Bradford adaptation maps the measured XYZ under W_src to canonical XYZ
under W_ref (D65 daylight, 6504K), canceling out variations from warm sodium lamps (2700K),
fluorescents (4000K), or overcast sky (7500K).
"""

from typing import Optional, Tuple, Union
import numpy as np

# Standard CIE Illuminant D65 (2° standard observer, normalized Y=1.0)
D65_WHITE_POINT = np.array([0.95047, 1.00000, 1.08883], dtype=np.float64)

# Standard CIE Illuminant D50 (2° standard observer, normalized Y=1.0)
D50_WHITE_POINT = np.array([0.96422, 1.00000, 0.82521], dtype=np.float64)

# Standard Bradford cone response transformation matrix
M_BRADFORD = np.array([
    [ 0.8951,  0.2664, -0.1614],
    [-0.7502,  1.7135,  0.0367],
    [ 0.0389, -0.0685,  1.0296]
], dtype=np.float64)

# Inverse Bradford matrix (precomputed for optimal performance and numerical precision)
M_BRADFORD_INV = np.linalg.inv(M_BRADFORD)

# Von Kries sensor response matrix (direct XYZ space)
M_VON_KRIES = np.eye(3, dtype=np.float64)
M_VON_KRIES_INV = np.eye(3, dtype=np.float64)

# Numerical singularity epsilon
EPSILON = 1e-7


def get_bradford_cat_matrix(
    src_white: Union[np.ndarray, list, tuple],
    ref_white: Union[np.ndarray, list, tuple] = D65_WHITE_POINT,
    method: str = "bradford"
) -> np.ndarray:
    """
    Compute 3x3 Chromatic Adaptation Transform (CAT) matrix.
    
    Args:
        src_white: Source white point [X, Y, Z] estimated from white reference patch.
        ref_white: Target reference white point [X, Y, Z] (default D65).
        method: CAT model - 'bradford' (recommended) or 'von_kries'.
        
    Returns:
        np.ndarray: 3x3 adaptation matrix M_CAT such that XYZ_adapted = M_CAT @ XYZ_src.
    """
    w_src = np.asarray(src_white, dtype=np.float64).flatten()
    w_ref = np.asarray(ref_white, dtype=np.float64).flatten()
    
    if w_src.shape[0] != 3 or w_ref.shape[0] != 3:
        raise ValueError(f"White points must be 3-element vectors [X, Y, Z], got {w_src.shape} and {w_ref.shape}")
        
    # Guard against invalid or near-zero white point coordinates
    w_src = np.maximum(w_src, EPSILON)
    w_ref = np.maximum(w_ref, EPSILON)
    
    # Normalize Y to 1.0 if not already normalized (scale invariant for ratios)
    if w_src[1] > 0:
        w_src = w_src / w_src[1]
    if w_ref[1] > 0:
        w_ref = w_ref / w_ref[1]
        
    if method.lower() == "von_kries":
        m_cone = M_VON_KRIES
        m_cone_inv = M_VON_KRIES_INV
    else:
        m_cone = M_BRADFORD
        m_cone_inv = M_BRADFORD_INV
        
    # Project white points into cone response space (LMS / ρ, γ, β)
    lms_src = m_cone @ w_src
    lms_ref = m_cone @ w_ref
    
    # Prevent divide-by-zero with numerical threshold
    lms_src = np.where(np.abs(lms_src) < EPSILON, np.sign(lms_src) * EPSILON + (lms_src == 0) * EPSILON, lms_src)
    
    # Diagonal scaling matrix D
    gain = lms_ref / lms_src
    d_diag = np.diag(gain)
    
    # Complete CAT matrix: inv(M) @ D @ M
    m_cat = m_cone_inv @ d_diag @ m_cone
    return m_cat


def bradford_adaptation(
    xyz_camera: Union[np.ndarray, list, tuple],
    src_white: Union[np.ndarray, list, tuple],
    ref_white: Union[np.ndarray, list, tuple] = D65_WHITE_POINT,
    method: str = "bradford"
) -> np.ndarray:
    """
    Adapt camera XYZ coordinates from measured source white to reference white.
    
    Formula:
        XYZ_adapted = inv(M_Bradford) @ diag(LMS_ref / LMS_src) @ M_Bradford @ XYZ_camera
        
    Args:
        xyz_camera: XYZ coordinates of strip or scene (shape (3,), (N, 3), or (H, W, 3)).
        src_white: Measured source white [X, Y, Z] from white reference ROI.
        ref_white: Standard reference white [X, Y, Z] (default D65: [0.95047, 1.0, 1.08883]).
        method: 'bradford' (default) or 'von_kries'.
        
    Returns:
        np.ndarray: Chromatically adapted XYZ coordinates.
    """
    m_cat = get_bradford_cat_matrix(src_white=src_white, ref_white=ref_white, method=method)
    arr = np.asarray(xyz_camera, dtype=np.float64)
    
    if arr.ndim == 1 and arr.shape[0] == 3:
        return m_cat @ arr
    else:
        return np.einsum('...i,ji->...j', arr, m_cat.T)
