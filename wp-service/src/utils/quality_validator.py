"""
Quality validation and feedback system for gradient generation.
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
import colorsys
from PIL import Image


class QualityValidator:
    """Validate and score gradient quality using computational metrics."""
    
    def __init__(self):
        self.quality_thresholds = {
            'color_harmony': 0.6,      # Minimum harmony score
            'contrast_ratio': 0.3,     # Minimum contrast
            'smoothness': 0.7,         # Minimum smoothness
            'grain_balance': 0.5       # Optimal grain balance
        }
    
    def validate_gradient(self, image_array: np.ndarray, 
                         generation_params: Dict) -> Dict:
        """
        Comprehensive quality validation of a generated gradient.
        
        Args:
            image_array: RGB array of shape (height, width, 3)
            generation_params: Parameters used to generate the gradient
            
        Returns:
            Dict with quality scores and recommendations
        """
        
        scores = {
            'color_harmony': self._calculate_color_harmony(image_array),
            'contrast_ratio': self._calculate_contrast_ratio(image_array),
            'smoothness': self._calculate_smoothness(image_array),
            'grain_balance': self._evaluate_grain_balance(image_array, generation_params),
            'overall_quality': 0.0
        }
        
        # Calculate weighted overall quality score
        weights = {
            'color_harmony': 0.3,
            'contrast_ratio': 0.25,
            'smoothness': 0.25,
            'grain_balance': 0.2
        }
        
        scores['overall_quality'] = sum(
            scores[metric] * weight for metric, weight in weights.items()
        )
        
        # Generate recommendations
        recommendations = self._generate_recommendations(scores, generation_params)
        
        return {
            'scores': scores,
            'recommendations': recommendations,
            'quality_grade': self._get_quality_grade(scores['overall_quality']),
            'passes_validation': scores['overall_quality'] >= 0.6
        }
    
    def _calculate_color_harmony(self, image_array: np.ndarray) -> float:
        """Calculate color harmony score based on color theory."""
        
        # Sample colors from different regions
        h, w = image_array.shape[:2]
        sample_points = [
            (h//4, w//4), (h//4, 3*w//4),
            (3*h//4, w//4), (3*h//4, 3*w//4),
            (h//2, w//2)  # Center
        ]
        
        colors = []
        for y, x in sample_points:
            r, g, b = image_array[y, x]
            h_val, l_val, s_val = colorsys.rgb_to_hls(r/255.0, g/255.0, b/255.0)
            colors.append((h_val, l_val, s_val))
        
        # Calculate harmony based on hue relationships
        hues = [c[0] for c in colors]
        harmony_score = 0.0
        
        # Check for complementary, analogous, or triadic relationships
        for i in range(len(hues)):
            for j in range(i+1, len(hues)):
                hue_diff = abs(hues[i] - hues[j])
                hue_diff = min(hue_diff, 1.0 - hue_diff)  # Circular distance
                
                # Score based on color theory relationships
                if 0.45 <= hue_diff <= 0.55:  # Complementary (~180°)
                    harmony_score += 0.3
                elif 0.08 <= hue_diff <= 0.25:  # Analogous (30-90°)
                    harmony_score += 0.2
                elif 0.28 <= hue_diff <= 0.38:  # Triadic (~120°)
                    harmony_score += 0.25
        
        # Normalize and add saturation consistency bonus
        harmony_score = min(1.0, harmony_score)
        
        # Bonus for consistent saturation levels
        saturations = [c[2] for c in colors]
        sat_consistency = 1.0 - (max(saturations) - min(saturations))
        harmony_score = (harmony_score * 0.7) + (sat_consistency * 0.3)
        
        return max(0.0, min(1.0, harmony_score))
    
    def _calculate_contrast_ratio(self, image_array: np.ndarray) -> float:
        """Calculate contrast ratio across the gradient."""
        
        # Convert to grayscale for luminance calculation
        gray = np.dot(image_array[...,:3], [0.299, 0.587, 0.114])
        
        # Calculate contrast between different regions
        h, w = gray.shape
        regions = [
            gray[:h//2, :w//2],      # Top-left
            gray[:h//2, w//2:],      # Top-right
            gray[h//2:, :w//2],      # Bottom-left
            gray[h//2:, w//2:]       # Bottom-right
        ]
        
        region_means = [np.mean(region) for region in regions]
        max_luminance = max(region_means)
        min_luminance = min(region_means)
        
        # Calculate contrast ratio (Weber contrast)
        if min_luminance > 0:
            contrast_ratio = (max_luminance - min_luminance) / min_luminance
            # Normalize to 0-1 scale (assuming max useful contrast of 2.0)
            return min(1.0, contrast_ratio / 2.0)
        else:
            return 0.0
    
    def _calculate_smoothness(self, image_array: np.ndarray) -> float:
        """Calculate gradient smoothness (lack of banding/artifacts)."""
        
        # Calculate gradients in both directions
        gray = np.dot(image_array[...,:3], [0.299, 0.587, 0.114])
        
        # Sobel operators for edge detection
        grad_x = np.abs(np.diff(gray, axis=1))
        grad_y = np.abs(np.diff(gray, axis=0))
        
        # Calculate variance in gradients (lower = smoother)
        grad_variance_x = np.var(grad_x)
        grad_variance_y = np.var(grad_y)
        
        # Combine variances and invert (higher variance = less smooth)
        total_variance = grad_variance_x + grad_variance_y
        
        # Normalize (assuming max variance of 1000 for typical gradients)
        smoothness = max(0.0, 1.0 - (total_variance / 1000.0))
        
        return min(1.0, smoothness)
    
    def _evaluate_grain_balance(self, image_array: np.ndarray, 
                               params: Dict) -> float:
        """Evaluate if grain intensity is appropriate for the image."""
        
        grain_intensity = params.get('grain_intensity', 0.0)
        
        if grain_intensity == 0.0:
            return 0.8  # No grain is usually fine
        
        # Calculate image characteristics that affect grain perception
        gray = np.dot(image_array[...,:3], [0.299, 0.587, 0.114])
        
        # Darker images can handle more grain
        avg_brightness = np.mean(gray) / 255.0
        brightness_factor = 1.0 - avg_brightness  # Darker = higher factor
        
        # More complex gradients can handle more grain
        complexity = self._estimate_complexity(image_array)
        
        # Calculate optimal grain range based on image characteristics
        optimal_grain_min = 0.01 + (brightness_factor * 0.02) + (complexity * 0.01)
        optimal_grain_max = 0.04 + (brightness_factor * 0.03) + (complexity * 0.02)
        
        # Score based on how close actual grain is to optimal range
        if optimal_grain_min <= grain_intensity <= optimal_grain_max:
            return 1.0
        elif grain_intensity < optimal_grain_min:
            # Too little grain
            deficit = optimal_grain_min - grain_intensity
            return max(0.0, 1.0 - (deficit / 0.02))
        else:
            # Too much grain
            excess = grain_intensity - optimal_grain_max
            return max(0.0, 1.0 - (excess / 0.03))
    
    def _estimate_complexity(self, image_array: np.ndarray) -> float:
        """Estimate visual complexity of the gradient."""
        
        # Use edge detection to estimate complexity
        gray = np.dot(image_array[...,:3], [0.299, 0.587, 0.114])
        
        # Calculate edges using simple difference
        edges_x = np.abs(np.diff(gray, axis=1))
        edges_y = np.abs(np.diff(gray, axis=0))
        
        # Count significant edges
        edge_threshold = 5.0  # Adjust based on testing
        significant_edges = np.sum(edges_x > edge_threshold) + np.sum(edges_y > edge_threshold)
        
        # Normalize by image size
        total_pixels = gray.shape[0] * gray.shape[1]
        complexity = significant_edges / total_pixels
        
        return min(1.0, complexity * 10)  # Scale factor based on testing
    
    def _generate_recommendations(self, scores: Dict, params: Dict) -> List[str]:
        """Generate actionable recommendations based on quality scores."""
        
        recommendations = []
        
        # Color harmony recommendations
        if scores['color_harmony'] < self.quality_thresholds['color_harmony']:
            recommendations.append(
                "🎨 Consider using colors with better harmonic relationships "
                "(complementary, analogous, or triadic color schemes)"
            )
        
        # Contrast recommendations
        if scores['contrast_ratio'] < self.quality_thresholds['contrast_ratio']:
            recommendations.append(
                "⚡ Increase contrast by using colors with more different brightness levels"
            )
        
        # Smoothness recommendations
        if scores['smoothness'] < self.quality_thresholds['smoothness']:
            recommendations.append(
                "🌊 Improve smoothness by increasing blur/smoothness parameters "
                "or enabling anti-banding"
            )
        
        # Grain balance recommendations
        if scores['grain_balance'] < self.quality_thresholds['grain_balance']:
            grain_intensity = params.get('grain_intensity', 0.0)
            if grain_intensity > 0.04:
                recommendations.append(
                    f"✨ Reduce grain intensity from {grain_intensity:.3f} to ~0.025-0.035 "
                    "for better balance"
                )
            elif grain_intensity < 0.015:
                recommendations.append(
                    f"✨ Consider adding subtle grain ({grain_intensity:.3f} → ~0.020-0.030) "
                    "for more natural texture"
                )
        
        # Overall quality recommendations
        if scores['overall_quality'] >= 0.8:
            recommendations.append("🌟 Excellent quality! This gradient meets professional standards.")
        elif scores['overall_quality'] >= 0.6:
            recommendations.append("✅ Good quality gradient with minor room for improvement.")
        else:
            recommendations.append("⚠️ Consider regenerating with adjusted parameters for better quality.")
        
        return recommendations
    
    def _get_quality_grade(self, overall_score: float) -> str:
        """Convert quality score to letter grade."""
        
        if overall_score >= 0.9:
            return "A+"
        elif overall_score >= 0.8:
            return "A"
        elif overall_score >= 0.7:
            return "B+"
        elif overall_score >= 0.6:
            return "B"
        elif overall_score >= 0.5:
            return "C+"
        elif overall_score >= 0.4:
            return "C"
        else:
            return "D"
    
    def quick_validate(self, image_array: np.ndarray) -> bool:
        """Quick validation check for basic quality."""
        
        # Quick smoothness check
        gray = np.dot(image_array[...,:3], [0.299, 0.587, 0.114])
        grad_variance = np.var(np.diff(gray, axis=1)) + np.var(np.diff(gray, axis=0))
        
        # Quick contrast check
        brightness_range = np.max(gray) - np.min(gray)
        
        return grad_variance < 500 and brightness_range > 30  # Basic thresholds


def validate_generation_quality(image_array: np.ndarray, 
                              generation_params: Dict,
                              verbose: bool = True) -> Dict:
    """
    Convenience function to validate gradient quality.
    
    Args:
        image_array: Generated gradient as numpy array
        generation_params: Parameters used for generation
        verbose: Whether to print results
        
    Returns:
        Quality validation results
    """
    
    validator = QualityValidator()
    results = validator.validate_gradient(image_array, generation_params)
    
    if verbose:
        print(f"\n📊 Quality Analysis:")
        print(f"   Overall Grade: {results['quality_grade']} ({results['scores']['overall_quality']:.2f})")
        print(f"   Color Harmony: {results['scores']['color_harmony']:.2f}")
        print(f"   Contrast Ratio: {results['scores']['contrast_ratio']:.2f}")
        print(f"   Smoothness: {results['scores']['smoothness']:.2f}")
        print(f"   Grain Balance: {results['scores']['grain_balance']:.2f}")
        
        if results['recommendations']:
            print(f"\n💡 Recommendations:")
            for rec in results['recommendations']:
                print(f"   {rec}")
    
    return results
