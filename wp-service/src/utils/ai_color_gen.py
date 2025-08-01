"""
AI-powered color generation for unique and creative gradient palettes.
"""

import random
import numpy as np
from typing import List, Tuple, Dict, Optional
from .color_utils import ColorPalette
import colorsys


class AIColorGenerator:
    """Generate unique color palettes using AI-inspired algorithms."""
    
    def __init__(self, seed: Optional[int] = None):
        """Initialize the AI color generator."""
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
    
    def generate_trend_palette(self, trend_type: str = "modern", 
                              num_colors: int = 4) -> List[Tuple[int, int, int]]:
        """Generate colors based on current design trends."""
        
        trend_configs = {
            "modern": {
                "hue_ranges": [(200, 250), (20, 60), (280, 320)],  # Blues, oranges, purples
                "saturation_range": (0.3, 0.8),
                "lightness_range": (0.4, 0.9)
            },
            "vintage": {
                "hue_ranges": [(30, 60), (120, 180), (0, 30)],  # Yellows, teals, reds
                "saturation_range": (0.2, 0.6),
                "lightness_range": (0.3, 0.7)
            },
            "neon": {
                "hue_ranges": [(270, 320), (60, 120), (180, 240)],  # Magentas, limes, cyans
                "saturation_range": (0.8, 1.0),
                "lightness_range": (0.5, 0.8)
            },
            "pastel": {
                "hue_ranges": [(300, 360), (120, 180), (40, 80)],  # Pinks, greens, yellows
                "saturation_range": (0.2, 0.5),
                "lightness_range": (0.7, 0.95)
            },
            "earthy": {
                "hue_ranges": [(20, 60), (80, 120), (300, 340)],  # Browns, greens, purples
                "saturation_range": (0.3, 0.7),
                "lightness_range": (0.2, 0.6)
            }
        }
        
        config = trend_configs.get(trend_type, trend_configs["modern"])
        colors = []
        
        for i in range(num_colors):
            # Select a hue range
            hue_range = random.choice(config["hue_ranges"])
            hue = random.uniform(hue_range[0], hue_range[1]) / 360.0
            
            # Generate saturation and lightness with some variation
            sat_min, sat_max = config["saturation_range"]
            light_min, light_max = config["lightness_range"]
            
            saturation = random.uniform(sat_min, sat_max)
            lightness = random.uniform(light_min, light_max)
            
            # Add some harmonic relationships
            if i > 0:
                # Sometimes create complementary or analogous colors
                relationship = random.choice(["complement", "analogous", "independent"])
                
                if relationship == "complement":
                    hue = (hue + 0.5) % 1.0
                elif relationship == "analogous":
                    base_hue = (colors[0][0] / 255.0) if colors else hue
                    hue = (base_hue + random.uniform(-0.1, 0.1)) % 1.0
            
            # Convert HSL to RGB
            r, g, b = colorsys.hls_to_rgb(hue, lightness, saturation)
            colors.append((int(r * 255), int(g * 255), int(b * 255)))
        
        return colors
    
    def generate_artistic_palette(self, style: str = "impressionist",
                                 num_colors: int = 4) -> List[Tuple[int, int, int]]:
        """Generate colors inspired by artistic movements."""
        
        artistic_styles = {
            "impressionist": {
                "base_colors": [(135, 206, 250), (255, 218, 185), (238, 232, 170), (152, 251, 152)],
                "variation": 0.3
            },
            "abstract": {
                "base_colors": [(255, 0, 0), (0, 0, 255), (255, 255, 0), (0, 255, 0)],
                "variation": 0.4
            },
            "minimalist": {
                "base_colors": [(240, 240, 240), (100, 100, 100), (50, 50, 50), (200, 200, 200)],
                "variation": 0.2
            },
            "surreal": {
                "base_colors": [(255, 20, 147), (0, 255, 255), (255, 165, 0), (138, 43, 226)],
                "variation": 0.5
            },
            "bauhaus": {
                "base_colors": [(255, 0, 0), (255, 255, 0), (0, 0, 255), (0, 0, 0)],
                "variation": 0.1
            }
        }
        
        style_config = artistic_styles.get(style, artistic_styles["impressionist"])
        base_colors = style_config["base_colors"]
        variation = style_config["variation"]
        
        colors = []
        
        for i in range(num_colors):
            if i < len(base_colors):
                base_color = base_colors[i]
            else:
                # Generate additional colors based on existing ones
                base_color = random.choice(colors)
            
            # Add variation to the base color
            r, g, b = base_color
            
            # Convert to HSL for easier manipulation
            h, l, s = colorsys.rgb_to_hls(r/255.0, g/255.0, b/255.0)
            
            # Apply variation
            h = (h + random.uniform(-variation, variation)) % 1.0
            l = max(0, min(1, l + random.uniform(-variation/2, variation/2)))
            s = max(0, min(1, s + random.uniform(-variation/3, variation/3)))
            
            # Convert back to RGB
            r, g, b = colorsys.hls_to_rgb(h, l, s)
            colors.append((int(r * 255), int(g * 255), int(b * 255)))
        
        return colors
    
    def generate_nature_palette(self, season: str = "spring",
                               num_colors: int = 4) -> List[Tuple[int, int, int]]:
        """Generate colors inspired by nature and seasons."""
        
        nature_palettes = {
            "spring": {
                "dominant": [(144, 238, 144), (255, 192, 203), (173, 216, 230)],
                "accent": [(255, 255, 224), (240, 230, 140)]
            },
            "summer": {
                "dominant": [(255, 215, 0), (30, 144, 255), (255, 69, 0)],
                "accent": [(255, 228, 196), (176, 196, 222)]
            },
            "autumn": {
                "dominant": [(255, 140, 0), (139, 69, 19), (255, 215, 0)],
                "accent": [(205, 92, 92), (160, 82, 45)]
            },
            "winter": {
                "dominant": [(176, 224, 230), (230, 230, 250), (119, 136, 153)],
                "accent": [(255, 250, 250), (245, 245, 245)]
            },
            "ocean": {
                "dominant": [(0, 191, 255), (30, 144, 255), (70, 130, 180)],
                "accent": [(176, 224, 230), (240, 248, 255)]
            },
            "forest": {
                "dominant": [(34, 139, 34), (46, 125, 50), (85, 107, 47)],
                "accent": [(144, 238, 144), (250, 240, 230)]
            },
            "desert": {
                "dominant": [(218, 165, 32), (244, 164, 96), (210, 180, 140)],
                "accent": [(255, 228, 181), (253, 245, 230)]
            }
        }
        
        palette_config = nature_palettes.get(season, nature_palettes["spring"])
        dominant_colors = palette_config["dominant"]
        accent_colors = palette_config["accent"]
        
        colors = []
        
        # Choose dominant colors first
        dominant_count = min(num_colors - 1, len(dominant_colors))
        selected_dominant = random.sample(dominant_colors, dominant_count)
        colors.extend(selected_dominant)
        
        # Fill remaining with accent colors
        remaining = num_colors - len(colors)
        if remaining > 0:
            accent_selection = random.choices(accent_colors, k=remaining)
            colors.extend(accent_selection)
        
        # Shuffle for variety
        random.shuffle(colors)
        
        return colors[:num_colors]
    
    def generate_emotion_palette(self, emotion: str = "calm",
                               num_colors: int = 4) -> List[Tuple[int, int, int]]:
        """Generate colors based on emotional associations."""
        
        emotion_configs = {
            "calm": {
                "hue_ranges": [(180, 240), (200, 260)],  # Blues and blue-greens
                "saturation_range": (0.2, 0.5),
                "lightness_range": (0.6, 0.9)
            },
            "energetic": {
                "hue_ranges": [(0, 60), (300, 360)],  # Reds and magentas
                "saturation_range": (0.7, 1.0),
                "lightness_range": (0.4, 0.8)
            },
            "mysterious": {
                "hue_ranges": [(240, 300), (0, 30)],  # Purples and deep reds
                "saturation_range": (0.4, 0.8),
                "lightness_range": (0.1, 0.5)
            },
            "joyful": {
                "hue_ranges": [(40, 80), (280, 320)],  # Yellows and pinks
                "saturation_range": (0.6, 0.9),
                "lightness_range": (0.7, 0.95)
            },
            "elegant": {
                "hue_ranges": [(270, 330), (0, 30)],  # Purples and wines
                "saturation_range": (0.3, 0.7),
                "lightness_range": (0.2, 0.7)
            },
            "fresh": {
                "hue_ranges": [(80, 140), (160, 200)],  # Greens and cyans
                "saturation_range": (0.4, 0.8),
                "lightness_range": (0.5, 0.9)
            }
        }
        
        config = emotion_configs.get(emotion, emotion_configs["calm"])
        return self._generate_from_config(config, num_colors)
    
    def _generate_from_config(self, config: Dict, num_colors: int) -> List[Tuple[int, int, int]]:
        """Generate colors from a configuration dictionary."""
        colors = []
        
        for i in range(num_colors):
            # Select hue range
            hue_range = random.choice(config["hue_ranges"])
            hue = random.uniform(hue_range[0], hue_range[1]) / 360.0
            
            # Generate saturation and lightness
            sat_min, sat_max = config["saturation_range"]
            light_min, light_max = config["lightness_range"]
            
            saturation = random.uniform(sat_min, sat_max)
            lightness = random.uniform(light_min, light_max)
            
            # Convert HSL to RGB
            r, g, b = colorsys.hls_to_rgb(hue, lightness, saturation)
            colors.append((int(r * 255), int(g * 255), int(b * 255)))
        
        return colors
    
    def generate_ai_fusion_palette(self, num_colors: int = 4,
                                  complexity: float = 0.5) -> List[Tuple[int, int, int]]:
        """Generate a completely unique palette using AI-fusion techniques."""
        
        # Create base colors using different algorithms
        base_methods = [
            lambda: self.generate_trend_palette("modern", 2),
            lambda: self.generate_nature_palette("ocean", 2),
            lambda: self.generate_emotion_palette("elegant", 2),
            lambda: self.generate_artistic_palette("impressionist", 2)
        ]
        
        # Select methods based on complexity
        num_methods = min(int(complexity * 4) + 1, len(base_methods))
        selected_methods = random.sample(base_methods, num_methods)
        
        # Generate base colors
        all_colors = []
        for method in selected_methods:
            all_colors.extend(method())
        
        # Use ML-inspired color harmony algorithms
        final_colors = self._harmonize_colors(all_colors, num_colors, complexity)
        
        return final_colors
    
    def _harmonize_colors(self, colors: List[Tuple[int, int, int]], 
                         target_count: int, complexity: float) -> List[Tuple[int, int, int]]:
        """Harmonize colors using ML-inspired algorithms."""
        
        if len(colors) <= target_count:
            return colors[:target_count]
        
        # Convert to HSL for easier manipulation
        hsl_colors = []
        for r, g, b in colors:
            h, l, s = colorsys.rgb_to_hls(r/255.0, g/255.0, b/255.0)
            hsl_colors.append([h, l, s])
        
        # Apply k-means-like clustering
        harmonized = self._cluster_colors(hsl_colors, target_count, complexity)
        
        # Convert back to RGB
        final_colors = []
        for h, l, s in harmonized:
            r, g, b = colorsys.hls_to_rgb(h, l, s)
            final_colors.append((int(r * 255), int(g * 255), int(b * 255)))
        
        return final_colors
    
    def _cluster_colors(self, hsl_colors: List[List[float]], 
                       target_count: int, complexity: float) -> List[List[float]]:
        """Simple clustering algorithm for color harmonization."""
        
        if len(hsl_colors) <= target_count:
            return hsl_colors
        
        # Initialize clusters with k-means++ like approach
        clusters = [hsl_colors[0]]
        
        for _ in range(target_count - 1):
            # Find the color that's furthest from existing clusters
            max_distance = 0
            best_color = None
            
            for color in hsl_colors:
                min_cluster_distance = min(
                    self._color_distance(color, cluster) for cluster in clusters
                )
                if min_cluster_distance > max_distance:
                    max_distance = min_cluster_distance
                    best_color = color
            
            if best_color:
                clusters.append(best_color)
        
        # Refine clusters (simplified)
        for _ in range(3):  # 3 iterations
            new_clusters = []
            
            for cluster in clusters:
                # Find all colors closest to this cluster
                cluster_colors = []
                for color in hsl_colors:
                    closest_cluster = min(clusters, 
                                        key=lambda c: self._color_distance(color, c))
                    if closest_cluster == cluster:
                        cluster_colors.append(color)
                
                if cluster_colors:
                    # Calculate centroid with some artistic bias
                    h_avg = sum(c[0] for c in cluster_colors) / len(cluster_colors)
                    l_avg = sum(c[1] for c in cluster_colors) / len(cluster_colors)
                    s_avg = sum(c[2] for c in cluster_colors) / len(cluster_colors)
                    
                    # Add some creative variation based on complexity
                    h_avg += random.uniform(-complexity * 0.1, complexity * 0.1)
                    l_avg += random.uniform(-complexity * 0.05, complexity * 0.05)
                    s_avg += random.uniform(-complexity * 0.05, complexity * 0.05)
                    
                    # Ensure values are in valid range
                    h_avg = h_avg % 1.0
                    l_avg = max(0, min(1, l_avg))
                    s_avg = max(0, min(1, s_avg))
                    
                    new_clusters.append([h_avg, l_avg, s_avg])
                else:
                    new_clusters.append(cluster)
            
            clusters = new_clusters
        
        return clusters
    
    def _color_distance(self, color1: List[float], color2: List[float]) -> float:
        """Calculate perceptual distance between two HSL colors."""
        # Weighted distance considering human color perception
        dh = min(abs(color1[0] - color2[0]), 1 - abs(color1[0] - color2[0]))
        dl = abs(color1[1] - color2[1])
        ds = abs(color1[2] - color2[2])
        
        # Weight hue differences more heavily
        return (dh * 2.0 + dl + ds) / 4.0


# Integration with existing ColorPalette system
def register_ai_palettes():
    """Register AI-generated palettes with the existing ColorPalette system."""
    
    ai_gen = AIColorGenerator()
    
    # Generate some AI palettes and register them
    ai_palettes = {
        "ai_modern_trend": ai_gen.generate_trend_palette("modern", 4),
        "ai_vintage_trend": ai_gen.generate_trend_palette("vintage", 4),
        "ai_neon_trend": ai_gen.generate_trend_palette("neon", 4),
        "ai_pastel_trend": ai_gen.generate_trend_palette("pastel", 4),
        
        "ai_spring_nature": ai_gen.generate_nature_palette("spring", 4),
        "ai_ocean_nature": ai_gen.generate_nature_palette("ocean", 4),
        "ai_forest_nature": ai_gen.generate_nature_palette("forest", 4),
        
        "ai_calm_emotion": ai_gen.generate_emotion_palette("calm", 4),
        "ai_energetic_emotion": ai_gen.generate_emotion_palette("energetic", 4),
        "ai_elegant_emotion": ai_gen.generate_emotion_palette("elegant", 4),
        
        "ai_fusion_simple": ai_gen.generate_ai_fusion_palette(4, 0.3),
        "ai_fusion_complex": ai_gen.generate_ai_fusion_palette(4, 0.8),
    }
    
    # Add them to ColorPalette (if it supports dynamic addition)
    for name, colors in ai_palettes.items():
        # This would require modifying ColorPalette to support dynamic palettes
        pass
    
    return ai_palettes