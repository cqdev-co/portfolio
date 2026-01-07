"""
Linear gradient generator.
"""

import numpy as np

from ..core.base import BaseGenerator


class LinearGradientGenerator(BaseGenerator):
    """Generate linear gradients."""

    def generate(self) -> np.ndarray:
        """Generate a linear gradient."""

        # Parameters
        angle = self.params.get("angle", 0)  # Angle in degrees
        center_x = self.params.get("center_x", 0.5)  # Center X (0-1)
        center_y = self.params.get("center_y", 0.5)  # Center Y (0-1)

        # Create coordinate arrays
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)

        # Adjust coordinates relative to center
        X_centered = X - center_x
        Y_centered = Y - center_y

        # Apply rotation
        angle_rad = np.radians(angle)
        cos_angle = np.cos(angle_rad)
        sin_angle = np.sin(angle_rad)

        # Rotate coordinates
        X_rot = X_centered * cos_angle - Y_centered * sin_angle

        # Normalize to 0-1 range
        gradient_values = X_rot
        gradient_values = (gradient_values - gradient_values.min()) / (
            gradient_values.max() - gradient_values.min()
        )

        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))

        for i in range(self.height):
            for j in range(self.width):
                t = gradient_values[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)

        return rgb_array
