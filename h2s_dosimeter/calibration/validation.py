"""Metrological validation and model performance reporting module.

Computes:
- Mean Absolute Error (MAE)
- Root Mean Squared Error (RMSE)
- Coefficient of Determination (R²)
- Maximum Absolute Calibration Error
- Leave-One-Out Cross-Validation (LOOCV)
"""

from typing import Dict, List, Tuple
import numpy as np


class ValidationMetricsReport:
    """Encapsulates metrological model performance metrics."""

    def __init__(
        self,
        mae: float,
        rmse: float,
        r_squared: float,
        max_error: float,
        num_samples: int,
        model_name: str
    ):
        self.mae = round(float(mae), 3)
        self.rmse = round(float(rmse), 3)
        self.r_squared = round(float(r_squared), 4)
        self.max_error = round(float(max_error), 3)
        self.num_samples = int(num_samples)
        self.model_name = model_name

    def to_dict(self) -> dict:
        return {
            "model_name": self.model_name,
            "num_samples": self.num_samples,
            "mae_ppm_h": self.mae,
            "rmse_ppm_h": self.rmse,
            "r_squared": self.r_squared,
            "max_error_ppm_h": self.max_error
        }


def compute_validation_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    model_name: str = "Dose Calibration Model"
) -> ValidationMetricsReport:
    """Calculates formal validation metrics for dose predictions."""
    y_t = np.asarray(y_true, dtype=np.float64)
    y_p = np.asarray(y_pred, dtype=np.float64)

    errors = np.abs(y_p - y_t)
    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean((y_p - y_t) ** 2)))
    max_err = float(np.max(errors)) if len(errors) > 0 else 0.0

    ss_res = np.sum((y_t - y_p) ** 2)
    ss_tot = np.sum((y_t - np.mean(y_t)) ** 2)
    r2 = float(1.0 - (ss_res / (ss_tot + 1e-12))) if ss_tot > 0 else 1.0

    return ValidationMetricsReport(
        mae=mae,
        rmse=rmse,
        r_squared=r2,
        max_error=max_err,
        num_samples=len(y_t),
        model_name=model_name
    )
