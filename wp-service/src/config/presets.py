"""
Gradient preset definitions.
"""

from typing import Any

from ..utils.color_utils import ColorPalette


class GradientPreset:
    """Manage gradient presets."""

    _PRESETS = {
        # Neural/Tech Category
        "Neural Flow": {
            "name": "Neural Flow",
            "category": "neural",
            "type": "perlin",
            "colors": ColorPalette.get_palette("neural_flow"),
            "params": {
                "scale": 6.0,
                "octaves": 4,
                "persistence": 0.5,
                "lacunarity": 2.0,
                "seed": 42,
            },
        },
        "Quantum Waves": {
            "name": "Quantum Waves",
            "category": "neural",
            "type": "wave",
            "colors": ColorPalette.get_palette("openai_blue"),
            "params": {
                "wave_type": "interference",
                "num_sources": 4,
                "frequency": 2.0,
                "amplitude": 1.0,
                "seed": 123,
            },
        },
        "Data Streams": {
            "name": "Data Streams",
            "category": "neural",
            "type": "linear",
            "colors": ColorPalette.get_palette("cyber"),
            "params": {"angle": 45, "center_x": 0.3, "center_y": 0.7},
        },
        # Classic Category
        "Ocean Depths": {
            "name": "Ocean Depths",
            "category": "classic",
            "type": "radial",
            "colors": ColorPalette.get_palette("ocean"),
            "params": {
                "center_x": 0.5,
                "center_y": 0.6,
                "inner_radius": 0.0,
                "outer_radius": 1.2,
                "ellipse_ratio": 0.8,
            },
        },
        "Sunset Ridge": {
            "name": "Sunset Ridge",
            "category": "classic",
            "type": "linear",
            "colors": ColorPalette.get_palette("sunset"),
            "params": {"angle": 135, "center_x": 0.5, "center_y": 0.5},
        },
        "Forest Canopy": {
            "name": "Forest Canopy",
            "category": "classic",
            "type": "perlin",
            "colors": ColorPalette.get_palette("forest"),
            "params": {
                "scale": 4.0,
                "octaves": 3,
                "persistence": 0.6,
                "lacunarity": 1.8,
                "seed": 789,
            },
        },
        # Fractal Category
        "Mandelbrot Classic": {
            "name": "Mandelbrot Classic",
            "category": "fractal",
            "type": "fractal",
            "colors": ColorPalette.get_palette("cosmic"),
            "params": {
                "type": "mandelbrot",
                "max_iter": 100,
                "zoom": 1.0,
                "center_x": -0.5,
                "center_y": 0.0,
            },
        },
        "Julia Dreams": {
            "name": "Julia Dreams",
            "category": "fractal",
            "type": "fractal",
            "colors": ColorPalette.get_palette("openai_purple"),
            "params": {
                "type": "julia",
                "max_iter": 80,
                "zoom": 1.0,
                "center_x": 0.0,
                "center_y": 0.0,
                "c_real": -0.7,
                "c_imag": 0.27015,
            },
        },
        "Burning Ship": {
            "name": "Burning Ship",
            "category": "fractal",
            "type": "fractal",
            "colors": ColorPalette.get_palette("fire"),
            "params": {
                "type": "burning_ship",
                "max_iter": 120,
                "zoom": 1.0,
                "center_x": -1.8,
                "center_y": -0.08,
            },
        },
        # Wave Category
        "Ripple Effect": {
            "name": "Ripple Effect",
            "category": "wave",
            "type": "wave",
            "colors": ColorPalette.get_palette("ocean"),
            "params": {
                "wave_type": "interference",
                "num_sources": 2,
                "frequency": 3.0,
                "amplitude": 0.8,
                "seed": 456,
            },
        },
        "Sunset Spiral": {
            "name": "Sunset Spiral",
            "category": "wave",
            "type": "wave",
            "colors": ColorPalette.get_palette("sunset"),
            "params": {
                "wave_type": "spiral",
                "frequency": 8.0,
                "spiral_tightness": 4.0,
                "center_x": 0.5,
                "center_y": 0.5,
                "clockwise": True,
            },
        },
        "Frequency Bands": {
            "name": "Frequency Bands",
            "category": "wave",
            "type": "wave",
            "colors": ColorPalette.get_palette("neon"),
            "params": {
                "wave_type": "cylindrical",
                "frequency": 5.0,
                "axis": "horizontal",
                "center": 0.5,
            },
        },
        # Geometric Category
        "Radial Burst": {
            "name": "Radial Burst",
            "category": "geometric",
            "type": "radial",
            "colors": ColorPalette.get_palette("fire"),
            "params": {
                "center_x": 0.5,
                "center_y": 0.5,
                "inner_radius": 0.1,
                "outer_radius": 0.9,
                "ellipse_ratio": 1.0,
            },
        },
        "Linear Fade": {
            "name": "Linear Fade",
            "category": "geometric",
            "type": "linear",
            "colors": ColorPalette.get_palette("grayscale"),
            "params": {"angle": 90, "center_x": 0.5, "center_y": 0.5},
        },
        "Diagonal Flow": {
            "name": "Diagonal Flow",
            "category": "geometric",
            "type": "linear",
            "colors": ColorPalette.get_palette("openai_blue"),
            "params": {"angle": 45, "center_x": 0.5, "center_y": 0.5},
        },
        # Organic/Glass Category
        "Glass Morph": {
            "name": "Glass Morph",
            "category": "organic",
            "type": "glass",
            "colors": ColorPalette.get_palette("openai_blue"),
            "params": {
                "layers": 4,
                "reflection": 0.15,
                "distortion": 0.08,
                "highlights": 0.25,
                "angle": 35,
            },
        },
        "Organic Flow": {
            "name": "Organic Flow",
            "category": "organic",
            "type": "organic",
            "colors": ColorPalette.get_palette("neural_flow"),
            "params": {
                "smoothness": 4.0,
                "flow_strength": 0.25,
                "grain_intensity": 0.03,
                "blend_mode": "soft",
                "angle": 60,
            },
        },
        "Fluid Dreams": {
            "name": "Fluid Dreams",
            "category": "organic",
            "type": "fluid",
            "colors": ColorPalette.get_palette("openai_purple"),
            "params": {"complexity": 3.0, "smoothness": 5.0, "bleeding": 0.4},
        },
        "Glossy Teal": {
            "name": "Glossy Teal",
            "category": "organic",
            "type": "glass",
            "colors": [(6, 182, 212), (34, 197, 94), (59, 130, 246)],
            "params": {
                "layers": 3,
                "reflection": 0.2,
                "distortion": 0.05,
                "highlights": 0.35,
                "angle": 120,
            },
        },
        "Smooth Sunrise": {
            "name": "Smooth Sunrise",
            "category": "organic",
            "type": "organic",
            "colors": [(255, 206, 84), (255, 154, 0), (255, 94, 77)],
            "params": {
                "smoothness": 6.0,
                "flow_strength": 0.2,
                "grain_intensity": 0.02,
                "angle": 145,
            },
        },
        "Crystal Blue": {
            "name": "Crystal Blue",
            "category": "organic",
            "type": "glass",
            "colors": [(30, 58, 138), (59, 130, 246), (147, 197, 253)],
            "params": {
                "layers": 5,
                "reflection": 0.25,
                "distortion": 0.12,
                "highlights": 0.4,
                "angle": 90,
            },
        },
        "Velvet Purple": {
            "name": "Velvet Purple",
            "category": "organic",
            "type": "fluid",
            "colors": [(124, 58, 237), (168, 85, 247), (196, 181, 253)],
            "params": {"complexity": 2.5, "smoothness": 6.0, "bleeding": 0.3},
        },
        "Soft Emerald": {
            "name": "Soft Emerald",
            "category": "organic",
            "type": "organic",
            "colors": [(5, 150, 105), (34, 197, 94), (134, 239, 172)],
            "params": {
                "smoothness": 5.0,
                "flow_strength": 0.15,
                "grain_intensity": 0.025,
                "angle": 75,
            },
        },
        # Premium Grainy Category - Professional Quality
        "Grainy Sunset": {
            "name": "Grainy Sunset",
            "category": "premium_grainy",
            "type": "glass",
            "colors": [(255, 94, 77), (255, 154, 0), (255, 206, 84), (255, 236, 179)],
            "params": {
                "layers": 4,
                "reflection": 0.15,
                "distortion": 0.08,
                "highlights": 0.3,
                "angle": 135,
                "grain_intensity": 0.04,
                "grain_type": "photographic",
            },
        },
        "Ocean Grain": {
            "name": "Ocean Grain",
            "category": "premium_grainy",
            "type": "organic",
            "colors": [(30, 58, 138), (59, 130, 246), (147, 197, 253), (219, 234, 254)],
            "params": {
                "smoothness": 6.0,
                "flow_strength": 0.25,
                "grain_intensity": 0.035,
                "grain_type": "film",
                "angle": 90,
            },
        },
        "Frosted Glass": {
            "name": "Frosted Glass",
            "category": "premium_grainy",
            "type": "glass",
            "colors": [
                (239, 246, 255),
                (199, 210, 254),
                (129, 140, 248),
                (79, 70, 229),
            ],
            "params": {
                "layers": 5,
                "reflection": 0.3,
                "distortion": 0.12,
                "highlights": 0.45,
                "angle": 45,
                "grain_intensity": 0.025,
                "grain_type": "artistic",
            },
        },
        "Coral Dream": {
            "name": "Coral Dream",
            "category": "premium_grainy",
            "type": "fluid",
            "colors": [
                (252, 165, 165),
                (254, 202, 202),
                (255, 228, 230),
                (255, 242, 242),
            ],
            "params": {
                "complexity": 3.5,
                "smoothness": 7.0,
                "bleeding": 0.2,
                "grain_intensity": 0.03,
                "grain_type": "photographic",
            },
        },
        "Mint Mist": {
            "name": "Mint Mist",
            "category": "premium_grainy",
            "type": "organic",
            "colors": [
                (209, 250, 229),
                (167, 243, 208),
                (110, 231, 183),
                (52, 211, 153),
            ],
            "params": {
                "smoothness": 8.0,
                "flow_strength": 0.18,
                "grain_intensity": 0.028,
                "grain_type": "photographic",
                "angle": 160,
            },
        },
        "Purple Haze": {
            "name": "Purple Haze",
            "category": "premium_grainy",
            "type": "glass",
            "colors": [(196, 181, 253), (168, 85, 247), (124, 58, 237), (88, 28, 135)],
            "params": {
                "layers": 4,
                "reflection": 0.2,
                "distortion": 0.1,
                "highlights": 0.35,
                "angle": 110,
                "grain_intensity": 0.04,
                "grain_type": "film",
            },
        },
        "Golden Hour": {
            "name": "Golden Hour",
            "category": "premium_grainy",
            "type": "organic",
            "colors": [(254, 243, 199), (253, 224, 71), (245, 158, 11), (217, 119, 6)],
            "params": {
                "smoothness": 5.5,
                "flow_strength": 0.22,
                "grain_intensity": 0.038,
                "grain_type": "artistic",
                "angle": 125,
            },
        },
        "Ice Crystal": {
            "name": "Ice Crystal",
            "category": "premium_grainy",
            "type": "glass",
            "colors": [
                (248, 250, 252),
                (226, 232, 240),
                (160, 174, 192),
                (100, 116, 139),
            ],
            "params": {
                "layers": 6,
                "reflection": 0.4,
                "distortion": 0.15,
                "highlights": 0.5,
                "angle": 75,
                "grain_intensity": 0.02,
                "grain_type": "photographic",
            },
        },
        "Rose Gold": {
            "name": "Rose Gold",
            "category": "premium_grainy",
            "type": "fluid",
            "colors": [(251, 207, 232), (244, 114, 182), (236, 72, 153), (190, 24, 93)],
            "params": {
                "complexity": 2.8,
                "smoothness": 6.5,
                "bleeding": 0.25,
                "grain_intensity": 0.032,
                "grain_type": "film",
            },
        },
        "Ethereal Blue": {
            "name": "Ethereal Blue",
            "category": "premium_grainy",
            "type": "organic",
            "colors": [
                (240, 249, 255),
                (186, 230, 253),
                (125, 211, 252),
                (56, 189, 248),
            ],
            "params": {
                "smoothness": 7.5,
                "flow_strength": 0.2,
                "grain_intensity": 0.03,
                "grain_type": "photographic",
                "angle": 95,
            },
        },
    }

    @classmethod
    def get_preset(cls, name: str) -> dict[str, Any]:
        """Get a preset by name."""
        if name not in cls._PRESETS:
            raise ValueError(f"Unknown preset: {name}")
        return cls._PRESETS[name].copy()

    @classmethod
    def list_presets(cls) -> list[str]:
        """List all preset names."""
        return list(cls._PRESETS.keys())

    @classmethod
    def get_preset_by_category(cls, category: str) -> list[str]:
        """Get presets by category."""
        return [
            name
            for name, preset in cls._PRESETS.items()
            if preset.get("category") == category
        ]

    @classmethod
    def add_preset(cls, name: str, preset_data: dict[str, Any]) -> None:
        """Add a custom preset."""
        cls._PRESETS[name] = preset_data

    @classmethod
    def get_categories(cls) -> list[str]:
        """Get all available categories."""
        categories = set()
        for preset in cls._PRESETS.values():
            if "category" in preset:
                categories.add(preset["category"])
        return sorted(list(categories))
