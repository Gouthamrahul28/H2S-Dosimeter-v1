"""Cu-PAN Calibration Dose Regression and Piecewise Monotonic Interpolation Models.

Translates optical chemical shift (ΔE_00, ΔL*, Δa*, Δb*) to cumulative H2S exposure dose (ppm·h).
Enforces domain safety: flags out-of-range observations rather than blindly extrapolating.
"""

from typing import Dict, List, Optional, Tuple, Union
import numpy as np


class DoseCalibrationModel:
    """Base abstract dose calibration model."""

    def predict(self, delta_e00: float, delta_L: float = 0.0) -> Tuple[float, bool, str]:
        """Predicts dose in ppm·h from optical colorimetric metrics."""
        raise NotImplementedError


class PiecewiseMonotonicDoseModel(DoseCalibrationModel):
    """Piecewise monotonic linear/spline interpolation model.

    Maps increasing Cu-PAN chemical transition (ΔE_00) strictly to non-decreasing cumulative dose.
    """

    def __init__(
        self,
        cal_delta_e00: np.ndarray,
        cal_dose_ppm_h: np.ndarray,
        min_valid_delta_e00: float = 0.0,
        max_valid_delta_e00: float = 75.0
    ):
        sort_idx = np.argsort(cal_delta_e00)
        self.cal_delta = np.asarray(cal_delta_e00[sort_idx], dtype=np.float64)
        self.cal_dose = np.asarray(cal_dose_ppm_h[sort_idx], dtype=np.float64)
        self.min_valid_delta = float(min_valid_delta_e00)
        self.max_valid_delta = float(max_valid_delta_e00)

    def predict(self, delta_e00: float, delta_L: float = 0.0) -> Tuple[float, bool, str]:
        """Predicts estimated dose (ppm·h) from measured ΔE_00.

        Returns:
            Tuple[float, bool, str]: (Dose in ppm·h, is_in_range, status_message).
        """
        val = float(delta_e00)

        # Baseline check (<= 1.0 ΔE00 is unexposed virgin Cu-PAN substrate)
        if val <= 1.0:
            return 0.0, True, "Virgin Unexposed Baseline"

        # Out-of-range detection
        if val < self.min_valid_delta:
            return 0.0, False, "OUT OF CALIBRATION RANGE (Below Baseline)"

        if val > self.max_valid_delta:
            # Saturated beyond maximum calibrated chemical response
            max_dose = float(self.cal_dose[-1])
            return max_dose, False, "OUT OF CALIBRATION RANGE (Sensor Saturation)"

        # Monotonic piecewise linear interpolation within calibration domain
        estimated_dose = float(np.interp(val, self.cal_delta, self.cal_dose))
        return round(estimated_dose, 2), True, "Valid In-Range Interpolation"


class PolynomialDoseModel(DoseCalibrationModel):
    """2nd-order polynomial surface regression model: Dose = c0 + c1*ΔE00 + c2*(ΔE00)^2."""

    def __init__(
        self,
        coefficients: np.ndarray,
        min_valid_delta_e00: float = 0.0,
        max_valid_delta_e00: float = 75.0
    ):
        self.coeffs = np.asarray(coefficients, dtype=np.float64)
        self.min_valid_delta = float(min_valid_delta_e00)
        self.max_valid_delta = float(max_valid_delta_e00)

    def predict(self, delta_e00: float, delta_L: float = 0.0) -> Tuple[float, bool, str]:
        val = float(delta_e00)
        if val <= 0.5:
            return 0.0, True, "Virgin Unexposed Baseline"
        if val > self.max_valid_delta:
            return float(np.polyval(self.coeffs, self.max_valid_delta)), False, "OUT OF CALIBRATION RANGE (Sensor Saturation)"

        pred = float(np.polyval(self.coeffs, val))
        return max(0.0, round(pred, 2)), True, "Valid In-Range Polynomial"
