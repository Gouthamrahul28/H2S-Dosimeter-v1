"""
h2s_dosimeter.vision.preprocessing
==================================
Image ingestion, format decoding, color channel alignment, and validation.
"""

import base64
import os
from typing import Tuple, Union
import cv2
import numpy as np


def validate_image(image: np.ndarray, min_dimension: int = 32) -> Tuple[bool, str]:
    """
    Check if the input numpy array is a valid 3-channel color image.
    
    Args:
        image: Image array.
        min_dimension: Minimum acceptable height and width in pixels.
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    if image is None:
        return False, "Image object is None."
    if not isinstance(image, np.ndarray):
        return False, f"Expected numpy array, got {type(image)}."
    if image.ndim != 3 or image.shape[2] != 3:
        return False, f"Image must be 3-channel RGB/BGR, got shape {image.shape}."
    h, w = image.shape[:2]
    if h < min_dimension or w < min_dimension:
        return False, f"Image resolution ({w}x{h}) is too small; minimum is {min_dimension}x{min_dimension}."
    return True, ""


def load_image(image_path: str) -> np.ndarray:
    """
    Load an image from a filesystem path and return as standard RGB uint8 array.
    
    Args:
        image_path: Path to image file.
        
    Returns:
        np.ndarray: Image array in RGB channel order, uint8 [0, 255].
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")
        
    # Read image via OpenCV (BGR)
    img_bgr = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise ValueError(f"Failed to decode image from path: {image_path}")
        
    is_valid, msg = validate_image(img_bgr)
    if not is_valid:
        raise ValueError(f"Invalid image file: {msg}")
        
    # Convert BGR to RGB
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return img_rgb


def decode_image_base64(base64_str: str) -> np.ndarray:
    """
    Decode an image from base64 string (supports data URI prefixes) and return RGB uint8.
    
    Args:
        base64_str: Base64-encoded image string.
        
    Returns:
        np.ndarray: Image array in RGB order, uint8 [0, 255].
    """
    if not base64_str or not isinstance(base64_str, str):
        raise ValueError("Base64 string is empty or invalid.")
        
    clean_b64 = base64_str
    if ";base64," in clean_b64:
        clean_b64 = clean_b64.split(";base64,")[1]
        
    try:
        raw_bytes = base64.b64decode(clean_b64)
    except Exception as e:
        raise ValueError(f"Failed to base64 decode image buffer: {e}")
        
    np_buf = np.frombuffer(raw_bytes, dtype=np.uint8)
    img_bgr = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
    
    if img_bgr is None:
        raise ValueError("Could not decode image from provided base64 data buffer.")
        
    is_valid, msg = validate_image(img_bgr)
    if not is_valid:
        raise ValueError(f"Decoded base64 image failed validation: {msg}")
        
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return img_rgb
