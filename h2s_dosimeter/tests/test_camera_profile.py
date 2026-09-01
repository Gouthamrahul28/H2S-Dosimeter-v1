"""Pytest suite for Camera Profile Registry and CCM Solver."""

import pytest
import numpy as np

from ..camera.camera_profile import CameraProfile, CameraProfileRegistry, solve_camera_ccm


def test_solve_camera_ccm_identity():
    """Verify CCM solver recovers identity mapping when camera RGB matches XYZ."""
    rgb = np.array([
        [0.8, 0.1, 0.1],
        [0.1, 0.8, 0.1],
        [0.1, 0.1, 0.8],
        [0.5, 0.5, 0.5]
    ], dtype=np.float64)

    ccm, rmse = solve_camera_ccm(rgb, rgb, alpha=1e-8)
    np.testing.assert_allclose(ccm, np.eye(3), atol=1e-3)
    assert rmse < 1e-3


def test_camera_profile_registry_fallback():
    """Verify registry returns valid fallback profile when unknown camera ID is requested."""
    registry = CameraProfileRegistry()
    profile = registry.get_profile("non_existent_camera_id")

    assert profile is not None
    assert profile.ccm.shape == (3, 3)
    assert profile.is_characterized is False
