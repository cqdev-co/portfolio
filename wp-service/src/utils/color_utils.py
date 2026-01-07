"""
Color utilities and palette definitions.
"""

from typing import List, Tuple, Dict
import colorsys
import numpy as np


class ColorPalette:
    """Predefined color palettes for gradient generation."""

    _PALETTES = {
        # OpenAI inspired palettes
        "openai_blue": [
            (30, 58, 138),  # Deep blue
            (59, 130, 246),  # Blue
            (6, 182, 212),  # Cyan
        ],
        "openai_purple": [
            (124, 58, 237),  # Purple
            (168, 85, 247),  # Light purple
            (217, 70, 239),  # Pink
        ],
        "neural_flow": [
            (15, 23, 42),  # Dark slate
            (30, 58, 138),  # Deep blue
            (59, 130, 246),  # Blue
            (6, 182, 212),  # Cyan
            (34, 197, 94),  # Green
        ],
        # Classic gradients
        "sunset": [
            (255, 94, 77),  # Red
            (255, 154, 0),  # Orange
            (255, 206, 84),  # Yellow
        ],
        "ocean": [
            (13, 51, 108),  # Deep blue
            (30, 130, 180),  # Blue
            (52, 168, 200),  # Light blue
            (144, 224, 239),  # Cyan
        ],
        "forest": [
            (25, 41, 28),  # Dark green
            (34, 68, 34),  # Forest green
            (52, 120, 52),  # Green
            (104, 191, 104),  # Light green
        ],
        "cosmic": [
            (25, 25, 112),  # Midnight blue
            (72, 61, 139),  # Dark slate blue
            (138, 43, 226),  # Blue violet
            (147, 0, 211),  # Dark violet
        ],
        # Monochromatic
        "grayscale": [
            (20, 20, 20),  # Dark gray
            (128, 128, 128),  # Gray
            (240, 240, 240),  # Light gray
        ],
        "warm_gray": [
            (41, 37, 36),  # Dark warm gray
            (120, 113, 108),  # Warm gray
            (231, 229, 228),  # Light warm gray
        ],
        # Vibrant
        "neon": [
            (255, 0, 150),  # Hot pink
            (0, 255, 255),  # Cyan
            (150, 255, 0),  # Lime
        ],
        "fire": [
            (139, 0, 0),  # Dark red
            (255, 69, 0),  # Red orange
            (255, 140, 0),  # Dark orange
            (255, 215, 0),  # Gold
        ],
        # Earth tones
        "earth": [
            (101, 67, 33),  # Brown
            (139, 115, 85),  # Tan
            (205, 183, 158),  # Beige
            (222, 184, 135),  # Burlywood
        ],
        # Tech/Cyber
        "matrix": [
            (0, 0, 0),  # Black
            (0, 50, 0),  # Dark green
            (0, 150, 0),  # Green
            (50, 255, 50),  # Bright green
        ],
        "cyber": [
            (10, 10, 40),  # Dark blue
            (0, 255, 255),  # Cyan
            (255, 0, 255),  # Magenta
            (255, 255, 0),  # Yellow
        ],
    }

    @classmethod
    def get_palette(cls, name: str) -> List[Tuple[int, int, int]]:
        """Get a color palette by name."""
        if name not in cls._PALETTES:
            raise ValueError(f"Unknown palette: {name}")
        return cls._PALETTES[name].copy()

    @classmethod
    def list_palettes(cls) -> List[str]:
        """List all available palette names."""
        return list(cls._PALETTES.keys())

    @classmethod
    def add_palette(cls, name: str, colors: List[Tuple[int, int, int]]) -> None:
        """Add a custom palette."""
        cls._PALETTES[name] = colors

    @classmethod
    def create_gradient_palette(
        cls,
        start_color: Tuple[int, int, int],
        end_color: Tuple[int, int, int],
        steps: int = 5,
    ) -> List[Tuple[int, int, int]]:
        """Create a gradient palette between two colors."""
        colors = []
        start = np.array(start_color)
        end = np.array(end_color)

        for i in range(steps):
            t = i / (steps - 1) if steps > 1 else 0
            color = start + t * (end - start)
            colors.append(tuple(color.astype(int)))

        return colors

    @classmethod
    def create_analogous_palette(
        cls, base_color: Tuple[int, int, int], count: int = 5, spread: float = 30.0
    ) -> List[Tuple[int, int, int]]:
        """Create an analogous color palette from a base color."""
        # Convert RGB to HSV
        r, g, b = [c / 255.0 for c in base_color]
        h, s, v = colorsys.rgb_to_hsv(r, g, b)

        colors = []
        spread_rad = spread / 360.0  # Convert degrees to 0-1 range

        for i in range(count):
            # Create hue variations around the base
            offset = (i - count // 2) * spread_rad / count
            new_h = (h + offset) % 1.0

            # Convert back to RGB
            new_r, new_g, new_b = colorsys.hsv_to_rgb(new_h, s, v)
            rgb = (int(new_r * 255), int(new_g * 255), int(new_b * 255))
            colors.append(rgb)

        return colors

    @classmethod
    def create_complementary_palette(
        cls, base_color: Tuple[int, int, int]
    ) -> List[Tuple[int, int, int]]:
        """Create a complementary color palette."""
        r, g, b = [c / 255.0 for c in base_color]
        h, s, v = colorsys.rgb_to_hsv(r, g, b)

        # Original color
        colors = [base_color]

        # Complementary color (180 degrees opposite)
        comp_h = (h + 0.5) % 1.0
        comp_r, comp_g, comp_b = colorsys.hsv_to_rgb(comp_h, s, v)
        comp_color = (int(comp_r * 255), int(comp_g * 255), int(comp_b * 255))
        colors.append(comp_color)

        # Add lighter and darker versions
        for brightness in [0.3, 0.7]:
            light_r, light_g, light_b = colorsys.hsv_to_rgb(h, s, brightness)
            light_color = (int(light_r * 255), int(light_g * 255), int(light_b * 255))
            colors.append(light_color)

        return colors

    @classmethod
    def hex_to_rgb(cls, hex_color: str) -> Tuple[int, int, int]:
        """Convert hex color to RGB tuple."""
        hex_color = hex_color.lstrip("#")
        if len(hex_color) != 6:
            raise ValueError("Invalid hex color format")

        try:
            return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
        except ValueError:
            raise ValueError("Invalid hex color format")

    @classmethod
    def rgb_to_hex(cls, rgb_color: Tuple[int, int, int]) -> str:
        """Convert RGB tuple to hex color."""
        return "#{:02x}{:02x}{:02x}".format(*rgb_color)
