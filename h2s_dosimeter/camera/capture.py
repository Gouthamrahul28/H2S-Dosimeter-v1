"""Camera capture abstraction and capture mode management.

Supports:
1. Controlled capture mode (Enclosure with fixed LED illumination - Recommended MVP mode)
2. Uncontrolled photograph mode (Ambient / handheld - Experimental, lower confidence)
3. Synthetic / Calibrated test frame generator for reproducible offline validation
"""

import enum
from typing import Dict, Optional, Tuple, Union
import numpy as np


class CaptureMode(enum.Enum):
    """Camera capture operating mode."""
    CONTROLLED_ENCLOSURE = "controlled_enclosure"  # Fixed optical geometry, diffuse LED, high confidence
    UNCONTROLLED_PHOTO = "uncontrolled_photo"      # Handheld ambient lighting, experimental


class CameraCaptureFrame:
    """Encapsulates a captured image frame with optical metadata."""

    def __init__(
        self,
        image_rgb: np.ndarray,
        mode: CaptureMode = CaptureMode.CONTROLLED_ENCLOSURE,
        camera_id: str = "camera_default_fallback",
        temperature_c: float = 25.0,
        humidity_percent: float = 50.0,
        is_demo_data: bool = False
    ):
        self.image_rgb = np.asarray(image_rgb, dtype=np.uint8)
        self.mode = mode
        self.camera_id = camera_id
        self.temperature_c = float(temperature_c)
        self.humidity_percent = float(humidity_percent)
        self.is_demo_data = is_demo_data

    @property
    def height(self) -> int:
        return self.image_rgb.shape[0]

    @property
    def width(self) -> int:
        return self.image_rgb.shape[1]


def generate_synthetic_calibration_frame(
    strip_lab: Tuple[float, float, float] = (71.3, 8.4, 29.8),
    white_lab: Tuple[float, float, float] = (95.4, -0.4, 4.2),
    grey_lab: Tuple[float, float, float] = (52.6, 0.15, -0.25),
    width: int = 640,
    height: int = 480,
    noise_sigma: float = 1.0
) -> np.ndarray:
    """Generates a standardized 3-patch optical calibration frame for testing.

    Layout:
    - Top-Left: White Reference Standard Patch
    - Top-Right: Grey Neutral Reference Patch
    - Center: Active H2S Chemical Strip
    - Background: Matte dark enclosure substrate
    """
    from ..colorimetry.xyz_to_lab import lab_to_xyz
    from ..colorimetry.rgb_to_xyz import xyz_to_rgb
    from ..colorimetry.linear_rgb import linear_to_srgb

    def lab_to_uint8_rgb(lab_val):
        xyz = lab_to_xyz(lab_val)
        lin_rgb = xyz_to_rgb(xyz)
        return linear_to_srgb(lin_rgb, to_255=True)

    img = np.full((height, width, 3), 35, dtype=np.uint8)  # Dark matte housing

    # White patch (Top-Left: 10% to 30% width, 10% to 30% height)
    w_rgb = lab_to_uint8_rgb(white_lab)
    x1_w, x2_w = int(width * 0.10), int(width * 0.30)
    y1_w, y2_w = int(height * 0.10), int(height * 0.30)
    img[y1_w:y2_w, x1_w:x2_w] = w_rgb

    # Grey patch (Top-Right: 70% to 90% width, 10% to 30% height)
    g_rgb = lab_to_uint8_rgb(grey_lab)
    x1_g, x2_g = int(width * 0.70), int(width * 0.90)
    y1_g, y2_g = int(height * 0.10), int(height * 0.30)
    img[y1_g:y2_g, x1_g:x2_g] = g_rgb

    # Active H2S Strip (Center: 38% to 62% width, 38% to 62% height)
    s_rgb = lab_to_uint8_rgb(strip_lab)
    x1_s, x2_s = int(width * 0.38), int(width * 0.62)
    y1_s, y2_s = int(height * 0.38), int(height * 0.62)
    img[y1_s:y2_s, x1_s:x2_s] = s_rgb

    # Add subtle sensor shot noise
    if noise_sigma > 0:
        noise = np.random.normal(0, noise_sigma, img.shape)
        img = np.clip(img.astype(np.float64) + noise, 0, 255).astype(np.uint8)

    return img
