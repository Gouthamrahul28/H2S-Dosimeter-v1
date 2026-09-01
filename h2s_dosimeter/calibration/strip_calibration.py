"""Experimental Cu-PAN Chemical Strip Calibration Dataset and Arrhenius Compensation.

Manages:
1. Loading calibrated chamber data points for Cu-PAN (copper(II) complex of 1-(2-pyridylazo)-2-naphthol).
2. Arrhenius temperature and relative humidity kinetic rate adjustment:
       k(T, RH) = exp[ -Ea/R * (1/T - 1/T_ref) ] * (RH / RH_ref)^alpha
       ΔE_00_normalized = ΔE_00_measured / k(T, RH)
3. Initializing and validating dose models against empirical chamber points.
4. Rejecting invalid or non-Cu-PAN chemistry profiles.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
from .regression import PiecewiseMonotonicDoseModel, PolynomialDoseModel

DEFAULT_STRIP_CONFIG = Path(__file__).resolve().parent.parent / "config" / "strip_calibration.json"


class StripCalibrationDataset:
    """Encapsulates the experimental chamber calibration dataset for Cu-PAN strips."""

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.config_path = Path(config_path) if config_path else DEFAULT_STRIP_CONFIG
        self.version = "cupan-chem-v1.0"
        self.chemistry = "Cu-PAN"
        self.indicator = "Copper(II)-PAN"
        self.substrate = "Regenerated Cellulose / Paper Matrix"
        self.initial_color = "PURPLE_VIOLET"
        self.final_color = "YELLOW_ORANGE"
        self.baseline_lab = np.array([42.50, 38.20, -28.40], dtype=np.float64)
        self.white_lab = np.array([95.40, -0.42, 1.18], dtype=np.float64)
        self.grey_lab = np.array([52.60, 0.15, -0.25], dtype=np.float64)
        self.domain = {
            "min_dose_ppm_h": 0.0,
            "max_dose_ppm_h": 160.0,
            "min_delta_e00": 0.0,
            "max_delta_e00": 75.0,
            "min_temp_c": 10.0,
            "max_temp_c": 50.0,
            "min_rh_percent": 15.0,
            "max_rh_percent": 90.0
        }
        self.arrhenius = {
            "reference_temp_c": 25.0,
            "reference_rh_percent": 50.0,
            "ea_over_r_kelvin": 1420.0,
            "rh_power_coefficient": 0.38
        }
        self.points: List[dict] = []
        self._load()

        # Build default Piecewise Monotonic model
        deltas = np.array([p["delta_e00"] for p in self.points], dtype=np.float64)
        doses = np.array([p["dose_ppm_h"] for p in self.points], dtype=np.float64)
        self.model = PiecewiseMonotonicDoseModel(
            cal_delta_e00=deltas,
            cal_dose_ppm_h=doses,
            min_valid_delta_e00=self.domain["min_delta_e00"],
            max_valid_delta_e00=self.domain["max_delta_e00"]
        )

    def _load(self):
        if not self.config_path.exists():
            return
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            chem = data.get("chemistry", "")
            if chem and chem != "Cu-PAN":
                raise ValueError(f"Unsupported strip chemistry: '{chem}'. Only 'Cu-PAN' is supported.")
            self.chemistry = chem or self.chemistry
            self.version = data.get("version", self.version)
            self.indicator = data.get("indicator", self.indicator)
            self.substrate = data.get("substrate", self.substrate)
            self.initial_color = data.get("initial_color", self.initial_color)
            self.final_color = data.get("final_color", self.final_color)
            if "virgin_baseline_lab" in data:
                b = data["virgin_baseline_lab"]
                self.baseline_lab = np.array([b["L"], b["a"], b["b"]], dtype=np.float64)
            if "white_reference_lab" in data:
                w = data["white_reference_lab"]
                self.white_lab = np.array([w["L"], w["a"], w["b"]], dtype=np.float64)
            if "grey_reference_lab" in data:
                g = data["grey_reference_lab"]
                self.grey_lab = np.array([g["L"], g["a"], g["b"]], dtype=np.float64)
            if "calibration_domain" in data:
                self.domain.update(data["calibration_domain"])
            if "arrhenius_compensation" in data:
                self.arrhenius.update(data["arrhenius_compensation"])
            self.points = data.get("calibration_points", [])

        # Ensure delta_e00 strictly matches analytical CIEDE2000 to baseline
        from ..colorimetry.delta_e import ciede2000
        for p in self.points:
            pt_lab = (p["L"], p["a"], p["b"])
            p["delta_e00"] = round(ciede2000(self.baseline_lab, pt_lab), 2)

    def compute_environmental_rate_factor(self, temp_c: float, rh_percent: float) -> Tuple[float, bool, str]:
        """Calculates Arrhenius kinetic compensation rate factor k(T, RH).

        Returns:
            Tuple[float, bool, str]: (Rate factor k, is_env_valid, status_reason).
        """
        t_ref_k = self.arrhenius["reference_temp_c"] + 273.15
        t_actual_k = float(temp_c) + 273.15
        rh_ref = self.arrhenius["reference_rh_percent"]
        rh_actual = float(rh_percent)

        # Check operational environmental bounds
        env_valid = True
        reason = "Within rated environmental range"

        if temp_c < self.domain["min_temp_c"] or temp_c > self.domain["max_temp_c"]:
            env_valid = False
            reason = f"Temperature ({temp_c}°C) outside rated range [{self.domain['min_temp_c']}, {self.domain['max_temp_c']}°C]"

        if rh_percent < self.domain["min_rh_percent"] or rh_percent > self.domain["max_rh_percent"]:
            env_valid = False
            reason = f"Humidity ({rh_percent}%) outside rated range [{self.domain['min_rh_percent']}, {self.domain['max_rh_percent']}%]"

        # Arrhenius temperature factor: exp[ -Ea/R * (1/T - 1/T_ref) ]
        temp_term = -self.arrhenius["ea_over_r_kelvin"] * (1.0 / t_actual_k - 1.0 / t_ref_k)
        k_temp = float(np.exp(temp_term))

        # Relative humidity power factor: (RH / RH_ref)^alpha
        rh_ratio = max(0.05, rh_actual / rh_ref)
        k_rh = float(np.power(rh_ratio, self.arrhenius["rh_power_coefficient"]))

        k_combined = float(np.clip(k_temp * k_rh, 0.40, 2.50))
        return k_combined, env_valid, reason

    def estimate_dose(
        self,
        delta_e00: float,
        temp_c: float = 25.0,
        rh_percent: float = 50.0,
        delta_L: float = 0.0
    ) -> Tuple[float, bool, str, float]:
        """Calculates cumulative dose (ppm·h) from measured ΔE_00 and ambient sensors.

        Returns:
            Tuple[float, bool, str, float]: (Dose in ppm·h, in_range, status, rate_factor).
        """
        k_env, env_valid, env_reason = self.compute_environmental_rate_factor(temp_c, rh_percent)

        # Normalize measured optical change to standard reference conditions (25°C, 50% RH)
        delta_e00_normalized = float(delta_e00) / k_env

        raw_dose, in_range, status_msg = self.model.predict(delta_e00_normalized, delta_L)

        # Total dose in ppm·hours
        return raw_dose, in_range and env_valid, status_msg if in_range else status_msg, k_env
