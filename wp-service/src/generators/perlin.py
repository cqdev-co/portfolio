"""
Perlin noise gradient generator.
"""

import numpy as np

from ..core.base import BaseGenerator


class PerlinNoiseGenerator(BaseGenerator):
    """Generate gradients using Perlin noise."""

    def __init__(
        self, width: int, height: int, colors: list[tuple[int, int, int]], **params
    ):
        super().__init__(width, height, colors, **params)

        # Initialize permutation table for Perlin noise
        self.p = self._init_permutation_table()

    def _init_permutation_table(self) -> np.ndarray:
        """Initialize the permutation table for Perlin noise."""
        seed = self.params.get("seed", 42)
        np.random.seed(seed)

        p = np.arange(256)
        np.random.shuffle(p)

        # Duplicate the permutation table
        return np.concatenate([p, p])

    def _fade(self, t: np.ndarray) -> np.ndarray:
        """Fade function for smooth interpolation."""
        return t * t * t * (t * (t * 6 - 15) + 10)

    def _lerp(self, t: np.ndarray, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        """Linear interpolation."""
        return a + t * (b - a)

    def _grad(self, hash_val: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        """Gradient function."""
        h = hash_val & 3
        u = np.where(h < 2, x, y)
        v = np.where(h < 2, y, x)
        return np.where(h & 1, -u, u) + np.where(h & 2, -v, v)

    def _noise(self, x: np.ndarray, y: np.ndarray) -> np.ndarray:
        """Generate Perlin noise."""
        # Calculate grid cell coordinates
        X = np.floor(x).astype(int) & 255
        Y = np.floor(y).astype(int) & 255

        # Calculate relative coordinates within cell
        x -= np.floor(x)
        y -= np.floor(y)

        # Apply fade function
        u = self._fade(x)
        v = self._fade(y)

        # Hash coordinates of corners
        aa = self.p[self.p[X] + Y]
        ab = self.p[self.p[X] + Y + 1]
        ba = self.p[self.p[X + 1] + Y]
        bb = self.p[self.p[X + 1] + Y + 1]

        # Calculate gradients
        grad_aa = self._grad(aa, x, y)
        grad_ba = self._grad(ba, x - 1, y)
        grad_ab = self._grad(ab, x, y - 1)
        grad_bb = self._grad(bb, x - 1, y - 1)

        # Interpolate
        lerp1 = self._lerp(u, grad_aa, grad_ba)
        lerp2 = self._lerp(u, grad_ab, grad_bb)

        return self._lerp(v, lerp1, lerp2)

    def generate(self) -> np.ndarray:
        """Generate a Perlin noise gradient."""

        # Parameters
        scale = self.params.get("scale", 8.0)  # Noise scale
        octaves = self.params.get("octaves", 4)  # Number of octaves
        persistence = self.params.get("persistence", 0.5)  # Amplitude persistence
        lacunarity = self.params.get("lacunarity", 2.0)  # Frequency lacunarity

        # Create coordinate arrays
        x = np.linspace(0, scale, self.width)
        y = np.linspace(0, scale, self.height)
        X, Y = np.meshgrid(x, y)

        # Generate noise with multiple octaves
        noise_values = np.zeros_like(X)
        amplitude = 1.0
        frequency = 1.0
        max_amplitude = 0.0

        for _ in range(octaves):
            noise_values += amplitude * self._noise(X * frequency, Y * frequency)
            max_amplitude += amplitude
            amplitude *= persistence
            frequency *= lacunarity

        # Normalize to 0-1 range
        noise_values /= max_amplitude
        noise_values = (noise_values + 1) / 2  # Convert from [-1,1] to [0,1]
        noise_values = np.clip(noise_values, 0, 1)

        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))

        for i in range(self.height):
            for j in range(self.width):
                t = noise_values[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)

        return rgb_array
