"""H2S Chemical Strip Colorimetric Metric Analyzer.

Quantifies the chemical color transition of the sensing strip relative to
the virgin unexposed substrate baseline:
    ΔL* = L* - L0*
    Δa* = a* - a0*
    Δb* = b* - b0*
    ΔE_00 = CIEDE2000(Lab, Lab_baseline)
"""

from typing import Dict, Optional, Tuple, Union
import numpy as np
from ..colorimetry.delta_e import ciede2000


class StripOpticalMetrics:
    """Encapsulates optical colorimetric measurements of the H2S strip."""

    def __init__(
        self,
        lab: np.ndarray,
        baseline_lab: np.ndarray,
        delta_e00: float,
        delta_L: float,
        delta_a: float,
        delta_b: float,
        color_variance: float,
        is_darkened: bool
    ):
        self.lab = np.asarray(lab, dtype=np.float64)
        self.baseline_lab = np.asarray(baseline_lab, dtype=np.float64)
        self.delta_e00 = round(float(delta_e00), 2)
        self.delta_L = round(float(delta_L), 2)
        self.delta_a = round(float(delta_a), 2)
        self.delta_b = round(float(delta_b), 2)
        self.color_variance = round(float(color_variance), 2)
        self.is_darkened = is_darkened

    @property
    def L(self) -> float:
        return float(self.lab[0])

    @property
    def a(self) -> float:
        return float(self.lab[1])

    @property
    def b(self) -> float:
        return float(self.lab[2])

    def to_dict(self) -> dict:
        return {
            "L": round(self.L, 2),
            "a": round(self.a, 2),
            "b": round(self.b, 2),
            "baseline_L": round(float(self.baseline_lab[0]), 2),
            "baseline_a": round(float(self.baseline_lab[1]), 2),
            "baseline_b": round(float(self.baseline_lab[2]), 2),
            "delta_L": self.delta_L,
            "delta_a": self.delta_a,
            "delta_b": self.delta_b,
            "delta_e00": self.delta_e00,
            "color_variance": self.color_variance,
            "is_darkened": self.is_darkened
        }


def analyze_strip_color(
    current_lab: np.ndarray,
    baseline_lab: Union[np.ndarray, list, tuple] = (95.40, -0.42, 4.18),
    color_variance: float = 0.0
) -> StripOpticalMetrics:
    """Analyzes the optical color transition of the active H2S chemical strip.

    Args:
        current_lab: Measured CIELAB vector [L*, a*, b*] of the exposed strip.
        baseline_lab: Virgin unexposed strip baseline [L0*, a0*, b0*].
        color_variance: Spatial variance of the strip pixels.

    Returns:
        StripOpticalMetrics: Colorimetric shift vectors and CIEDE2000 delta.
    """
    lab = np.asarray(current_lab, dtype=np.float64)
    base = np.asarray(baseline_lab, dtype=np.float64)

    delta_L = float(lab[0] - base[0])
    delta_a = float(lab[1] - base[1])
    delta_b = float(lab[2] - base[2])

    delta_e00 = ciede2000(base, lab)
    is_darkened = delta_L < -1.5 or delta_e00 > 2.0

    return StripOpticalMetrics(
        lab=lab,
        baseline_lab=base,
        delta_e00=delta_e00,
        delta_L=delta_L,
        delta_a=delta_a,
        delta_b=delta_b,
        color_variance=color_variance,
        is_darkened=is_darkened
    )


compute_strip_optical_metrics = analyze_strip_color
