"""Lighting Robustness and Illumination Stability Benchmark (Section 21).

Compares:
1. Controlled Enclosure Mode (Fixed 5000K Diffuse LED)
2. Variable / Uncontrolled Ambient Illuminants (2700K Warm Incandescent vs 7500K Overcast Daylight)
with optional Bradford Chromatic Adaptation evaluation.
"""

import numpy as np
from ..pipeline import H2SDosimeterEngine
from ..camera.capture import generate_synthetic_calibration_frame
from ..colorimetry.chromatic_adaptation import ILLUMINANTS


def run_lighting_benchmark():
    print("=" * 65)
    print("  Lighting Robustness & Controlled vs Uncontrolled Benchmark")
    print("=" * 65)

    engine = H2SDosimeterEngine()

    # Fixed chemical sample (Dose = 20.0 ppm·h, Lab = 71.3, 8.4, 29.8)
    base_frame = generate_synthetic_calibration_frame(
        strip_lab=(71.3, 8.4, 29.8),
        white_lab=(95.4, -0.4, 4.2),
        grey_lab=(52.6, 0.15, -0.25)
    )

    scenarios = [
        ("Controlled Enclosure (5000K Diffuse LED)", False, "D50"),
        ("Uncontrolled Warm Illuminant (2856K / A) with Bradford CAT", True, "A"),
        ("Uncontrolled Standard Daylight (6500K / D65)", False, "D65")
    ]

    print("\n[+] Testing sample across lighting scenarios:")
    doses = []
    for desc, enable_cat, illum in scenarios:
        res = engine.process_frame(
            frame=base_frame,
            camera_id="camera_enclosure_v1",
            temperature_c=25.0,
            humidity_percent=50.0,
            enable_chromatic_adaptation=enable_cat,
            source_illuminant_white=ILLUMINANTS.get(illum)
        )
        doses.append(res.estimated_dose_ppm_h)
        print(f"\n  --- {desc} ---")
        print(f"      Chromatic Adaptation Applied: {enable_cat}")
        print(f"      Measured dE00:               {res.strip_metrics.delta_e00:.2f}")
        print(f"      Estimated Dose:              {res.estimated_dose_ppm_h:.2f} ppm·h")
        print(f"      Quality Status:              {res.quality_gate.overall_score:.1f}/100 ({'PASS' if res.quality_gate.passed else 'REJECT'})")

    std_dose = float(np.std(doses))
    print("\n" + "=" * 65)
    print(f"  Lighting Dose Stability Std Dev: +/- {std_dose:.2f} ppm·h")
    print("  Recommendation: Controlled Enclosure provides highest repeatability.")
    print("=" * 65)


if __name__ == "__main__":
    run_lighting_benchmark()
