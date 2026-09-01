"""Robust Region of Interest (ROI) extraction and pixel filtering.

Performs:
1. Clipping rejection: drops saturated (>250) and shadow-clipped (<15) pixels.
2. Glare outlier rejection (> 2.5 sigma from median).
3. Robust trimmed median RGB estimation.
"""

from typing import Dict, Optional, Tuple, Union
import numpy as np


class ROIExtractor:
    """Extracts and filters pixel distributions from standardized rectangular image zones."""

    def __init__(
        self,
        black_threshold: float = 15.0,
        saturation_threshold: float = 250.0,
        trim_percent: float = 10.0,
        glare_sigma_threshold: float = 2.5
    ):
        self.black_threshold = black_threshold
        self.saturation_threshold = saturation_threshold
        self.trim_percent = trim_percent
        self.glare_sigma_threshold = glare_sigma_threshold

    def extract_patch(
        self,
        image: np.ndarray,
        bbox_norm: Tuple[float, float, float, float]
    ) -> np.ndarray:
        """Extracts sub-array from normalized bounding box (x1, y1, x2, y2) in [0.0, 1.0]."""
        h, w = image.shape[:2]
        x1 = max(0, min(w - 1, int(bbox_norm[0] * w)))
        y1 = max(0, min(h - 1, int(bbox_norm[1] * h)))
        x2 = max(x1 + 1, min(w, int(bbox_norm[2] * w)))
        y2 = max(y1 + 1, min(h, int(bbox_norm[3] * h)))

        patch = image[y1:y2, x1:x2]
        return patch.reshape(-1, 3) if patch.ndim == 3 else patch

    def compute_robust_median_rgb(
        self,
        patch_pixels: np.ndarray
    ) -> Tuple[np.ndarray, dict]:
        """Filters invalid pixels and computes robust trimmed median RGB.

        Args:
            patch_pixels: (N, 3) array of RGB pixel values in [0, 255] or [0.0, 1.0].

        Returns:
            Tuple[np.ndarray, dict]: (Robust 1D RGB vector [R, G, B], statistics dictionary).
        """
        pixels = np.asarray(patch_pixels, dtype=np.float64)
        if pixels.ndim != 2 or pixels.shape[1] != 3:
            raise ValueError(f"Pixels must have shape (N, 3), got {pixels.shape}")

        total_count = pixels.shape[0]
        if total_count == 0:
            return np.array([128.0, 128.0, 128.0]), {"valid_count": 0, "variance": 0.0}

        # 1. Reject saturated & clipped pixels
        valid_mask = (
            (np.min(pixels, axis=1) >= self.black_threshold) &
            (np.max(pixels, axis=1) <= self.saturation_threshold)
        )
        filtered = pixels[valid_mask]

        if filtered.shape[0] < max(10, int(0.05 * total_count)):
            # If too few pixels remain, relax constraints slightly
            filtered = pixels

        # 2. Reject specular glare outliers (> 2.5 sigma from median)
        med = np.median(filtered, axis=0)
        dist = np.linalg.norm(filtered - med, axis=1)
        sigma = np.std(dist)
        if sigma > 1e-4:
            inlier_mask = dist <= (self.glare_sigma_threshold * sigma)
            filtered = filtered[inlier_mask]

        # 3. Trimmed Statistics
        if filtered.shape[0] >= 10:
            low_p = self.trim_percent
            high_p = 100.0 - self.trim_percent
            p_low = np.percentile(filtered, low_p, axis=0)
            p_high = np.percentile(filtered, high_p, axis=0)
            trim_mask = np.all((filtered >= p_low) & (filtered <= p_high), axis=1)
            final_pixels = filtered[trim_mask] if np.any(trim_mask) else filtered
        else:
            final_pixels = filtered

        robust_rgb = np.median(final_pixels, axis=0)
        variance = float(np.mean(np.var(final_pixels, axis=0)))

        stats = {
            "total_pixels": total_count,
            "valid_pixels": int(final_pixels.shape[0]),
            "retained_ratio": round(float(final_pixels.shape[0] / total_count), 3),
            "variance": round(variance, 2),
            "std_dev": round(float(np.sqrt(variance)), 2)
        }

        return robust_rgb, stats
