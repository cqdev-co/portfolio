"""
Wave-based gradient generators.
"""

import numpy as np
from typing import List, Tuple
from ..core.base import BaseGenerator


class WaveGradientGenerator(BaseGenerator):
    """Generate gradients using wave functions."""
    
    def generate(self) -> np.ndarray:
        """Generate a wave-based gradient."""
        
        # Parameters
        wave_type = self.params.get('wave_type', 'sine')
        frequency = self.params.get('frequency', 1.0)
        amplitude = self.params.get('amplitude', 1.0)
        phase = self.params.get('phase', 0.0)
        direction = self.params.get('direction', 0)  # 0=horizontal, 90=vertical
        
        # Create coordinate arrays
        x = np.linspace(0, 2 * np.pi * frequency, self.width)
        y = np.linspace(0, 2 * np.pi * frequency, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Apply direction rotation
        angle_rad = np.radians(direction)
        cos_angle = np.cos(angle_rad)
        sin_angle = np.sin(angle_rad)
        
        # Rotate coordinates
        coords = X * cos_angle + Y * sin_angle + phase
        
        # Apply wave function
        if wave_type == 'sine':
            wave_values = np.sin(coords)
        elif wave_type == 'cosine':
            wave_values = np.cos(coords)
        elif wave_type == 'triangle':
            wave_values = 2 / np.pi * np.arcsin(np.sin(coords))
        elif wave_type == 'sawtooth':
            wave_values = 2 * (coords / (2 * np.pi) - np.floor(coords / (2 * np.pi) + 0.5))
        elif wave_type == 'square':
            wave_values = np.sign(np.sin(coords))
        else:
            # Default to sine
            wave_values = np.sin(coords)
        
        # Apply amplitude and normalize to 0-1 range
        wave_values = amplitude * wave_values
        wave_values = (wave_values + amplitude) / (2 * amplitude)
        wave_values = np.clip(wave_values, 0, 1)
        
        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))
        
        for i in range(self.height):
            for j in range(self.width):
                t = wave_values[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)
        
        return rgb_array


class InterferencePatternGenerator(BaseGenerator):
    """Generate gradients using wave interference patterns."""
    
    def generate(self) -> np.ndarray:
        """Generate an interference pattern gradient."""
        
        # Parameters
        num_sources = self.params.get('num_sources', 3)
        frequency = self.params.get('frequency', 1.0)
        amplitude = self.params.get('amplitude', 1.0)
        
        # Create coordinate arrays
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Initialize wave sum
        total_wave = np.zeros_like(X)
        
        # Generate interference from multiple sources
        np.random.seed(self.params.get('seed', 42))
        for i in range(num_sources):
            # Random source position
            source_x = np.random.random()
            source_y = np.random.random()
            
            # Calculate distance from source
            distance = np.sqrt((X - source_x)**2 + (Y - source_y)**2)
            
            # Generate wave from this source
            wave = amplitude * np.sin(2 * np.pi * frequency * distance)
            total_wave += wave
        
        # Normalize to 0-1 range
        if total_wave.max() != total_wave.min():
            total_wave = (total_wave - total_wave.min()) / (total_wave.max() - total_wave.min())
        else:
            total_wave = np.ones_like(total_wave) * 0.5
        
        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))
        
        for i in range(self.height):
            for j in range(self.width):
                t = total_wave[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)
        
        return rgb_array


class SpiralWaveGenerator(BaseGenerator):
    """Generate gradients using spiral wave patterns."""
    
    def generate(self) -> np.ndarray:
        """Generate a spiral wave gradient."""
        
        # Parameters
        frequency = self.params.get('frequency', 1.0)
        spiral_tightness = self.params.get('spiral_tightness', 1.0)
        center_x = self.params.get('center_x', 0.5)
        center_y = self.params.get('center_y', 0.5)
        clockwise = self.params.get('clockwise', True)
        
        # Create coordinate arrays
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Calculate polar coordinates from center
        dx = X - center_x
        dy = Y - center_y
        
        # Calculate radius and angle
        radius = np.sqrt(dx**2 + dy**2)
        angle = np.arctan2(dy, dx)
        
        # Adjust direction
        if not clockwise:
            angle = -angle
        
        # Create spiral wave
        spiral_coords = frequency * (angle + spiral_tightness * radius)
        wave_values = np.sin(spiral_coords)
        
        # Normalize to 0-1 range
        wave_values = (wave_values + 1) / 2
        
        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))
        
        for i in range(self.height):
            for j in range(self.width):
                t = wave_values[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)
        
        return rgb_array


class CylindricalWaveGenerator(BaseGenerator):
    """Generate gradients using cylindrical wave patterns."""
    
    def generate(self) -> np.ndarray:
        """Generate a cylindrical wave gradient."""
        
        # Parameters
        frequency = self.params.get('frequency', 1.0)
        axis = self.params.get('axis', 'vertical')  # 'vertical' or 'horizontal'
        center = self.params.get('center', 0.5)  # Center position along the axis
        
        # Create coordinate arrays
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Calculate distance from the axis
        if axis == 'vertical':
            # Distance from vertical line at center
            distance = np.abs(X - center)
        elif axis == 'horizontal':
            # Distance from horizontal line at center
            distance = np.abs(Y - center)
        else:
            # Default to vertical
            distance = np.abs(X - center)
        
        # Generate cylindrical wave
        wave_values = np.sin(2 * np.pi * frequency * distance)
        
        # Normalize to 0-1 range
        wave_values = (wave_values + 1) / 2
        
        # Create RGB array
        rgb_array = np.zeros((self.height, self.width, 3))
        
        for i in range(self.height):
            for j in range(self.width):
                t = wave_values[i, j]
                rgb_array[i, j] = self.interpolate_colors(t)
        
        return rgb_array