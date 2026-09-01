"""
h2s_dosimeter.vision.strip_roi
==============================
Robust Region of Interest (ROI) extraction for:
1. Printed Reference White Patch (spatial reference zone)
2. Active Colorimetric H₂S Chemical Strip (sensing reaction zone)

FEATURES:
- Configurable rectangular bounding boxes (normalized [0.0, 1.0] or absolute pixels)
- Pixel-level saturation rejection (> saturation_threshold)
- Pixel-level underexposure rejection (< underexposure_threshold)
- Specular glare and shadow outlier rejection using robust statistical bounds
- Robust central aggregation (Median and 10% Trimmed Mean per channel)
- Structured for drop-in automatic ArUco/fiducial/segmentation strip detection
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
from ..color.linear_rgb import srgb_to_linear, normalize_8bit_to_unit


@dataclass
class ROIDefinition:
    """
    Rectangular Region of Interest definition.
    
    Coordinates can be normalized ([0.0, 1.0]) or absolute pixel values.
    Box format: [x_min, y_min, x_max, y_max]
    """
    name: str
    x_min: float
    y_min: float
    x_max: float
    y_max: float
    is_normalized: bool = True

    def get_pixel_bounds(self, img_width: int, img_height: int) -> Tuple[int, int, int, int]:
        """Convert ROI coordinates to clamped integer pixel bounds [x1, y1, x2, y2]."""
        if self.is_normalized:
            x1 = int(np.clip(self.x_min * img_width, 0, img_width - 1))
            y1 = int(np.clip(self.y_min * img_height, 0, img_height - 1))
            x2 = int(np.clip(self.x_max * img_width, 1, img_width))
            y2 = int(np.clip(self.y_max * img_height, 1, img_height))
        else:
            x1 = int(np.clip(self.x_min, 0, img_width - 1))
            y1 = int(np.clip(self.y_min, 0, img_height - 1))
            x2 = int(np.clip(self.x_max, 1, img_width))
            y2 = int(np.clip(self.y_max, 1, img_height))
            
        if x2 <= x1:
            x2 = min(img_width, x1 + 1)
        if y2 <= y1:
            y2 = min(img_height, y1 + 1)
            
        return x1, y1, x2, y2


@dataclass
class PatchMetrics:
    """Statistical summary of an extracted optical region."""
    name: str
    valid: bool
    total_pixels: int
    valid_pixels: int
    valid_ratio: float
    saturation_ratio: float
    underexposed_ratio: float
    glare_ratio: float
    median_rgb_8bit: List[int]
    median_rgb_linear: List[float]
    trimmed_mean_rgb_linear: List[float]
    std_rgb_linear: List[float]
    uniformity_cv: float  # Coefficient of variation (sigma / mu)
    rejection_reason: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


def extract_roi_pixels(
    image_rgb: np.ndarray,
    roi: ROIDefinition
) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
    """
    Crop the sub-image for the given ROI.
    
    Args:
        image_rgb: Source image in RGB format (H, W, 3).
        roi: ROIDefinition instance.
        
    Returns:
        Tuple[np.ndarray, Tuple[int, int, int, int]]: (Cropped patch array, (x1, y1, x2, y2))
    """
    h, w = image_rgb.shape[:2]
    x1, y1, x2, y2 = roi.get_pixel_bounds(w, h)
    crop = image_rgb[y1:y2, x1:x2]
    return crop, (x1, y1, x2, y2)


def filter_patch_pixels(
    pixels_8bit: np.ndarray,
    saturation_threshold: int = 250,
    underexposed_threshold: int = 12,
    glare_sigma_multiplier: float = 2.5
) -> Tuple[np.ndarray, Dict[str, float]]:
    """
    Reject saturated, underexposed, and specular glare pixels from an ROI patch.
    
    Args:
        pixels_8bit: 2D array of pixels of shape (N, 3), uint8.
        saturation_threshold: Upper 8-bit cutoff (default 250 / 255 = 0.98).
        underexposed_threshold: Lower 8-bit cutoff (default 12 / 255 = 0.05).
        glare_sigma_multiplier: Outlier threshold in std deviations above mean luminance.
        
    Returns:
        Tuple[np.ndarray, Dict[str, float]]: (Filtered valid pixels array, Filter statistics dict)
    """
    n_total = len(pixels_8bit)
    if n_total == 0:
        return np.empty((0, 3), dtype=np.float64), {
            "total": 0, "valid": 0, "sat_ratio": 0.0, "under_ratio": 0.0, "glare_ratio": 0.0, "valid_ratio": 0.0
        }
        
    # Convert to normalized float [0.0, 1.0]
    pix_norm = pixels_8bit.astype(np.float64) / 255.0
    
    # 1. Saturation Mask (any channel exceeds upper threshold)
    sat_cutoff = saturation_threshold / 255.0
    is_sat = np.any(pix_norm >= sat_cutoff, axis=1)
    n_sat = int(np.sum(is_sat))
    
    # 2. Underexposure Mask (all channels below lower threshold)
    under_cutoff = underexposed_threshold / 255.0
    is_under = np.all(pix_norm <= under_cutoff, axis=1)
    n_under = int(np.sum(is_under))
    
    # 3. Luminance-based specular glare / shadow filter
    # Approximate relative luminance (Rec. 709 coefficients)
    lum = 0.2126 * pix_norm[:, 0] + 0.7152 * pix_norm[:, 1] + 0.0722 * pix_norm[:, 2]
    
    initial_valid = (~is_sat) & (~is_under)
    valid_lum = lum[initial_valid]
    
    is_glare = np.zeros(n_total, dtype=bool)
    if len(valid_lum) > 10:
        mean_l = np.mean(valid_lum)
        std_l = np.std(valid_lum)
        if std_l > 1e-4:
            # Mark top specular outliers as glare
            is_glare = initial_valid & (lum > (mean_l + glare_sigma_multiplier * std_l))
            
    n_glare = int(np.sum(is_glare))
    
    # Final valid pixel mask
    valid_mask = initial_valid & (~is_glare)
    valid_pixels = pix_norm[valid_mask]
    n_valid = len(valid_pixels)
    
    stats = {
        "total": n_total,
        "valid": n_valid,
        "sat_ratio": float(n_sat / n_total),
        "under_ratio": float(n_under / n_total),
        "glare_ratio": float(n_glare / n_total),
        "valid_ratio": float(n_valid / n_total) if n_total > 0 else 0.0
    }
    
    return valid_pixels, stats


def extract_patch_metrics(
    image_rgb: np.ndarray,
    roi: ROIDefinition,
    min_valid_pixels: int = 40,
    min_valid_ratio: float = 0.35,
    saturation_threshold: int = 250,
    underexposed_threshold: int = 12
) -> PatchMetrics:
    """
    Extract robust statistical metrics from an image ROI with comprehensive outlier rejection.
    
    Args:
        image_rgb: Input RGB image (H, W, 3).
        roi: Target ROIDefinition.
        min_valid_pixels: Minimum absolute number of clean pixels required.
        min_valid_ratio: Minimum ratio of clean pixels to total ROI pixels.
        saturation_threshold: Upper 8-bit saturation limit.
        underexposed_threshold: Lower 8-bit underexposure limit.
        
    Returns:
        PatchMetrics: Detailed metrics, median RGB, and validity status.
    """
    crop, bounds = extract_roi_pixels(image_rgb, roi)
    pixels_flat = crop.reshape(-1, 3)
    
    valid_pixels_linear_unit, filter_stats = filter_patch_pixels(
        pixels_flat,
        saturation_threshold=saturation_threshold,
        underexposed_threshold=underexposed_threshold
    )
    
    n_total = filter_stats["total"]
    n_valid = filter_stats["valid"]
    valid_ratio = filter_stats["valid_ratio"]
    
    # Rejection checks
    if n_valid < min_valid_pixels:
        return PatchMetrics(
            name=roi.name,
            valid=False,
            total_pixels=n_total,
            valid_pixels=n_valid,
            valid_ratio=valid_ratio,
            saturation_ratio=filter_stats["sat_ratio"],
            underexposed_ratio=filter_stats["under_ratio"],
            glare_ratio=filter_stats["glare_ratio"],
            median_rgb_8bit=[0, 0, 0],
            median_rgb_linear=[0.0, 0.0, 0.0],
            trimmed_mean_rgb_linear=[0.0, 0.0, 0.0],
            std_rgb_linear=[0.0, 0.0, 0.0],
            uniformity_cv=1.0,
            rejection_reason=f"Insufficient valid pixels ({n_valid} < {min_valid_pixels} min required)."
        )
        
    if valid_ratio < min_valid_ratio:
        return PatchMetrics(
            name=roi.name,
            valid=False,
            total_pixels=n_total,
            valid_pixels=n_valid,
            valid_ratio=valid_ratio,
            saturation_ratio=filter_stats["sat_ratio"],
            underexposed_ratio=filter_stats["under_ratio"],
            glare_ratio=filter_stats["glare_ratio"],
            median_rgb_8bit=[0, 0, 0],
            median_rgb_linear=[0.0, 0.0, 0.0],
            trimmed_mean_rgb_linear=[0.0, 0.0, 0.0],
            std_rgb_linear=[0.0, 0.0, 0.0],
            uniformity_cv=1.0,
            rejection_reason=f"Clean pixel ratio ({valid_ratio:.1%}) below required threshold ({min_valid_ratio:.1%})."
        )
        
    # Convert valid sRGB pixels to linear RGB
    valid_linear = srgb_to_linear(valid_pixels_linear_unit)
    
    # Calculate robust central metrics (Median per channel)
    median_linear = np.median(valid_linear, axis=0)
    std_linear = np.std(valid_linear, axis=0)
    
    # Trimmed mean (10% two-sided trim to exclude remaining border effects)
    low_pct = np.percentile(valid_linear, 10, axis=0)
    high_pct = np.percentile(valid_linear, 90, axis=0)
    mask_trimmed = np.all((valid_linear >= low_pct) & (valid_linear <= high_pct), axis=1)
    if np.sum(mask_trimmed) > 5:
        trimmed_mean_linear = np.mean(valid_linear[mask_trimmed], axis=0)
    else:
        trimmed_mean_linear = np.mean(valid_linear, axis=0)
        
    # Standard 8-bit representation of median
    median_8bit = [int(np.round(np.clip(v * 255.0, 0, 255))) for v in np.median(valid_pixels_linear_unit, axis=0)]
    
    # Spatial Uniformity Coefficient of Variation (CV = sigma_mean / mu_mean)
    mean_val = np.mean(median_linear)
    mean_std = np.mean(std_linear)
    cv = float(mean_std / (mean_val + 1e-6))
    
    return PatchMetrics(
        name=roi.name,
        valid=True,
        total_pixels=n_total,
        valid_pixels=n_valid,
        valid_ratio=valid_ratio,
        saturation_ratio=filter_stats["sat_ratio"],
        underexposed_ratio=filter_stats["under_ratio"],
        glare_ratio=filter_stats["glare_ratio"],
        median_rgb_8bit=median_8bit,
        median_rgb_linear=[float(x) for x in median_linear],
        trimmed_mean_rgb_linear=[float(x) for x in trimmed_mean_linear],
        std_rgb_linear=[float(x) for x in std_linear],
        uniformity_cv=cv,
        rejection_reason=""
    )
