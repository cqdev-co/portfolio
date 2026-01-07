"""
Fractal gradient generator.
"""

import numpy as np

from ..core.base import BaseGenerator


class FractalGenerator(BaseGenerator):
    """Generate gradients using fractal algorithms."""

    def generate(self) -> np.ndarray:
        """Generate a fractal gradient."""

        # Parameters
        fractal_type = self.params.get("type", "mandelbrot")
        max_iter = self.params.get("max_iter", 100)
        zoom = self.params.get("zoom", 1.0)
        center_x = self.params.get("center_x", 0.0)
        center_y = self.params.get("center_y", 0.0)

        if fractal_type == "mandelbrot":
            return self._mandelbrot(max_iter, zoom, center_x, center_y)
        elif fractal_type == "julia":
            c_real = self.params.get("c_real", -0.7)
            c_imag = self.params.get("c_imag", 0.27015)
            return self._julia(max_iter, zoom, center_x, center_y, c_real, c_imag)
        elif fractal_type == "burning_ship":
            return self._burning_ship(max_iter, zoom, center_x, center_y)
        else:
            # Default to Mandelbrot
            return self._mandelbrot(max_iter, zoom, center_x, center_y)

    def _mandelbrot(
        self, max_iter: int, zoom: float, center_x: float, center_y: float
    ) -> np.ndarray:
        """Generate Mandelbrot set."""

        # Define complex plane bounds
        width_bound = 2.0 / zoom
        height_bound = 2.0 / zoom

        # Create coordinate arrays
        x = np.linspace(center_x - width_bound, center_x + width_bound, self.width)
        y = np.linspace(center_y - height_bound, center_y + height_bound, self.height)
        X, Y = np.meshgrid(x, y)

        # Create complex plane
        C = X + 1j * Y
        Z = np.zeros_like(C)

        # Iteration counts
        iterations = np.zeros(C.shape, dtype=int)

        for i in range(max_iter):
            # Calculate next iteration
            mask = np.abs(Z) <= 2
            Z[mask] = Z[mask] ** 2 + C[mask]
            iterations[mask] = i

        # Normalize iterations to 0-1 range for color mapping
        normalized_iterations = iterations / max_iter

        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))

        for i in range(self.height):
            for j in range(self.width):
                t = normalized_iterations[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)

        return rgb_array

    def _julia(
        self,
        max_iter: int,
        zoom: float,
        center_x: float,
        center_y: float,
        c_real: float,
        c_imag: float,
    ) -> np.ndarray:
        """Generate Julia set."""

        # Define complex plane bounds
        width_bound = 2.0 / zoom
        height_bound = 2.0 / zoom

        # Create coordinate arrays
        x = np.linspace(center_x - width_bound, center_x + width_bound, self.width)
        y = np.linspace(center_y - height_bound, center_y + height_bound, self.height)
        X, Y = np.meshgrid(x, y)

        # Create complex plane
        Z = X + 1j * Y
        C = complex(c_real, c_imag)

        # Iteration counts
        iterations = np.zeros(Z.shape, dtype=int)

        for i in range(max_iter):
            # Calculate next iteration
            mask = np.abs(Z) <= 2
            Z[mask] = Z[mask] ** 2 + C
            iterations[mask] = i

        # Normalize iterations to 0-1 range for color mapping
        normalized_iterations = iterations / max_iter

        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))

        for i in range(self.height):
            for j in range(self.width):
                t = normalized_iterations[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)

        return rgb_array

    def _burning_ship(
        self, max_iter: int, zoom: float, center_x: float, center_y: float
    ) -> np.ndarray:
        """Generate Burning Ship fractal."""

        # Define complex plane bounds
        width_bound = 2.0 / zoom
        height_bound = 2.0 / zoom

        # Create coordinate arrays
        x = np.linspace(center_x - width_bound, center_x + width_bound, self.width)
        y = np.linspace(center_y - height_bound, center_y + height_bound, self.height)
        X, Y = np.meshgrid(x, y)

        # Create complex plane
        C = X + 1j * Y
        Z = np.zeros_like(C)

        # Iteration counts
        iterations = np.zeros(C.shape, dtype=int)

        for i in range(max_iter):
            # Calculate next iteration (burning ship variation)
            mask = np.abs(Z) <= 2
            Z[mask] = (np.abs(Z[mask].real) + 1j * np.abs(Z[mask].imag)) ** 2 + C[mask]
            iterations[mask] = i

        # Normalize iterations to 0-1 range for color mapping
        normalized_iterations = iterations / max_iter

        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))

        for i in range(self.height):
            for j in range(self.width):
                t = normalized_iterations[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)

        return rgb_array
