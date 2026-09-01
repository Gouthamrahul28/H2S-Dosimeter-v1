"""
h2s_dosimeter.color
===================
Colorimetric transformations:
- sRGB <-> Linear RGB decoding/encoding
- Linear RGB -> XYZ via Camera Color Correction Matrix (CCM)
- Bradford Chromatic Adaptation Transform (CAT)
- XYZ -> CIELAB (L*, a*, b*)
- CIEDE2000 (ΔE00) perceptual color difference
"""

from .linear_rgb import srgb_to_linear, linear_to_srgb, normalize_8bit_to_unit
from .rgb_xyz import linear_rgb_to_xyz, xyz_to_linear_rgb, DEFAULT_SRGB_TO_XYZ_MATRIX
from .bradford import bradford_adaptation, get_bradford_cat_matrix, D65_WHITE_POINT, D50_WHITE_POINT
from .lab import xyz_to_lab, lab_to_xyz
from .delta_e import ciede2000

__all__ = [
    "srgb_to_linear",
    "linear_to_srgb",
    "normalize_8bit_to_unit",
    "linear_rgb_to_xyz",
    "xyz_to_linear_rgb",
    "DEFAULT_SRGB_TO_XYZ_MATRIX",
    "bradford_adaptation",
    "get_bradford_cat_matrix",
    "D65_WHITE_POINT",
    "D50_WHITE_POINT",
    "xyz_to_lab",
    "lab_to_xyz",
    "ciede2000",
]
