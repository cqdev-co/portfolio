"""
Radial gradient generator.
"""

import numpy as np

from ..core.base import BaseGenerator


class RadialGradientGenerator(BaseGenerator):
    """Generate radial gradients."""

    def generate(self) -> np.ndarray:
        """Generate a radial gradient."""

        # Parameters
        center_x = self.params.get("center_x", 0.5)  # Center X (0-1)
        center_y = self.params.get("center_y", 0.5)  # Center Y (0-1)
        inner_radius = self.params.get("inner_radius", 0.0)  # Inner radius (0-1)
        outer_radius = self.params.get("outer_radius", 1.0)  # Outer radius (0-1)
        ellipse_ratio = self.params.get("ellipse_ratio", 1.0)  # Width/height ratio

        # Create coordinate arrays
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)

        # Calculate distances from center
        dx = X - center_x
        dy = (Y - center_y) * ellipse_ratio
        distances = np.sqrt(dx**2 + dy**2)

        # Normalize distances to inner/outer radius range
        max_distance = np.sqrt(
            (0.5) ** 2 + (0.5 * ellipse_ratio) ** 2
        )  # Distance to corner
        normalized_distances = distances / max_distance

        # Apply inner and outer radius constraints
        gradient_values = np.clip(
            (normalized_distances - inner_radius) / (outer_radius - inner_radius), 0, 1
        )

        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))

        for i in range(self.height):
            for j in range(self.width):
                t = gradient_values[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)

        return rgb_array
