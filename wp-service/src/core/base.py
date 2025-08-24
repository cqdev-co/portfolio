"""
Base classes and enums for the gradient generator.
"""

from enum import Enum
from typing import List, Tuple, Dict
from abc import ABC, abstractmethod
import numpy as np
from PIL import Image


class GradientType(Enum):
    """Supported gradient types."""
    LINEAR = "linear"
    RADIAL = "radial"
    PERLIN = "perlin"
    FRACTAL = "fractal"
    WAVE = "wave"
    ORGANIC = "organic"
    GLASS = "glass"
    FLUID = "fluid"


class Resolution:
    """Common resolution definitions."""
    
    _RESOLUTIONS = {
        "4k": (3840, 2160),
        "1440p": (2560, 1440),
        "1080p": (1920, 1080),
        "720p": (1280, 720),
        "mobile": (1080, 1920),
        "tablet": (2048, 1536),
        "laptop": (1366, 768),
        "ultrawide": (3440, 1440),
        "square": (1080, 1080),
        "social": (1200, 630),  # Social media/blog headers (1.9:1 ratio)
        "banner": (1200, 400),  # Wide banner format (3:1 ratio)
        "card": (800, 600),     # Card/thumbnail format (4:3 ratio)
    }
    
    @classmethod
    def get_all(cls) -> Dict[str, Tuple[int, int]]:
        """Get all available resolutions."""
        return cls._RESOLUTIONS.copy()
    
    @classmethod
    def get(cls, name: str) -> Tuple[int, int]:
        """Get resolution by name."""
        if name not in cls._RESOLUTIONS:
            raise ValueError(f"Unknown resolution: {name}")
        return cls._RESOLUTIONS[name]
    
    @classmethod
    def list_names(cls) -> List[str]:
        """List all resolution names."""
        return list(cls._RESOLUTIONS.keys())


class BaseGenerator(ABC):
    """Base class for all gradient generators."""
    
    def __init__(self, width: int, height: int, colors: List[Tuple[int, int, int]], **params):
        """
        Initialize the generator.
        
        Args:
            width: Image width in pixels
            height: Image height in pixels  
            colors: List of RGB color tuples
            **params: Additional parameters specific to each generator
        """
        self.width = width
        self.height = height
        self.colors = colors
        self.params = params
        
        # Validate inputs
        if width <= 0 or height <= 0:
            raise ValueError("Width and height must be positive")
        if len(colors) < 2:
            raise ValueError("At least 2 colors are required")
        for color in colors:
            if not all(0 <= c <= 255 for c in color):
                raise ValueError(f"Invalid color values: {color}")
    
    @abstractmethod
    def generate(self) -> np.ndarray:
        """
        Generate the gradient as a numpy array.
        
        Returns:
            numpy.ndarray: RGB array of shape (height, width, 3)
        """
        pass
    
    def save(self, filename: str, quality: int = 95) -> None:
        """
        Save the gradient to a file.
        
        Args:
            filename: Output filename
            quality: JPEG quality (ignored for PNG)
        """
        gradient_array = self.generate()
        
        # Ensure values are in valid range
        gradient_array = np.clip(gradient_array, 0, 255).astype(np.uint8)
        
        # Create PIL Image
        image = Image.fromarray(gradient_array, 'RGB')
        
        # Save with appropriate format
        if filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
            image.save(filename, 'JPEG', quality=quality, optimize=True)
        else:
            image.save(filename, 'PNG', optimize=True)
    
    def to_image(self) -> Image.Image:
        """
        Convert gradient to PIL Image.
        
        Returns:
            PIL.Image.Image: The gradient as a PIL Image
        """
        gradient_array = self.generate()
        gradient_array = np.clip(gradient_array, 0, 255).astype(np.uint8)
        return Image.fromarray(gradient_array, 'RGB')
    
    def interpolate_colors(self, t: float) -> Tuple[int, int, int]:
        """
        Interpolate between colors based on parameter t.
        
        Args:
            t: Interpolation parameter (0.0 to 1.0)
            
        Returns:
            Tuple[int, int, int]: RGB color tuple
        """
        # Clamp t to [0, 1]
        t = max(0.0, min(1.0, t))
        
        if len(self.colors) == 1:
            return self.colors[0]
        
        # Scale t to color segments
        segment = t * (len(self.colors) - 1)
        segment_idx = int(segment)
        segment_t = segment - segment_idx
        
        # Handle edge case
        if segment_idx >= len(self.colors) - 1:
            return self.colors[-1]
        
        # Linear interpolation between two colors
        color1 = np.array(self.colors[segment_idx])
        color2 = np.array(self.colors[segment_idx + 1])
        
        interpolated = color1 + segment_t * (color2 - color1)
        return tuple(interpolated.astype(int))
    
    def apply_smoothing(self, array: np.ndarray, sigma: float = 1.0) -> np.ndarray:
        """
        Apply Gaussian smoothing to the gradient.
        
        Args:
            array: Input array
            sigma: Gaussian sigma parameter
            
        Returns:
            numpy.ndarray: Smoothed array
        """
        from scipy.ndimage import gaussian_filter
        
        # Apply smoothing to each color channel
        smoothed = np.zeros_like(array)
        for i in range(3):
            smoothed[:, :, i] = gaussian_filter(array[:, :, i], sigma=sigma)
        
        return smoothed
    
    def gamma_correct_interpolate(self, t: float) -> Tuple[int, int, int]:
        """
        Gamma-correct color interpolation for professional quality.
        
        Args:
            t: Interpolation parameter (0.0 to 1.0)
            
        Returns:
            Tuple[int, int, int]: Gamma-corrected RGB color tuple
        """
        # Clamp t to [0, 1]
        t = max(0.0, min(1.0, t))
        
        if len(self.colors) == 1:
            return self.colors[0]
        
        # Convert to linear color space (gamma = 2.2)
        linear_colors = []
        for color in self.colors:
            linear_color = [(c / 255.0) ** 2.2 for c in color]
            linear_colors.append(linear_color)
        
        # Scale t to color segments
        segment = t * (len(linear_colors) - 1)
        segment_idx = int(segment)
        segment_t = segment - segment_idx
        
        # Handle edge case
        if segment_idx >= len(linear_colors) - 1:
            final_color = linear_colors[-1]
        else:
            # Linear interpolation in linear space
            color1 = np.array(linear_colors[segment_idx])
            color2 = np.array(linear_colors[segment_idx + 1])
            final_color = color1 + segment_t * (color2 - color1)
        
        # Convert back to sRGB space (gamma correction)
        srgb_color = [c ** (1.0/2.2) for c in final_color]
        return tuple(int(c * 255) for c in srgb_color)
    
    def apply_dithering(self, array: np.ndarray, intensity: float = 0.5) -> np.ndarray:
        """
        Add subtle dithering to prevent color banding.
        
        Args:
            array: Input gradient array
            intensity: Dithering intensity
            
        Returns:
            numpy.ndarray: Dithered array
        """
        # Create noise pattern
        noise = np.random.normal(0, intensity, array.shape)
        
        # Apply triangular dithering for better distribution
        noise = noise + np.random.normal(0, intensity * 0.5, array.shape)
        noise = noise / 2.0
        
        # Apply dithering
        dithered = array + noise
        return np.clip(dithered, 0, 255)
    
    def optimize_for_web(self, array: np.ndarray, target_format: str = "jpg") -> np.ndarray:
        """
        Optimize gradient for web display based on real-world usage patterns.
        
        Args:
            array: Input gradient array
            target_format: Target format (jpg, png)
            
        Returns:
            numpy.ndarray: Web-optimized array
        """
        optimized = array.copy()
        
        # Web-specific optimizations learned from frontend testing
        if target_format.lower() in ['jpg', 'jpeg']:
            # JPG compression optimizations
            # Slightly increase contrast for better compression
            optimized = optimized * 1.02
            optimized = np.clip(optimized, 0, 255)
            
            # Add minimal sharpening to counteract JPEG softening
            from scipy.ndimage import gaussian_filter
            blurred = gaussian_filter(optimized, sigma=0.5)
            optimized = optimized + 0.1 * (optimized - blurred)
            optimized = np.clip(optimized, 0, 255)
        
        # Container fitting optimizations (based on frontend experience)
        aspect_ratio = self.width / self.height
        
        # For common web aspect ratios, ensure gradients work well with object-contain
        if 1.8 <= aspect_ratio <= 2.1:  # Social/header aspect ratios
            # Ensure edges are visually interesting for container fitting
            self._enhance_edge_definition(optimized)
        
        return optimized
    
    def _enhance_edge_definition(self, array: np.ndarray) -> None:
        """
        Enhance edge definition for better container fitting.
        Modifies array in-place.
        """
        height, width = array.shape[:2]
        
        # Create subtle vignette to ensure edges are visually defined
        y, x = np.ogrid[:height, :width]
        center_x, center_y = width // 2, height // 2
        
        # Distance from center, normalized
        distance = np.sqrt((x - center_x)**2 + (y - center_y)**2)
        max_distance = np.sqrt(center_x**2 + center_y**2)
        distance_norm = distance / max_distance
        
        # Very subtle vignette (only 5% effect)
        vignette = 1.0 - (distance_norm * 0.05)
        
        # Apply to all channels
        for channel in range(array.shape[2]):
            array[:, :, channel] *= vignette