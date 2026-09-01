"""
h2s_dosimeter
==============
Robust Camera-Based H₂S Strip Color Calibration & Dosimetry Engine
SIH26118 — Passive Colorimetric Exposure-Dosimeter (MRPL)

Scientific Pipeline:
  linear RGB -> camera characterization (CCM) -> XYZ ->
  Bradford chromatic adaptation -> CIELAB -> CIEDE2000 ->
  calibrated H₂S dose estimation.
"""

__version__ = "1.0.0"
__author__ = "SIH26118 Project Team"
