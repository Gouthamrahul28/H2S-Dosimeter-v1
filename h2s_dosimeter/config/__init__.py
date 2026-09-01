"""
h2s_dosimeter.config
====================
Default configuration profiles and calibration dataset loaders.
"""

import os

CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CALIBRATION_CONFIG_PATH = os.path.join(CONFIG_DIR, "color_calibration.json")
DEFAULT_CALIBRATION_DATASET_PATH = os.path.join(CONFIG_DIR, "calibration_dataset.json")
