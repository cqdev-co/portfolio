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
        
        # Apply anti-banding dithering if enabled
        if self.params.get('anti_banding', True):
            gradient_final = self.apply_dithering(gradient_final, 0.4)
        
        # Apply web optimizations if enabled
        if self.params.get('web_optimized', False):
            output_format = self.params.get('output_format', 'png')
            gradient_final = self.optimize_for_web(gradient_final, output_format)
        
        return gradient_final
    
    def _create_flow_field(self, strength: float) -> np.ndarray:
        """Create organic flow field for natural movement with multiple focal points."""
        
        # Create coordinate arrays
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Get composition style for dynamic flow patterns
        composition = self.params.get('composition', 'balanced')
        
        if composition == 'flowing':
            # Create multiple flow centers for natural, non-linear movement
            center1_x, center1_y = 0.3, 0.7  # Off-center focal point
            center2_x, center2_y = 0.8, 0.2  # Secondary focal point
            
            # Distance from focal points
            dist1 = np.sqrt((X - center1_x)**2 + (Y - center1_y)**2)
            dist2 = np.sqrt((X - center2_x)**2 + (Y - center2_y)**2)
            
            # Create radial flows from multiple centers
            flow1 = np.sin(dist1 * 8 * np.pi) * np.exp(-dist1 * 2)
            flow2 = np.cos(dist2 * 6 * np.pi) * np.exp(-dist2 * 1.5)
            
            # Add swirling motion
            angle1 = np.arctan2(Y - center1_y, X - center1_x)
            angle2 = np.arctan2(Y - center2_y, X - center2_x)
            swirl1 = np.sin(angle1 * 3 + dist1 * 10) * np.exp(-dist1 * 1.5)
            swirl2 = np.cos(angle2 * 2 + dist2 * 8) * np.exp(-dist2 * 2)
            
            combined_flow = 0.3 * flow1 + 0.3 * flow2 + 0.2 * swirl1 + 0.2 * swirl2
            
        elif composition == 'dynamic':
            # Create turbulent, energetic flow patterns
            # Multiple frequency layers for complexity
            flow1 = np.sin(X * 12 + Y * 8) * np.cos(Y * 10 - X * 6)
            flow2 = np.cos(X * 15 - Y * 12) * np.sin(X * 8 + Y * 14)
            flow3 = np.sin((X + Y) * 20) * np.cos((X - Y) * 16)
            
            # Add diagonal energy
            diagonal1 = np.sin((X + Y) * 8) * np.exp(-np.abs(X + Y - 1) * 2)
            diagonal2 = np.cos((X - Y) * 6) * np.exp(-np.abs(X - Y) * 3)
            
            combined_flow = 0.25 * flow1 + 0.25 * flow2 + 0.2 * flow3 + 0.15 * diagonal1 + 0.15 * diagonal2
            
        elif composition == 'organic':
            # Create truly organic, non-linear patterns using multiple techniques
            
            # 1. Pure Random Walk Field
            num_walks = 50  # Many random walks for complexity
            walk_field = np.zeros_like(X)
            
            for _ in range(num_walks):
                # Start from random position
                pos_x = np.random.rand()
                pos_y = np.random.rand()
                strength = np.random.rand() * 0.4 + 0.1  # Random strength
                
                # Create random walk path
                path_length = 100
                walk_x = []
                walk_y = []
                
                for _ in range(path_length):
                    # Add point to path
                    walk_x.append(pos_x)
                    walk_y.append(pos_y)
                    
                    # Random direction change
                    angle = np.random.rand() * 2 * np.pi
                    step = 0.02 * np.random.rand()  # Variable step size
                    pos_x = (pos_x + np.cos(angle) * step) % 1.0  # Wrap around
                    pos_y = (pos_y + np.sin(angle) * step) % 1.0
                
                # Convert walk to field influence
                walk_x = np.array(walk_x)
                walk_y = np.array(walk_y)
                
                # Calculate influence on each point
                for i in range(path_length):
                    dx = X - walk_x[i]
                    dy = Y - walk_y[i]
                    dist = np.sqrt(dx**2 + dy**2)
                    influence = np.exp(-dist * 20) * strength * (1 - i/path_length)  # Fade along path
                    walk_field += influence
            
            cellular = walk_field / walk_field.max()  # Normalize
            
            # 2. Perlin Noise with Random Transforms
            from noise import snoise3  # Using 3D noise for more variation
            
            turbulence = np.zeros_like(X)
            num_layers = 6  # More noise layers
            
            for i in range(num_layers):
                # Random transformation matrix for this layer
                scale = 2 ** (i + 2)  # Increasing scales
                angle = np.random.rand() * np.pi
                offset_x = np.random.rand() * 100
                offset_y = np.random.rand() * 100
                offset_z = np.random.rand() * 100
                
                # Create transformed coordinates
                X_trans = X * np.cos(angle) - Y * np.sin(angle)
                Y_trans = X * np.sin(angle) + Y * np.cos(angle)
                
                # Generate 3D noise with time variation
                layer = np.zeros_like(X)
                for ix in range(X.shape[1]):
                    for iy in range(X.shape[0]):
                        x = X_trans[iy, ix] * scale + offset_x
                        y = Y_trans[iy, ix] * scale + offset_y
                        z = offset_z
                        layer[iy, ix] = snoise3(x, y, z, octaves=1)
                
                # Add non-linear transformation
                layer = np.tanh(layer * 2)  # Non-linear contrast
                turbulence += layer / (i + 1)  # Weight by layer
            
            # Normalize
            turbulence = (turbulence - turbulence.min()) / (turbulence.max() - turbulence.min())
            
            # 3. Enhanced Fluid Dynamics with Multiple Force Fields
            reaction = np.zeros_like(X)
            
            # Initialize multiple velocity fields at different scales
            num_fields = 4
            velocity_fields = []
            for i in range(num_fields):
                scale = 2.0 ** i  # Different scales for each field
                vx = np.random.randn(*X.shape) * 0.1 * scale
                vy = np.random.randn(*X.shape) * 0.1 * scale
                velocity_fields.append((vx, vy))
            
            # Simulate fluid movement with multiple interacting fields
            steps = 15  # More simulation steps
            for step in range(steps):
                # Dynamic force fields
                for i, (vx, vy) in enumerate(velocity_fields):
                    # Create swirling forces
                    angle = np.arctan2(Y - 0.5, X - 0.5) + step * 0.2
                    dist = np.sqrt((X - 0.5)**2 + (Y - 0.5)**2)
                    swirl_x = np.cos(angle + dist * 5) * (1 - dist)
                    swirl_y = np.sin(angle + dist * 5) * (1 - dist)
                    
                    # Random turbulent forces
                    turb_scale = 0.1 / (i + 1)  # Scale decreases with field size
                    force_x = (np.random.randn(*X.shape) + swirl_x) * turb_scale
                    force_y = (np.random.randn(*X.shape) + swirl_y) * turb_scale
                    
                    # Add time-varying forces
                    time_factor = np.sin(step * 0.4 + i * np.pi/2)
                    force_x *= (1 + time_factor * 0.5)
                    force_y *= (1 + time_factor * 0.5)
                    
                    # Update velocities with non-linear effects
                    vx += force_x + np.sign(vx) * (np.abs(vx) ** 1.5) * 0.1
                    vy += force_y + np.sign(vy) * (np.abs(vy) ** 1.5) * 0.1
                    
                    # Apply advanced diffusion
                    from scipy.ndimage import gaussian_filter
                    sigma = 1.0 + i * 0.5  # Different diffusion rates
                    vx = gaussian_filter(vx, sigma=sigma)
                    vy = gaussian_filter(vy, sigma=sigma)
                    
                    # Update field
                    velocity_fields[i] = (vx, vy)
                
                # Combine all fields with varying weights
                total_field_x = np.zeros_like(X)
                total_field_y = np.zeros_like(Y)
                for i, (vx, vy) in enumerate(velocity_fields):
                    weight = 1.0 / (2 ** i)  # Exponential weight decay
                    total_field_x += vx * weight
                    total_field_y += vy * weight
                
                # Calculate enhanced vorticity
                dx_vy = np.gradient(total_field_y, axis=1)
                dy_vx = np.gradient(total_field_x, axis=0)
                curl = dx_vy - dy_vx
                
                # Add non-linear response
                curl_intensity = np.abs(curl)
                enhanced_curl = np.sign(curl) * (curl_intensity ** 1.2)
                
                # Add to reaction field with temporal weighting
                time_weight = 1.0 - step/steps  # Decay over time
                reaction += enhanced_curl * time_weight
            
            # Normalize
            reaction = (reaction - reaction.min()) / (reaction.max() - reaction.min())
            
            # 4. Enhanced Non-linear Distortion
            # Create vortex-like distortion fields
            vortex_centers = [(0.3, 0.7), (0.7, 0.3), (0.5, 0.5)]
            distort_x = np.zeros_like(X)
            distort_y = np.zeros_like(Y)
            
            for cx, cy in vortex_centers:
                dx = X - cx
                dy = Y - cy
                dist = np.sqrt(dx**2 + dy**2)
                angle = np.arctan2(dy, dx)
                
                # Create spiral distortion
                strength = np.exp(-dist * 3)  # Distance-based strength
                distort_x += strength * (np.cos(angle + dist * 10) * 0.2)
                distort_y += strength * (np.sin(angle + dist * 10) * 0.2)
            
            # Add turbulent distortion
            distort_x += 0.1 * np.sin(X * 8 + Y * 6 + cellular * 3 + turbulence * 2)
            distort_y += 0.1 * np.cos(X * 6 + Y * 8 + cellular * 2 + turbulence * 3)
            
            X_distorted = X + distort_x
            Y_distorted = Y + distort_y
            
            # 5. Enhanced Spiral Formations
            # Create multiple interacting spiral fields
            spiral = np.zeros_like(X)
            for i in range(3):  # Multiple spiral layers
                center_x = 0.3 + i * 0.2
                center_y = 0.3 + i * 0.2
                
                dx = X_distorted - center_x
                dy = Y_distorted - center_y
                angle = np.arctan2(dy, dx)
                radius = np.sqrt(dx**2 + dy**2)
                
                # Create complex spiral pattern
                spiral_layer = np.sin(angle * (2 + i) + radius * (10 + i * 5))
                spiral_layer *= np.exp(-radius * (2 + i))  # Distance-based falloff
                
                spiral += spiral_layer * (0.5 ** i)  # Weight by layer
            
            # Enhanced Pattern Combination with Non-linear Blending
            
            # Calculate flow characteristics
            flow_direction = np.arctan2(reaction, turbulence)
            flow_strength = np.sqrt(reaction**2 + turbulence**2)
            
            # Create dynamic masks
            from scipy.ndimage import gaussian_filter
            
            # Base complexity field
            complexity = gaussian_filter(flow_strength, sigma=2.0)
            complexity = np.tanh(complexity * 3)  # Non-linear contrast
            
            # Create masks with varying smoothness
            turb_mask = gaussian_filter(turbulence, sigma=2.0)
            react_mask = gaussian_filter(reaction, sigma=1.5)
            cell_mask = gaussian_filter(cellular, sigma=1.0)
            
            # Apply non-linear transformations
            turb_mask = np.tanh(turb_mask * 3)
            react_mask = react_mask ** 1.5
            cell_mask = 1 / (1 + np.exp(-cell_mask * 4))
            
            # Spatial variation
            x_var = np.sin(X * np.pi * 2 + flow_direction)
            y_var = np.cos(Y * np.pi * 2 + flow_direction)
            spatial_var = gaussian_filter((x_var + y_var) * 0.5, sigma=1.0)
            
            # Dynamic weights
            w1 = turb_mask * (1 + spatial_var * 0.3)
            w2 = react_mask * (1 - spatial_var * 0.2)
            w3 = cell_mask * (1 + complexity * 0.4)
            
            # Normalize weights with smoothing
            total_weight = gaussian_filter(w1 + w2 + w3, sigma=0.5)
            w1 = gaussian_filter(w1 / total_weight, sigma=0.5)
            w2 = gaussian_filter(w2 / total_weight, sigma=0.5)
            w3 = gaussian_filter(w3 / total_weight, sigma=0.5)
            
            # Combine patterns with non-linear interactions
            combined_flow = (
                w1 * turbulence * (1 + reaction * 0.2) +  # Turbulence affected by reaction
                w2 * reaction * (1 + cellular * 0.3) +    # Reaction affected by cellular
                w3 * cellular * (1 + turbulence * 0.2)    # Cellular affected by turbulence
            )
            
        else:
            # Default: improved balanced composition with subtle asymmetry
            # Create gentle, off-center flow
            center_x, center_y = 0.4, 0.6  # Slightly off-center
            
            # Radial component
            dist = np.sqrt((X - center_x)**2 + (Y - center_y)**2)
            radial = np.sin(dist * 6 * np.pi) * np.exp(-dist * 1.5)
            
            # Directional flows with variation
            flow1 = np.sin(X * 3 + Y * 2) * np.cos(Y * 4 - X * 1.5)
            flow2 = np.cos(X * 2.5 - Y * 3.5) * np.sin(X * 3.5 + Y * 2.5)
            
            # Add subtle asymmetric element
            asymmetric = np.sin(X * 5 + Y * 3 + np.pi/3) * np.exp(-((X - 0.7)**2 + (Y - 0.3)**2) * 3)
            
            combined_flow = 0.4 * radial + 0.3 * flow1 + 0.2 * flow2 + 0.1 * asymmetric
        
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
        
        # Use professional grain if enabled
        if self.params.get('grain_quality', 'standard') == 'professional':
            return self._add_professional_grain(gradient, intensity)
        
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
    
    def _add_professional_grain(self, gradient: np.ndarray, intensity: float) -> np.ndarray:
        """Professional-grade grain system matching stock photo quality."""
        np.random.seed(self.params.get('seed', 42))
        
        # Multi-octave noise for realistic grain structure
        grain_layers = np.zeros((self.height, self.width))
        
        # Create coordinate system for Perlin-like noise
        x = np.linspace(0, 8, self.width)
        y = np.linspace(0, 8, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Multiple grain frequencies (like Adobe Stock)
        frequencies = [1.0, 2.0, 4.0, 8.0, 16.0]
        amplitudes = [0.4, 0.3, 0.2, 0.07, 0.03]
        
        for freq, amp in zip(frequencies, amplitudes):
            # Create organic noise pattern
            octave_noise = np.random.normal(0, intensity * amp, (self.height, self.width))
            
            # Add organic flow patterns
            flow_x = np.sin(X * freq * 0.1) * 2.0
            flow_y = np.cos(Y * freq * 0.1) * 2.0
            
            # Distort the noise
            y_coords, x_coords = np.ogrid[:self.height, :self.width]
            distorted_x = np.clip(x_coords + flow_x, 0, self.width - 1)
            distorted_y = np.clip(y_coords + flow_y, 0, self.height - 1)
            
            try:
                from scipy import ndimage
                distorted_noise = ndimage.map_coordinates(
                    octave_noise, [distorted_y, distorted_x], 
                    order=1, mode='reflect'
                )
            except:
                distorted_noise = octave_noise
            
            # Apply frequency-dependent smoothing
            sigma = max(0.3, 1.0 / freq)
            distorted_noise = gaussian_filter(distorted_noise, sigma=sigma)
            
            grain_layers += distorted_noise
        
        # Apply luminance-adaptive grain distribution
        grainy = gradient.copy().astype(float)
        
        for channel in range(3):
            # Calculate local luminance
            luminance = grainy[:, :, channel] / 255.0
            
            # Create sophisticated grain visibility map
            # More grain in shadows and highlights (like film emulsion)
            shadow_boost = np.exp(-((luminance - 0.2)**2) / (2 * 0.15**2))
            highlight_boost = np.exp(-((luminance - 0.8)**2) / (2 * 0.15**2)) * 0.7
            midtone_suppress = 1.0 - np.exp(-((luminance - 0.5)**2) / (2 * 0.2**2)) * 0.3
            
            grain_visibility = (shadow_boost + highlight_boost + midtone_suppress)
            
            # Add color-dependent variations
            color_variation = np.random.normal(0, intensity * 0.05, (self.height, self.width))
            channel_grain = grain_layers + color_variation
            
            # Apply grain with visibility mapping
            final_grain = channel_grain * grain_visibility * 255
            grainy[:, :, channel] += final_grain
        
        # Add subtle color noise for realism
        color_noise_intensity = intensity * 0.03
        for channel in range(3):
            color_noise = np.random.normal(0, color_noise_intensity, (self.height, self.width))
            color_noise = gaussian_filter(color_noise, sigma=0.8)
            grainy[:, :, channel] += color_noise * 255
        
        return np.clip(grainy, 0, 255).astype(np.uint8)
    
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
        
        # Apply anti-banding dithering for professional quality
        if self.params.get('anti_banding', True):
            result = self.apply_dithering(result, 0.3)
        
        # Apply web optimizations if enabled
        if self.params.get('web_optimized', False):
            output_format = self.params.get('output_format', 'png')
            result = self.optimize_for_web(result, output_format)
        
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
                # Use gamma-correct interpolation for professional quality
                if self.params.get('gamma_correct', True):
                    rgb_array[i, j] = self.gamma_correct_interpolate(t)
                else:
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
            # Add sophisticated reflection effect
            x = np.linspace(0, 1, self.width)
            y = np.linspace(0, 1, self.height)
            X, Y = np.meshgrid(x, y)
            
            # Create multiple reflection layers for depth
            reflection_pattern = (
                np.sin(Y * np.pi * 2) * np.cos(X * np.pi * 1.5) * 0.4 +
                np.sin(Y * np.pi * 4) * np.cos(X * np.pi * 3) * 0.3 +
                np.sin(Y * np.pi * 6) * np.cos(X * np.pi * 4.5) * 0.3
            )
            reflection_pattern = (reflection_pattern + 1) / 2  # Normalize to 0-1
            
            # Apply reflection with Fresnel-like falloff
            fresnel = np.abs(np.cos(X * np.pi / 2))  # Stronger reflection at angles
            reflection_pattern *= fresnel
            
            # Apply reflection
            for channel in range(3):
                result[:, :, channel] += reflection_pattern * reflection * 35
        
        if highlights > 0:
            # Add multiple highlight sources for realism
            highlight_positions = [(0.3, 0.2), (0.7, 0.8), (0.15, 0.6)]
            intensities = [1.0, 0.6, 0.4]
            
            for (hx, hy), intensity in zip(highlight_positions, intensities):
                highlight_x = self.width * hx
                highlight_y = self.height * hy
                
                y_coords, x_coords = np.ogrid[:self.height, :self.width]
                distance = np.sqrt((x_coords - highlight_x)**2 + (y_coords - highlight_y)**2)
                
                # Create soft highlight with realistic falloff
                highlight_size = min(self.width, self.height) * (0.25 + 0.1 * intensity)
                highlight_mask = np.exp(-distance / highlight_size)
                
                # Apply highlight with intensity variation
                for channel in range(3):
                    result[:, :, channel] += highlight_mask * highlights * intensity * 45
        
        # Add holographic effects if enabled
        if self.params.get('holographic', False):
            result = self._add_holographic_effect(result)
        
        return np.clip(result, 0, 255)
    
    def _add_holographic_effect(self, gradient: np.ndarray) -> np.ndarray:
        """Add holographic/iridescent shimmer effects like Freepik reference."""
        import colorsys
        
        result = gradient.copy().astype(float)
        
        # Create coordinate system
        x = np.linspace(0, 1, self.width)
        y = np.linspace(0, 1, self.height)
        X, Y = np.meshgrid(x, y)
        
        # Create viewing angle simulation
        angle_factor = np.sqrt((X - 0.5)**2 + (Y - 0.5)**2)
        angle_factor = 1.0 - angle_factor  # Reverse for center highlight
        
        # Create prismatic color separation
        prism_offset = 0.02  # Color separation amount
        
        # Shift each channel slightly for prismatic effect
        red_shift = np.sin(X * np.pi * 3 + Y * np.pi * 2) * prism_offset
        green_shift = np.sin(X * np.pi * 3 + Y * np.pi * 2 + np.pi/3) * prism_offset
        blue_shift = np.sin(X * np.pi * 3 + Y * np.pi * 2 + 2*np.pi/3) * prism_offset
        
        # Apply color shifting
        for i in range(self.height):
            for j in range(self.width):
                # Convert to HSV for easier color manipulation
                r, g, b = result[i, j] / 255.0
                h, s, v = colorsys.rgb_to_hsv(r, g, b)
                
                # Add iridescent hue shifting
                hue_shift = (
                    red_shift[i, j] * 0.1 +
                    np.sin(i * 0.02 + j * 0.02) * 0.05 +
                    angle_factor[i, j] * 0.08
                )
                h = (h + hue_shift) % 1.0
                
                # Enhance saturation for holographic look
                s = min(1.0, s * (1.0 + angle_factor[i, j] * 0.3))
                
                # Add subtle brightness modulation
                v = min(1.0, v * (1.0 + angle_factor[i, j] * 0.15))
                
                # Convert back to RGB
                r, g, b = colorsys.hsv_to_rgb(h, s, v)
                result[i, j] = [r * 255, g * 255, b * 255]
        
        # Add spectral highlights
        spectral_intensity = self.params.get('holographic_intensity', 0.3)
        spectral_pattern = np.sin(X * np.pi * 8) * np.cos(Y * np.pi * 6)
        spectral_pattern = (spectral_pattern + 1) / 2
        spectral_pattern *= angle_factor  # Stronger at center
        
        # Apply spectral enhancement
        for channel in range(3):
            channel_boost = spectral_pattern * spectral_intensity * 40
            result[:, :, channel] += channel_boost
        
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