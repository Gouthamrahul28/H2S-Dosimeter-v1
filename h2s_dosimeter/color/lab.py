"""
h2s_dosimeter.color.lab
=======================
Standard CIE 1976 L*a*b* (CIELAB) color space transformations with explicit,
configurable reference white point (defaulting to Standard CIE Illuminant D65).

EQUATIONS (CIE 1976 / ISO 11664-4):
  xr = X / Xn
  yr = Y / Yn
  zr = Z / Zn

  f(t) = t^(1/3)                         if t > (6/29)^3  (~0.008856)
       = (1/3)*(29/6)^2 * t + 4/29       otherwise        (~7.787*t + 16/116)

  L* = 116 * f(yr) - 16
  a* = 500 * [f(xr) - f(yr)]
  b* = 200 * [f(yr) - f(zr)]
"""

from typing import Union
import numpy as np
from .bradford import D65_WHITE_POINT

# CIE Standard Threshold Constants (exact fractional forms)
# δ = 6/29 ≈ 0.20689655172413793
# δ³ = (6/29)³ = 216/24389 ≈ 0.008856451679035631
# (1/3)*(29/6)² = 841/108 ≈ 7.787037037037037
# 4/29 = 16/116 ≈ 0.13793103448275862
DELTA_CUBE = 216.0 / 24389.0
KAPPA = 841.0 / 108.0
OFFSET = 4.0 / 29.0


def _cie_f(t: np.ndarray) -> np.ndarray:
    """Standard piecewise CIE transformation function f(t)."""
    return np.where(
        t > DELTA_CUBE,
        np.cbrt(np.maximum(t, 0.0)),
        KAPPA * t + OFFSET
    )


def _cie_f_inv(ft: np.ndarray) -> np.ndarray:
    """Inverse of the standard piecewise CIE transformation function f^(-1)(t)."""
    delta = 6.0 / 29.0
    return np.where(
        ft > delta,
        np.power(ft, 3.0),
        (ft - OFFSET) / KAPPA
    )


def xyz_to_lab(
    xyz: Union[np.ndarray, list, tuple],
    white_point: Union[np.ndarray, list, tuple] = D65_WHITE_POINT
) -> np.ndarray:
    """
    Convert CIE 1931 XYZ coordinates to CIE 1976 L*a*b* (CIELAB).
    
    Args:
        xyz: CIE XYZ values of shape (3,), (N, 3), or (H, W, 3).
             Assumed normalized such that reference white Y=1.0. If XYZ is scaled to Y=100,
             the white_point should also be scaled accordingly.
        white_point: Reference white [Xn, Yn, Zn] (default D65: [0.95047, 1.0, 1.08883]).
        
    Returns:
        np.ndarray: CIELAB coordinates [L*, a*, b*] with L* in [0, 100], a* in [-128, 127], b* in [-128, 127].
    """
    arr = np.asarray(xyz, dtype=np.float64)
    wn = np.asarray(white_point, dtype=np.float64).flatten()
    
    if wn.shape[0] != 3:
        raise ValueError(f"White point must have 3 components, got {wn.shape}")
        
    # Relative tristimulus ratios xr = X/Xn, yr = Y/Yn, zr = Z/Zn
    if arr.ndim == 1:
        xr = arr[0] / wn[0]
        yr = arr[1] / wn[1]
        zr = arr[2] / wn[2]
        
        fx = _cie_f(np.array(xr))
        fy = _cie_f(np.array(yr))
        fz = _cie_f(np.array(zr))
        
        l_star = 116.0 * fy - 16.0
        a_star = 500.0 * (fx - fy)
        b_star = 200.0 * (fy - fz)
        
        return np.array([float(l_star), float(a_star), float(b_star)], dtype=np.float64)
    else:
        xr = arr[..., 0] / wn[0]
        yr = arr[..., 1] / wn[1]
        zr = arr[..., 2] / wn[2]
        
        fx = _cie_f(xr)
        fy = _cie_f(yr)
        fz = _cie_f(zr)
        
        l_star = 116.0 * fy - 16.0
        a_star = 500.0 * (fx - fy)
        b_star = 200.0 * (fy - fz)
        
        return np.stack([l_star, a_star, b_star], axis=-1)


def lab_to_xyz(
    lab: Union[np.ndarray, list, tuple],
    white_point: Union[np.ndarray, list, tuple] = D65_WHITE_POINT
) -> np.ndarray:
    """
    Convert CIE 1976 L*a*b* coordinates back to CIE 1931 XYZ.
    
    Args:
        lab: CIELAB array of shape (3,), (N, 3), or (H, W, 3).
        white_point: Reference white [Xn, Yn, Zn] (default D65).
        
    Returns:
        np.ndarray: CIE XYZ coordinates.
    """
    arr = np.asarray(lab, dtype=np.float64)
    wn = np.asarray(white_point, dtype=np.float64).flatten()
    
    l_star = arr[..., 0]
    a_star = arr[..., 1]
    b_star = arr[..., 2]
    
    fy = (l_star + 16.0) / 116.0
    fx = a_star / 500.0 + fy
    fz = fy - b_star / 200.0
    
    xr = _cie_f_inv(fx)
    yr = _cie_f_inv(fy)
    zr = _cie_f_inv(fz)
    
    x = xr * wn[0]
    y = yr * wn[1]
    z = zr * wn[2]
    
    if arr.ndim == 1:
        return np.array([float(x), float(y), float(z)], dtype=np.float64)
    return np.stack([x, y, z], axis=-1)
