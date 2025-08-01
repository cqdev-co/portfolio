"""
Organic gradient generators for smooth, glass-like effects.
"""

import numpy as np
from typing import List, Tuple
from ..core.base import BaseGenerator
from scipy.ndimage import gaussian_filter
from scipy import ndimage


class OrganicGradientGenerator(BaseGenerator):
    """Generate smooth, organic gradients with glass-like quality."""
    
    def generate(self) -> np.ndarray:
        """Generate an organic gradient."""
        
        # Parameters
        smoothness = self.params.get('smoothness', 3.0)
        flow_strength = self.params.get('flow_strength', 0.3)
        grain_intensity = self.params.get('grain_intensity', 0.05)
        blend_mode = self.params.get('blend_mode', 'soft')
        
        # Create base flow field using multiple octaves of noise
        flow_field = self._create_flow_field(flow_strength)
        
        # Create smooth color transitions
        gradient_base = self._create_base_gradient(flow_field)
        
        # Apply smoothing for glass-like quality
        gradient_smooth = self._apply_smoothing(gradient_base, smoothness)
        
        # Add subtle grain texture
        gradient_final = self._add_grain(gradient_smooth, grain_intensity)
        
        return gradient_final
    
    def _create_flow_field(self, strength: float) -> np.ndarray:
        """Create organic flow field for natural movement."""
        
        # Create multiple noise layers for organic flow
        x = np.linspace(0, 4, self.width)
        y = np.linspace(0, 4, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Base flow - large scale movement
        flow1 = np.sin(X * 0.8) * np.cos(Y * 0.6)
        flow2 = np.cos(X * 0.5) * np.sin(Y * 0.9)
        
        # Secondary flow - medium scale detail
        flow3 = np.sin(X * 1.5 + np.pi/3) * np.cos(Y * 1.2 + np.pi/4)
        flow4 = np.cos(X * 1.8 + np.pi/6) * np.sin(Y * 1.4 + np.pi/2)
        
        # Combine flows with different weights
        combined_flow = (
            0.4 * flow1 + 0.3 * flow2 + 
            0.2 * flow3 + 0.1 * flow4
        )
        
        # Apply strength and normalize
        flow_field = strength * combined_flow
        return flow_field
    
    def _create_base_gradient(self, flow_field: np.ndarray) -> np.ndarray:
        """Create base gradient with organic flow."""
        
        # Create coordinate arrays
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Base gradient direction with organic distortion
        base_angle = self.params.get('angle', 45)
        angle_rad = np.radians(base_angle)
        
        # Apply flow field distortion
        distorted_coords = (
            X * np.cos(angle_rad) + Y * np.sin(angle_rad) + 
            flow_field * 0.3
        )
        
        # Normalize to 0-1 range
        gradient_values = distorted_coords
        gradient_values = (gradient_values - gradient_values.min()) / (gradient_values.max() - gradient_values.min())
        
        # Apply easing for smoother transitions
        gradient_values = self._apply_easing(gradient_values)
        
        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))
        
        for i in range(self.height):
            for j in range(self.width):
                t = gradient_values[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)
        
        return rgb_array
    
    def _apply_easing(self, values: np.ndarray) -> np.ndarray:
        """Apply smooth easing for organic transitions."""
        # Smoothstep function for natural curves
        return values * values * (3.0 - 2.0 * values)
    
    def _apply_smoothing(self, gradient: np.ndarray, smoothness: float) -> np.ndarray:
        """Apply Gaussian smoothing for glass-like quality."""
        smoothed = np.zeros_like(gradient)
        
        for channel in range(3):
            smoothed[:, :, channel] = gaussian_filter(
                gradient[:, :, channel], 
                sigma=smoothness, 
                mode='reflect'
            )
        
        return smoothed
    
    def _add_grain(self, gradient: np.ndarray, intensity: float) -> np.ndarray:
        """Add sophisticated grain texture with multiple types."""
        if intensity <= 0:
            return gradient
        
        grain_type = self.params.get('grain_type', 'photographic')
        
        if grain_type == 'film':
            return self._add_film_grain(gradient, intensity)
        elif grain_type == 'photographic':
            return self._add_photographic_grain(gradient, intensity)
        elif grain_type == 'digital':
            return self._add_digital_noise(gradient, intensity)
        elif grain_type == 'artistic':
            return self._add_artistic_grain(gradient, intensity)
        else:
            return self._add_photographic_grain(gradient, intensity)  # Default
    
    def _add_film_grain(self, gradient: np.ndarray, intensity: float) -> np.ndarray:
        """Add film grain texture for vintage look."""
        np.random.seed(self.params.get('seed', 42))
        
        # Create multiple grain layers with different sizes
        grain_layers = []
        
        # Fine grain
        fine_grain = np.random.normal(0, intensity * 0.3, (self.height, self.width))
        fine_grain = gaussian_filter(fine_grain, sigma=0.3)
        grain_layers.append(fine_grain)
        
        # Medium grain
        medium_grain = np.random.normal(0, intensity * 0.5, (self.height, self.width))
        medium_grain = gaussian_filter(medium_grain, sigma=0.8)
        grain_layers.append(medium_grain)
        
        # Coarse grain
        coarse_grain = np.random.normal(0, intensity * 0.2, (self.height, self.width))
        coarse_grain = gaussian_filter(coarse_grain, sigma=1.5)
        grain_layers.append(coarse_grain)
        
        # Combine grain layers
        combined_grain = sum(grain_layers)
        
        # Apply film grain characteristics
        grainy = gradient.copy()
        for channel in range(3):
            # Add luminance-dependent grain (more visible in midtones)
            luminance = gradient[:, :, channel] / 255.0
            grain_strength = 4 * luminance * (1 - luminance)  # Peak at 0.5 luminance
            
            grainy[:, :, channel] = np.clip(
                grainy[:, :, channel] + combined_grain * grain_strength * 255, 0, 255
            )
        
        return grainy
    
    def _add_photographic_grain(self, gradient: np.ndarray, intensity: float) -> np.ndarray:
        """Add photographic grain for realistic texture."""
        np.random.seed(self.params.get('seed', 42))
        
        # Create structured noise pattern
        x = np.linspace(0, 10, self.width)
        y = np.linspace(0, 10, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Base random noise
        base_noise = np.random.normal(0, intensity, (self.height, self.width))
        
        # Add subtle structure to noise
        structured_noise = base_noise * (1 + 0.1 * np.sin(X * 50) * np.cos(Y * 50))
        
        # Apply gaussian smoothing for photographic quality
        grain = gaussian_filter(structured_noise, sigma=0.5)
        
        # Add color-dependent grain (slightly different per channel)
        grainy = gradient.copy()
        for channel in range(3):
            channel_grain = grain + np.random.normal(0, intensity * 0.1, (self.height, self.width))
            
            # Make grain more visible in shadow and highlight areas
            brightness = gradient[:, :, channel] / 255.0
            grain_visibility = np.where(brightness < 0.3, 1.5, 
                                       np.where(brightness > 0.7, 1.3, 1.0))
            
            grainy[:, :, channel] = np.clip(
                grainy[:, :, channel] + channel_grain * grain_visibility * 255, 0, 255
            )
        
        return grainy
    
    def _add_digital_noise(self, gradient: np.ndarray, intensity: float) -> np.ndarray:
        """Add clean digital noise."""
        np.random.seed(self.params.get('seed', 42))
        
        # Simple gaussian noise
        noise = np.random.normal(0, intensity, (self.height, self.width))
        noise = gaussian_filter(noise, sigma=0.3)
        
        grainy = gradient.copy()
        for channel in range(3):
            grainy[:, :, channel] = np.clip(
                grainy[:, :, channel] + noise * 255, 0, 255
            )
        
        return grainy
    
    def _add_artistic_grain(self, gradient: np.ndarray, intensity: float) -> np.ndarray:
        """Add artistic grain with irregular patterns."""
        np.random.seed(self.params.get('seed', 42))
        
        # Create organic grain pattern
        x = np.linspace(0, 8, self.width)
        y = np.linspace(0, 8, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Multiple noise octaves for complex texture
        grain = np.zeros((self.height, self.width))
        
        for octave in range(4):
            freq = 2 ** octave
            amplitude = intensity / (2 ** octave)
            
            octave_noise = np.random.normal(0, amplitude, (self.height, self.width))
            octave_noise = gaussian_filter(octave_noise, sigma=0.5 / freq)
            
            # Add organic movement
            flow_x = np.sin(X * freq * 0.5) * 0.1
            flow_y = np.cos(Y * freq * 0.5) * 0.1
            
            # Distort the noise slightly
            y_coords, x_coords = np.ogrid[:self.height, :self.width]
            distorted_x = np.clip(x_coords + flow_x * 10, 0, self.width - 1)
            distorted_y = np.clip(y_coords + flow_y * 10, 0, self.height - 1)
            
            distorted_noise = ndimage.map_coordinates(
                octave_noise, [distorted_y, distorted_x], order=1, mode='reflect'
            )
            
            grain += distorted_noise
        
        # Apply grain to gradient
        grainy = gradient.copy()
        for channel in range(3):
            grainy[:, :, channel] = np.clip(
                grainy[:, :, channel] + grain * 255, 0, 255
            )
        
        return grainy


class GlassGradientGenerator(BaseGenerator):
    """Generate glass-like gradients with transparency effects."""
    
    def generate(self) -> np.ndarray:
        """Generate a glass-like gradient."""
        
        # Parameters
        transparency_layers = self.params.get('layers', 3)
        reflection_strength = self.params.get('reflection', 0.2)
        distortion_amount = self.params.get('distortion', 0.1)
        highlight_intensity = self.params.get('highlights', 0.3)
        
        # Create base layers
        layers = []
        for i in range(transparency_layers):
            layer = self._create_glass_layer(i, transparency_layers)
            layers.append(layer)
        
        # Blend layers with transparency
        result = self._blend_glass_layers(layers)
        
        # Add glass effects
        result = self._add_glass_effects(result, reflection_strength, highlight_intensity)
        
        # Apply subtle distortion for glass look
        result = self._apply_glass_distortion(result, distortion_amount)
        
        # Add grain if specified
        grain_intensity = self.params.get('grain_intensity', 0.0)
        if grain_intensity > 0:
            result = self._add_glass_grain(result, grain_intensity)
        
        return result
    
    def _create_glass_layer(self, layer_index: int, total_layers: int) -> np.ndarray:
        """Create individual glass layer."""
        
        # Each layer has slightly different properties
        layer_offset = layer_index / total_layers
        
        # Create coordinates
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Create flowing pattern for this layer
        angle = self.params.get('angle', 45) + layer_offset * 30
        angle_rad = np.radians(angle)
        
        # Add some organic movement
        flow_x = np.sin(X * 3 + layer_offset * np.pi) * 0.1
        flow_y = np.cos(Y * 3 + layer_offset * np.pi) * 0.1
        
        # Calculate gradient with flow
        gradient_coords = (
            (X + flow_x) * np.cos(angle_rad) + 
            (Y + flow_y) * np.sin(angle_rad)
        )
        
        # Normalize
        gradient_values = gradient_coords
        gradient_values = (gradient_values - gradient_values.min()) / (gradient_values.max() - gradient_values.min())
        
        # Apply color mapping with layer offset
        rgb_array = np.zeros((self.height, self.width, 3))
        
        for i in range(self.height):
            for j in range(self.width):
                t = np.clip(gradient_values[i, j] + layer_offset * 0.2, 0, 1)
                rgb_array[i, j] = self.interpolate_colors(t)
        
        return rgb_array
    
    def _blend_glass_layers(self, layers: List[np.ndarray]) -> np.ndarray:
        """Blend glass layers with transparency."""
        
        if not layers:
            return np.zeros((self.height, self.width, 3))
        
        result = layers[0].copy()
        
        for i, layer in enumerate(layers[1:], 1):
            # Each layer becomes more transparent
            alpha = 0.7 / (i + 1)
            result = result * (1 - alpha) + layer * alpha
        
        return result
    
    def _add_glass_effects(self, gradient: np.ndarray, reflection: float, highlights: float) -> np.ndarray:
        """Add glass-like reflection and highlight effects."""
        
        result = gradient.copy()
        
        if reflection > 0:
            # Add subtle reflection effect
            x = np.linspace(0, 1, self.width)
            y = np.linspace(0, 1, self.height)
            X, Y = np.meshgrid(x, y)
            
            # Create reflection pattern
            reflection_pattern = np.sin(Y * np.pi * 2) * np.cos(X * np.pi * 1.5)
            reflection_pattern = (reflection_pattern + 1) / 2  # Normalize to 0-1
            
            # Apply reflection
            for channel in range(3):
                result[:, :, channel] += reflection_pattern * reflection * 30
        
        if highlights > 0:
            # Add highlight spots
            highlight_x = self.width * 0.3
            highlight_y = self.height * 0.2
            
            y_coords, x_coords = np.ogrid[:self.height, :self.width]
            distance = np.sqrt((x_coords - highlight_x)**2 + (y_coords - highlight_y)**2)
            
            # Create soft highlight
            highlight_mask = np.exp(-distance / (min(self.width, self.height) * 0.3))
            
            # Apply highlight
            for channel in range(3):
                result[:, :, channel] += highlight_mask * highlights * 50
        
        return np.clip(result, 0, 255)
    
    def _apply_glass_distortion(self, gradient: np.ndarray, amount: float) -> np.ndarray:
        """Apply subtle distortion for glass effect."""
        
        if amount <= 0:
            return gradient
        
        # Create distortion field
        x = np.linspace(0, 4 * np.pi, self.width)
        y = np.linspace(0, 4 * np.pi, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Distortion vectors
        dx = np.sin(Y * 0.5) * amount * self.width * 0.02
        dy = np.cos(X * 0.5) * amount * self.height * 0.02
        
        # Apply distortion to each channel
        result = np.zeros_like(gradient)
        
        for channel in range(3):
            # Use map_coordinates for smooth distortion
            y_coords, x_coords = np.ogrid[:self.height, :self.width]
            distorted_x = np.clip(x_coords + dx, 0, self.width - 1)
            distorted_y = np.clip(y_coords + dy, 0, self.height - 1)
            
            result[:, :, channel] = ndimage.map_coordinates(
                gradient[:, :, channel], 
                [distorted_y, distorted_x], 
                order=1, 
                mode='reflect'
            )
        
        return result
    
    def _add_glass_grain(self, gradient: np.ndarray, intensity: float) -> np.ndarray:
        """Add grain texture specifically for glass gradients."""
        grain_type = self.params.get('grain_type', 'photographic')
        
        # Create an instance of OrganicGradientGenerator to reuse grain methods
        temp_organic = OrganicGradientGenerator(self.width, self.height, self.colors, **self.params)
        
        if grain_type == 'film':
            return temp_organic._add_film_grain(gradient, intensity)
        elif grain_type == 'photographic':
            return temp_organic._add_photographic_grain(gradient, intensity)
        elif grain_type == 'digital':
            return temp_organic._add_digital_noise(gradient, intensity)
        elif grain_type == 'artistic':
            return temp_organic._add_artistic_grain(gradient, intensity)
        else:
            return temp_organic._add_photographic_grain(gradient, intensity)


class FluidGradientGenerator(BaseGenerator):
    """Generate fluid, paint-like gradients."""
    
    def generate(self) -> np.ndarray:
        """Generate a fluid gradient."""
        
        # Parameters
        flow_complexity = self.params.get('complexity', 2.5)
        smoothness = self.params.get('smoothness', 4.0)
        color_bleeding = self.params.get('bleeding', 0.3)
        
        # Create multiple flow fields
        flow_fields = self._create_fluid_flows(flow_complexity)
        
        # Create color distribution
        color_field = self._create_color_field(flow_fields, color_bleeding)
        
        # Apply heavy smoothing for paint-like quality
        result = self._apply_fluid_smoothing(color_field, smoothness)
        
        # Add grain if specified
        grain_intensity = self.params.get('grain_intensity', 0.0)
        if grain_intensity > 0:
            result = self._add_fluid_grain(result, grain_intensity)
        
        return result
    
    def _create_fluid_flows(self, complexity: float) -> List[np.ndarray]:
        """Create multiple fluid flow fields."""
        
        flows = []
        num_flows = int(complexity * 2) + 2
        
        x = np.linspace(0, 2 * np.pi, self.width)
        y = np.linspace(0, 2 * np.pi, self.height)
        X, Y = np.meshgrid(x, y)
        
        for i in range(num_flows):
            # Each flow has different frequency and phase
            freq_x = 0.5 + i * 0.3
            freq_y = 0.7 + i * 0.4
            phase_x = i * np.pi / 3
            phase_y = i * np.pi / 4
            
            flow = (
                np.sin(X * freq_x + phase_x) * np.cos(Y * freq_y + phase_y) +
                np.cos(X * freq_y + phase_y) * np.sin(Y * freq_x + phase_x)
            ) * (1.0 / (i + 1))  # Diminishing amplitude
            
            flows.append(flow)
        
        return flows
    
    def _create_color_field(self, flows: List[np.ndarray], bleeding: float) -> np.ndarray:
        """Create color field from flow patterns."""
        
        # Combine all flows
        combined_flow = sum(flows)
        
        # Normalize flow values
        flow_normalized = (combined_flow - combined_flow.min()) / (combined_flow.max() - combined_flow.min())
        
        # Add color bleeding effect
        if bleeding > 0:
            # Create secondary color regions
            x = np.linspace(0, 1, self.width)
            y = np.linspace(0, 1, self.height)
            X, Y = np.meshgrid(x, y)
            
            # Create color bleeding pattern
            bleeding_pattern = np.sin(X * np.pi * 3) * np.cos(Y * np.pi * 2)
            bleeding_pattern = (bleeding_pattern + 1) / 2
            
            # Blend with main flow
            flow_normalized = (1 - bleeding) * flow_normalized + bleeding * bleeding_pattern
        
        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))
        
        for i in range(self.height):
            for j in range(self.width):
                t = flow_normalized[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)
        
        return rgb_array
    
    def _apply_fluid_smoothing(self, gradient: np.ndarray, smoothness: float) -> np.ndarray:
        """Apply heavy smoothing for fluid paint effect."""
        
        result = gradient.copy()
        
        # Apply multiple passes of smoothing
        for _ in range(3):
            for channel in range(3):
                result[:, :, channel] = gaussian_filter(
                    result[:, :, channel], 
                    sigma=smoothness, 
                    mode='reflect'
                )
        
        return result
    
    def _add_fluid_grain(self, gradient: np.ndarray, intensity: float) -> np.ndarray:
        """Add grain texture specifically for fluid gradients."""
        grain_type = self.params.get('grain_type', 'photographic')
        
        # Create an instance of OrganicGradientGenerator to reuse grain methods
        temp_organic = OrganicGradientGenerator(self.width, self.height, self.colors, **self.params)
        
        if grain_type == 'film':
            return temp_organic._add_film_grain(gradient, intensity)
        elif grain_type == 'photographic':
            return temp_organic._add_photographic_grain(gradient, intensity)
        elif grain_type == 'digital':
            return temp_organic._add_digital_noise(gradient, intensity)
        elif grain_type == 'artistic':
            return temp_organic._add_artistic_grain(gradient, intensity)
        else:
            return temp_organic._add_photographic_grain(gradient, intensity)