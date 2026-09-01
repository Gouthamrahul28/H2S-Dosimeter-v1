"""
h2s_dosimeter.calibration.calibration_dataset
=============================================
Schema, validation, and storage for experimental colorimetric Cu-PAN H₂S strip calibration datasets.

Cu-PAN REACTION PRINCIPLE:
Cu(II)-PAN complex + H₂S -> sulfide interaction with Cu(II) -> CuS formation + release/formation of H-PAN
Visible color transition: Purple/Violet family -> Yellow/Orange family.

DOSE KINETICS FOUNDATION:
The relationship between chemical strip color shift and H₂S gas exposure is a function of:
- Cumulative Dose: ∫ C(t) dt ≈ exposure_ppm × (exposure_minutes / 60) [ppm·h] = exposure_ppm × exposure_minutes [ppm·min]
- Cu-PAN formulation, substrate matrix, and PAN/Cu stoichiometry
- Ambient Temperature (°C) and Relative Humidity (% RH) affecting diffusion and reaction rate
- CIELAB coordinates (L*, a*, b*) and total perceptual color difference (ΔE00).
"""

import csv
from dataclasses import dataclass, asdict
import json
import os
from typing import Dict, List, Optional, Tuple, Union
import numpy as np


@dataclass
class CalibrationRecord:
    """Individual experimental Cu-PAN calibration sample point."""
    sample_id: str
    dose_ppm_h: float          # Cumulative dose in ppm·hours
    exposure_ppm: float        # Gas concentration during chamber test (ppm)
    exposure_minutes: float    # Exposure duration in chamber (minutes)
    L: float                   # CIELAB Lightness [0, 100]
    a: float                   # CIELAB a* axis [-128, 127]
    b: float                   # CIELAB b* axis [-128, 127]
    deltaE00: float            # Perceptual color difference from unexposed Cu-PAN baseline
    chemistry: str = "Cu-PAN"
    dose_ppm_min: float = 0.0  # Cumulative dose in ppm·minutes
    temperature_c: float = 25.0 # Chamber temperature in °C
    humidity_percent: float = 50.0 # Chamber relative humidity (% RH)
    rgb: Optional[Dict[str, int]] = None
    notes: str = ""

    def __post_init__(self):
        if self.chemistry != "Cu-PAN":
            raise ValueError(f"Invalid record chemistry: '{self.chemistry}'. Only 'Cu-PAN' is permitted.")
        if self.dose_ppm_min == 0.0 and self.dose_ppm_h > 0.0:
            self.dose_ppm_min = round(self.dose_ppm_h * 60.0, 2)
        elif self.dose_ppm_h == 0.0 and self.dose_ppm_min > 0.0:
            self.dose_ppm_h = round(self.dose_ppm_min / 60.0, 4)

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["delta_e00"] = self.deltaE00
        d["h2s_ppm"] = self.exposure_ppm
        return d

    @classmethod
    def from_dict(cls, data: Dict) -> 'CalibrationRecord':
        chem = str(data.get("chemistry", "Cu-PAN"))
        if chem != "Cu-PAN":
            raise ValueError(f"Unsupported calibration record chemistry: '{chem}'. Only 'Cu-PAN' is supported.")
        
        exposure_ppm = float(data.get("h2s_ppm", data.get("exposure_ppm", 0.0)))
        exposure_minutes = float(data.get("exposure_minutes", 0.0))
        dose_ppm_h = float(data.get("dose_ppm_h", 0.0))
        dose_ppm_min = float(data.get("dose_ppm_min", 0.0))

        if dose_ppm_h == 0.0 and dose_ppm_min > 0.0:
            dose_ppm_h = dose_ppm_min / 60.0
        elif dose_ppm_min == 0.0 and dose_ppm_h > 0.0:
            dose_ppm_min = dose_ppm_h * 60.0
        elif dose_ppm_h == 0.0 and exposure_ppm > 0.0 and exposure_minutes > 0.0:
            dose_ppm_min = exposure_ppm * exposure_minutes
            dose_ppm_h = dose_ppm_min / 60.0

        # Lab resolution
        lab_dict = data.get("lab", {})
        L = float(data.get("L", lab_dict.get("L", 0.0)))
        a = float(data.get("a", lab_dict.get("a", 0.0)))
        b = float(data.get("b", lab_dict.get("b", 0.0)))

        delta_e = float(data.get("delta_e00", data.get("deltaE00", 0.0)))

        rgb_dict = data.get("rgb", None)

        return cls(
            sample_id=str(data.get("sample_id", "CUPAN_SAMPLE")),
            chemistry=chem,
            dose_ppm_h=round(dose_ppm_h, 4),
            dose_ppm_min=round(dose_ppm_min, 2),
            exposure_ppm=exposure_ppm,
            exposure_minutes=exposure_minutes,
            L=L,
            a=a,
            b=b,
            deltaE00=delta_e,
            temperature_c=float(data.get("temperature_c", 25.0)),
            humidity_percent=float(data.get("humidity_percent", 50.0)),
            rgb=rgb_dict,
            notes=str(data.get("notes", ""))
        )


@dataclass
class CalibrationDataset:
    """Container for a collection of experimental Cu-PAN calibration records."""
    dataset_name: str
    formulation_version: str
    reference_baseline_lab: List[float] # [L0, a0, b0] unexposed Cu-PAN strip baseline
    records: List[CalibrationRecord]
    chemistry: str = "Cu-PAN"
    indicator: str = "Copper(II)-PAN"
    substrate: str = "Regenerated Cellulose / Paper Matrix"
    created_at: str = "2026-09-01"
    description: str = ""

    def __post_init__(self):
        if self.chemistry != "Cu-PAN":
            raise ValueError(f"Invalid dataset chemistry: '{self.chemistry}'. Only 'Cu-PAN' is permitted.")

    def __len__(self) -> int:
        return len(self.records)

    def to_dict(self) -> Dict:
        return {
            "dataset_name": self.dataset_name,
            "chemistry": self.chemistry,
            "indicator": self.indicator,
            "substrate": self.substrate,
            "formulation_version": self.formulation_version,
            "reference_baseline_lab": self.reference_baseline_lab,
            "created_at": self.created_at,
            "description": self.description,
            "records": [r.to_dict() for r in self.records]
        }

    def get_arrays(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Extract numeric feature matrices.
        
        Returns:
            Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
                (Lab_matrix (N, 3), deltaE_array (N,), doses_array (N,), env_matrix (N, 2))
        """
        if not self.records:
            return np.empty((0, 3)), np.empty((0,)), np.empty((0,)), np.empty((0, 2))
            
        labs = np.array([[r.L, r.a, r.b] for r in self.records], dtype=np.float64)
        delta_es = np.array([r.deltaE00 for r in self.records], dtype=np.float64)
        doses = np.array([r.dose_ppm_h for r in self.records], dtype=np.float64)
        envs = np.array([[r.temperature_c, r.humidity_percent] for r in self.records], dtype=np.float64)
        return labs, delta_es, doses, envs

    def save_json(self, file_path: str) -> None:
        """Save dataset to JSON file."""
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    def save_csv(self, file_path: str) -> None:
        """Export records to CSV table."""
        os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
        fieldnames = [
            "sample_id", "chemistry", "dose_ppm_h", "dose_ppm_min", "h2s_ppm", "exposure_minutes",
            "L", "a", "b", "delta_e00", "temperature_c", "humidity_percent", "notes"
        ]
        with open(file_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in self.records:
                row = r.to_dict()
                row_filtered = {k: row.get(k, "") for k in fieldnames}
                writer.writerow(row_filtered)


def load_calibration_dataset(source: Union[str, Dict]) -> CalibrationDataset:
    """
    Load CalibrationDataset from JSON file, CSV file, or Python dictionary.
    
    Args:
        source: File path (JSON or CSV) or dict.
        
    Returns:
        CalibrationDataset instance.
    """
    if isinstance(source, dict):
        chem = str(source.get("chemistry", "Cu-PAN"))
        if chem != "Cu-PAN":
            raise ValueError(f"Unsupported calibration dataset chemistry: '{chem}'. Only 'Cu-PAN' is supported.")
        records = [CalibrationRecord.from_dict(r) for r in source.get("records", [])]
        return CalibrationDataset(
            dataset_name=str(source.get("dataset_name", "Cu-PAN-Custom-Dataset")),
            chemistry=chem,
            indicator=str(source.get("indicator", "Copper(II)-PAN")),
            substrate=str(source.get("substrate", "Regenerated Cellulose / Paper Matrix")),
            formulation_version=str(source.get("formulation_version", "CuPAN-v1.0")),
            reference_baseline_lab=source.get("reference_baseline_lab", [42.50, 38.20, -28.40]),
            records=records,
            created_at=str(source.get("created_at", "2026-09-01")),
            description=str(source.get("description", ""))
        )
        
    if not isinstance(source, str):
        raise TypeError(f"Expected file path string or dict, got {type(source)}")
        
    if not os.path.exists(source):
        raise FileNotFoundError(f"Calibration dataset file not found: {source}")
        
    if source.endswith(".csv"):
        records = []
        with open(source, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if "chemistry" not in row or not row["chemistry"]:
                    row["chemistry"] = "Cu-PAN"
                records.append(CalibrationRecord.from_dict(row))
        return CalibrationDataset(
            dataset_name=os.path.basename(source),
            chemistry="Cu-PAN",
            indicator="Copper(II)-PAN",
            substrate="Regenerated Cellulose / Paper Matrix",
            formulation_version="CSV-Import",
            reference_baseline_lab=[42.50, 38.20, -28.40],
            records=records,
            created_at="2026-09-01",
            description="Loaded from CSV export"
        )
        
    with open(source, "r", encoding="utf-8") as f:
        data = json.load(f)
    return load_calibration_dataset(data)
