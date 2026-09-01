"""Statutory Exposure Risk Policy Engine.

Evaluates cumulative H2S exposure doses against Indian DGMS (Directorate General of Mines Safety),
ACGIH, NIOSH, and OSHA statutory occupational safety exposure limits.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

DEFAULT_RISK_CONFIG = Path(__file__).resolve().parent.parent / "config" / "risk_thresholds.json"


class RiskZone:
    """Represents a discrete statutory exposure safety zone."""

    def __init__(
        self,
        name: str,
        level: int,
        min_dose_ppm_h: float,
        max_dose_ppm_h: Optional[float],
        color_hex: str,
        badge_class: str,
        action: str,
        description: str
    ):
        self.name = name
        self.level = level
        self.min_dose_ppm_h = float(min_dose_ppm_h)
        self.max_dose_ppm_h = float(max_dose_ppm_h) if max_dose_ppm_h is not None else None
        self.color_hex = color_hex
        self.badge_class = badge_class
        self.action = action
        self.description = description

    def contains(self, dose_ppm_h: float) -> bool:
        if dose_ppm_h < self.min_dose_ppm_h:
            return False
        if self.max_dose_ppm_h is not None and dose_ppm_h >= self.max_dose_ppm_h:
            return False
        return True

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "level": self.level,
            "min_dose_ppm_h": self.min_dose_ppm_h,
            "max_dose_ppm_h": self.max_dose_ppm_h,
            "color_hex": self.color_hex,
            "badge_class": self.badge_class,
            "action": self.action,
            "description": self.description
        }


class RiskPolicyEngine:
    """Evaluates exposure readings against configured statutory risk zones."""

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or DEFAULT_RISK_CONFIG
        self.zones: List[RiskZone] = []
        self.shift_limit_ppm_h: float = 80.0
        self._load()

    def _load(self):
        if not self.config_path.exists():
            return
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            self.shift_limit_ppm_h = float(data.get("shift_cumulative_dose_limit_ppm_h", 80.0))
            self.zones = [
                RiskZone(
                    name=z["name"],
                    level=z["level"],
                    min_dose_ppm_h=z["min_dose_ppm_h"],
                    max_dose_ppm_h=z.get("max_dose_ppm_h"),
                    color_hex=z["color_hex"],
                    badge_class=z["badge_class"],
                    action=z["action"],
                    description=z["description"]
                )
                for z in data.get("zones", [])
            ]

    def evaluate_risk(self, cumulative_dose_ppm_h: float) -> RiskZone:
        """Maps scalar dose in ppm·h to corresponding statutory risk tier."""
        val = max(0.0, float(cumulative_dose_ppm_h))
        for zone in self.zones:
            if zone.contains(val):
                return zone
        # Fallback to highest danger zone if above highest bound
        return self.zones[-1] if self.zones else RiskZone(
            name="DANGER",
            level=4,
            min_dose_ppm_h=80.0,
            max_dose_ppm_h=None,
            color_hex="#e11d48",
            badge_class="severe",
            action="Immediate Evacuation",
            description="Exceeded statutory exposure limit"
        )


# Global DGMS limit constant (80 ppm·h for 8-hour shift)
DGMS_SHIFT_CUMULATIVE_LIMIT_PPM_HOURS = 80.0


def get_statutory_risk_level(cumulative_dose_ppm_hours: float, shift_duration_hours: float = 8.0) -> dict:
    """Helper returning statutory risk metadata dictionary."""
    engine = RiskPolicyEngine()
    zone = engine.evaluate_risk(cumulative_dose_ppm_hours)
    twa = round(cumulative_dose_ppm_hours / max(0.1, shift_duration_hours), 2)
    return {
        "tier": zone.name,
        "level": zone.level,
        "color": zone.color_hex,
        "badge_class": zone.badge_class,
        "required_action": zone.action,
        "description": zone.description,
        "twa_ppm": twa
    }
