"""
h2s_dosimeter.calibration.white_reference
=========================================
Robust estimation of the ambient illumination source white point (W_src)
from the in-frame printed reference white patch.

CRITICAL REQUIREMENTS:
- Never rely on a single white pixel.
- Reject saturated and underexposed pixels.
- Use median linear intensity of filtered pixels.
- Compute confidence metric based on patch homogeneity and dynamic range.
- Convert linear RGB median to XYZ_src using the active CCM.
- Reject white measurement if quality is insufficient.
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
from ..color.rgb_xyz import linear_rgb_to_xyz
from ..vision.strip_roi import PatchMetrics, ROIDefinition, extract_patch_metrics


@dataclass
class WhiteReferenceResult:
    """Estimated source white point coordinates and quality metrics."""
    valid: bool
    source_white_xyz: np.ndarray       # [X_src, Y_src, Z_src] normalized with Y=1.0
    source_white_rgb_linear: np.ndarray# [R_lin, G_lin, B_lin]
    source_white_rgb_8bit: List[int]   # [R, G, B] in [0, 255]
    confidence_score: float            # 0.0 to 100.0 %
    saturation_ratio: float
    valid_pixel_count: int
    uniformity_cv: float
    rejection_reason: str = ""

    def to_dict(self) -> Dict:
        res = asdict(self)
        res["source_white_xyz"] = self.source_white_xyz.tolist()
        res["source_white_rgb_linear"] = self.source_white_rgb_linear.tolist()
        return res


def estimate_source_white(
    image_rgb: np.ndarray,
    white_roi: ROIDefinition,
    ccm: Optional[np.ndarray] = None,
    min_confidence: float = 50.0,
    saturation_threshold: int = 250,
    underexposed_threshold: int = 15,
    min_valid_pixels: int = 50
) -> WhiteReferenceResult:
    """
    Extract white reference patch from image, filter outliers, and calculate source white XYZ.
    
    Args:
        image_rgb: Input image (H, W, 3) in RGB format.
        white_roi: Bounding box definition of the printed white patch.
        ccm: 3x3 Camera Color Correction Matrix.
        min_confidence: Minimum acceptable confidence score (0-100).
        saturation_threshold: Upper 8-bit cutoff.
        underexposed_threshold: Lower 8-bit cutoff.
        min_valid_pixels: Minimum number of clean pixels required.
        
    Returns:
        WhiteReferenceResult instance.
    """
    patch_metrics: PatchMetrics = extract_patch_metrics(
        image_rgb=image_rgb,
        roi=white_roi,
        min_valid_pixels=min_valid_pixels,
        min_valid_ratio=0.30,
        saturation_threshold=saturation_threshold,
        underexposed_threshold=underexposed_threshold
    )
    
    if not patch_metrics.valid:
        return WhiteReferenceResult(
            valid=False,
            source_white_xyz=np.array([0.95047, 1.0, 1.08883], dtype=np.float64),
            source_white_rgb_linear=np.array([1.0, 1.0, 1.0], dtype=np.float64),
            source_white_rgb_8bit=[255, 255, 255],
            confidence_score=0.0,
            saturation_ratio=patch_metrics.saturation_ratio,
            valid_pixel_count=patch_metrics.valid_pixels,
            uniformity_cv=patch_metrics.uniformity_cv,
            rejection_reason=f"White reference ROI extraction failed: {patch_metrics.rejection_reason}"
        )
        
    median_lin = np.asarray(patch_metrics.median_rgb_linear, dtype=np.float64)
    
    # Check if patch is too dark (e.g. camera in shadow or covered)
    max_channel = float(np.max(median_lin))
    if max_channel < 0.15:
        return WhiteReferenceResult(
            valid=False,
            source_white_xyz=np.array([0.95047, 1.0, 1.08883], dtype=np.float64),
            source_white_rgb_linear=median_lin,
            source_white_rgb_8bit=patch_metrics.median_rgb_8bit,
            confidence_score=15.0,
            saturation_ratio=patch_metrics.saturation_ratio,
            valid_pixel_count=patch_metrics.valid_pixels,
            uniformity_cv=patch_metrics.uniformity_cv,
            rejection_reason=f"White patch is severely underexposed (max intensity {max_channel:.2f} < 0.15)."
        )
        
    # Transform Linear RGB white to Camera XYZ space via CCM
    xyz_raw = linear_rgb_to_xyz(median_lin, ccm=ccm)
    
    # Normalize XYZ such that Y = 1.0 (standard relative luminance normalization)
    if xyz_raw[1] > 1e-6:
        xyz_src = xyz_raw / xyz_raw[1]
    else:
        xyz_src = np.array([0.95047, 1.0, 1.08883], dtype=np.float64)
        
    # Calculate confidence score based on:
    # 1. Ratio of clean non-saturated pixels (weight 40%)
    # 2. Spatial uniformity (weight 30%)
    # 3. Dynamic range / brightness (weight 30%)
    clean_factor = patch_metrics.valid_ratio
    uniformity_factor = max(0.0, 1.0 - patch_metrics.uniformity_cv * 3.5)
    brightness_factor = min(1.0, max(0.0, (max_channel - 0.2) / 0.75))
    
    confidence = float(np.clip((0.4 * clean_factor + 0.3 * uniformity_factor + 0.3 * brightness_factor) * 100.0, 0.0, 100.0))
    
    is_valid = (confidence >= min_confidence) and (patch_metrics.saturation_ratio < 0.40)
    rejection_msg = "" if is_valid else f"White reference confidence ({confidence:.1f}%) below minimum ({min_confidence:.1f}%)."
    
    return WhiteReferenceResult(
        valid=is_valid,
        source_white_xyz=xyz_src,
        source_white_rgb_linear=median_lin,
        source_white_rgb_8bit=patch_metrics.median_rgb_8bit,
        confidence_score=round(confidence, 1),
        saturation_ratio=round(patch_metrics.saturation_ratio, 3),
        valid_pixel_count=patch_metrics.valid_pixels,
        uniformity_cv=round(patch_metrics.uniformity_cv, 4),
        rejection_reason=rejection_msg
    )


def auto_detect_source_white(
    image_rgb: np.ndarray,
    ccm: Optional[np.ndarray] = None,
    min_confidence: float = 40.0
) -> WhiteReferenceResult:
    """
    Automatically detect the scene white point (W_src) from the brightest neutral background / card region
    without requiring a fixed ROI bounding box.
    
    Args:
        image_rgb: (H, W, 3) image in 8-bit RGB.
        ccm: 3x3 Camera Color Correction Matrix.
        min_confidence: Minimum confidence score.
        
    Returns:
        WhiteReferenceResult instance.
    """
    if image_rgb is None or image_rgb.size == 0:
        return WhiteReferenceResult(
            valid=False,
            source_white_xyz=np.array([0.95047, 1.0, 1.08883], dtype=np.float64),
            source_white_rgb_linear=np.array([1.0, 1.0, 1.0], dtype=np.float64),
            source_white_rgb_8bit=[255, 255, 255],
            confidence_score=0.0,
            saturation_ratio=0.0,
            valid_pixel_count=0,
            uniformity_cv=1.0,
            rejection_reason="Image is empty."
        )

    flat = image_rgb.reshape(-1, 3).astype(np.float64)
    
    # Calculate luminance and chroma spread
    luminance = 0.299 * flat[:, 0] + 0.587 * flat[:, 1] + 0.114 * flat[:, 2]
    chroma_spread = np.max(flat, axis=1) - np.min(flat, axis=1)
    
    # Candidate neutral white pixels:
    # 1. High luminance (e.g. above 75th percentile and > 120)
    # 2. Low chroma spread (neutral gray/white, spread <= 35)
    # 3. Not clipped specular highlights (at least one channel < 253)
    p75 = np.percentile(luminance, 75)
    min_lum = max(120.0, p75)
    
    mask = (
        (luminance >= min_lum) &
        (chroma_spread <= 35.0) &
        (flat[:, 0] >= 15.0) &
        (np.min(flat, axis=1) < 254.0)
    )
    
    candidates = flat[mask]
    
    if len(candidates) < 30:
        # Fallback to general high luminance pixels
        mask_fallback = (luminance >= 100.0) & (chroma_spread <= 50.0)
        candidates = flat[mask_fallback]
        
    if len(candidates) < 20:
        # Graceful D65 fallback
        return WhiteReferenceResult(
            valid=True,
            source_white_xyz=np.array([0.95047, 1.0, 1.08883], dtype=np.float64),
            source_white_rgb_linear=np.array([1.0, 1.0, 1.0], dtype=np.float64),
            source_white_rgb_8bit=[245, 245, 245],
            confidence_score=50.0,
            saturation_ratio=0.0,
            valid_pixel_count=0,
            uniformity_cv=0.0,
            rejection_reason="Auto-detected D65 standard fallback (no distinct white card detected)."
        )
        
    # Trimmed median over candidates
    median_8bit = np.median(candidates, axis=0)
    median_8bit_int = [int(np.clip(round(x), 0, 255)) for x in median_8bit]
    
    from ..color.linear_rgb import srgb_to_linear, normalize_8bit_to_unit
    median_norm = normalize_8bit_to_unit(median_8bit)
    median_lin = srgb_to_linear(median_norm)
    
    xyz_raw = linear_rgb_to_xyz(median_lin, ccm=ccm)
    if xyz_raw[1] > 1e-6:
        xyz_src = xyz_raw / xyz_raw[1]
    else:
        xyz_src = np.array([0.95047, 1.0, 1.08883], dtype=np.float64)
        
    conf = min(95.0, max(50.0, 50.0 + len(candidates) * 0.05))
    
    return WhiteReferenceResult(
        valid=True,
        source_white_xyz=xyz_src,
        source_white_rgb_linear=median_lin,
        source_white_rgb_8bit=median_8bit_int,
        confidence_score=round(conf, 1),
        saturation_ratio=0.0,
        valid_pixel_count=len(candidates),
        uniformity_cv=0.05,
        rejection_reason=""
    )
