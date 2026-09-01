"""Command Line Interface (CLI) for SIH26118 H2S Dosimeter System."""

import argparse
import json
import sys
from pathlib import Path
import numpy as np

from .pipeline import H2SDosimeterEngine
from .camera.capture import generate_synthetic_calibration_frame, CameraCaptureFrame, CaptureMode


def main():
    parser = argparse.ArgumentParser(
        description="SIH26118 H2S Optical Colorimetric Dosimeter Engine",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--demo", action="store_true", help="Run deterministic presentation demo mode")
    parser.add_argument("--camera-id", type=str, default="camera_enclosure_v1", help="Camera profile ID")
    parser.add_argument("--temp", type=float, default=25.0, help="Ambient temperature in °C")
    parser.add_argument("--humidity", type=float, default=50.0, help="Ambient relative humidity in %")
    parser.add_argument("--image", type=str, help="Path to input image file (JPEG/PNG)")
    parser.add_argument("--json", action="store_true", help="Output full JSON diagnostic trace")

    args = parser.parse_args()

    engine = H2SDosimeterEngine()

    if args.demo:
        print("\n" + "=" * 62)
        print("  SIH26118 H2S OPTICAL DOSIMETER -- DEMO MODE")
        print("  [DEMO DATA -- PRESET CHAMBER KINETICS DEMONSTRATION]")
        print("=" * 62)

        demo_levels = [
            ("Baseline (Unexposed Shift Start)", (95.4, -0.4, 4.2), 0.0),
            ("Low Exposure (2.0 ppm·h)", (91.8, 0.85, 9.4), 2.0),
            ("Caution Tier (10.0 ppm·h)", (80.5, 5.1, 23.4), 10.0),
            ("Warning Tier (40.0 ppm·h)", (58.6, 11.2, 32.5), 40.0),
            ("Critical Danger (80.0 ppm·h / DGMS Limit)", (40.1, 13.1, 26.2), 80.0)
        ]

        for title, lab_val, expected_dose in demo_levels:
            frame = generate_synthetic_calibration_frame(strip_lab=lab_val)
            res = engine.process_frame(
                frame=frame,
                camera_id=args.camera_id,
                temperature_c=args.temp,
                humidity_percent=args.humidity,
                is_demo_data=True
            )
            s = res.to_dict()["summary"]
            print(f"\n[*] Sample: {title}")
            print(f"   Estimated Exposure: {s['estimated_dose_ppm_h']} ppm*h")
            print(f"   Safety Status:      {s['status']} ({s['badge_class'].upper()})")
            print(f"   Required Action:    {s['action_required']}")
            print(f"   Confidence Score:   {s['confidence_percent']}%")
            print(f"   Optical dE00:       {res.strip_metrics.delta_e00:.2f}")

        print("\n" + "=" * 62 + "\n")
        return

    # Normal execution on image or test frame
    if args.image:
        from PIL import Image
        img = np.array(Image.open(args.image).convert("RGB"))
    else:
        # Default test frame
        img = generate_synthetic_calibration_frame()

    result = engine.process_frame(
        frame=img,
        camera_id=args.camera_id,
        temperature_c=args.temp,
        humidity_percent=args.humidity
    )

    data = result.to_dict()

    if args.json:
        print(json.dumps(data, indent=2))
    else:
        s = data["summary"]
        print("\n" + "=" * 55)
        print("  H₂S DOSIMETER MEASUREMENT REPORT")
        print("=" * 55)
        print(f"  Estimated Cumulative Dose: {s['estimated_dose_ppm_h']} ppm·h")
        print(f"  Statutory Safety Status:   {s['status']}")
        print(f"  Required Protocol:         {s['action_required']}")
        print(f"  Measurement Confidence:    {s['confidence_percent']}%")
        print(f"  Capture Quality:           {s['quality_status']}")
        print(f"  Ambient Conditions:        {s['temperature_c']}°C, {s['humidity_percent']}% RH")
        print("=" * 55 + "\n")


if __name__ == "__main__":
    main()
