import sys
import click
import json
import random
from pathlib import Path
from typing import Optional, List, Tuple

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.core.base import GradientType, Resolution
from src.generators import *
from src.utils.color_utils import ColorPalette
from src.utils.ai_color_gen import AIColorGenerator
from src.config.presets import GradientPreset
from src.config.settings import load_config, save_config, create_default_config


class GradientGeneratorCLI:
    """Main CLI class for gradient generation."""
    
    def __init__(self):
        self.config = load_config()
        self._ensure_output_dirs()
    
    def _ensure_output_dirs(self):
        """Create output directories."""
        base_dir = Path(self.config.settings.output_dir)
        base_dir.mkdir(exist_ok=True)
        
        for res_name in Resolution.get_all():
            (base_dir / res_name).mkdir(exist_ok=True)
        
        (base_dir / "metadata").mkdir(exist_ok=True)
    
    def generate_gradient(
        self,
        preset_name: Optional[str] = None,
        gradient_type: Optional[str] = None,
        colors: Optional[List[Tuple[int, int, int]]] = None,
        resolution: str = "1080p",
        output_name: Optional[str] = None,
        **params
    ) -> bool:
        """Generate a single gradient."""
        
        try:
            # Load preset or use custom parameters
            if preset_name:
                preset = GradientPreset.get_preset(preset_name)
                grad_type = GradientType(preset["type"])
                grad_colors = preset["colors"]
                grad_params = preset["params"]
                name = preset["name"]
            else:
                if not gradient_type or not colors:
                    raise ValueError("Either preset_name or (gradient_type + colors) required")
                
                grad_type = GradientType(gradient_type)
                grad_colors = colors
                grad_params = params
                name = output_name or f"{gradient_type}_gradient"
            
            # Get resolution
            if resolution in Resolution.get_all():
                width, height = Resolution.get_all()[resolution]
            else:
                raise ValueError(f"Unknown resolution: {resolution}")
            
            # Create generator
            generator = self._create_generator(grad_type, width, height, grad_colors, grad_params)
            
            # Generate image
            print(f"🎨 Generating '{name}' using {grad_type.value} algorithm...")
            print(f"📐 Resolution: {width}x{height}")
            print(f"🎯 Colors: {len(grad_colors)} colors")
            
            # Save to specific resolution folder
            output_path = Path(self.config.settings.output_dir) / resolution / f"{name.lower().replace(' ', '_')}.png"
            generator.save(str(output_path))
            
            # Save metadata
            metadata = {
                "name": name,
                "type": grad_type.value,
                "resolution": [width, height],
                "colors": grad_colors,
                "params": grad_params,
            }
            
            metadata_path = Path(self.config.settings.output_dir) / "metadata" / f"{name.lower().replace(' ', '_')}.json"
            with open(metadata_path, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"✅ Generated: {output_path}")
            return True
            
        except Exception as e:
            print(f"❌ Error generating gradient: {e}")
            return False
    
    def _create_generator(self, grad_type: GradientType, width: int, height: int, 
                         colors: List[Tuple[int, int, int]], params: dict):
        """Create appropriate generator based on type."""
        
        if grad_type == GradientType.LINEAR:
            return LinearGradientGenerator(width, height, colors, **params)
        elif grad_type == GradientType.RADIAL:
            return RadialGradientGenerator(width, height, colors, **params)
        elif grad_type == GradientType.PERLIN:
            return PerlinNoiseGenerator(width, height, colors, **params)
        elif grad_type == GradientType.FRACTAL:
            return FractalGenerator(width, height, colors, **params)
        elif grad_type == GradientType.WAVE:
            wave_type = params.get('wave_type', 'sine')
            if wave_type == 'interference':
                return InterferencePatternGenerator(width, height, colors, **params)
            elif wave_type == 'spiral':
                return SpiralWaveGenerator(width, height, colors, **params)
            elif wave_type == 'cylindrical':
                return CylindricalWaveGenerator(width, height, colors, **params)
            else:
                return WaveGradientGenerator(width, height, colors, **params)
        elif grad_type == GradientType.ORGANIC:
            return OrganicGradientGenerator(width, height, colors, **params)
        elif grad_type == GradientType.GLASS:
            return GlassGradientGenerator(width, height, colors, **params)
        elif grad_type == GradientType.FLUID:
            return FluidGradientGenerator(width, height, colors, **params)
        else:
            # Default to linear
            return LinearGradientGenerator(width, height, colors, **params)


@click.group()
@click.version_option("1.0.0")
def cli():
    """Mathematical Gradient Generator - Create beautiful gradient wallpapers using algorithms."""
    pass


@cli.command()
@click.option('--preset', '-p', help='Preset name to use')
@click.option('--resolution', '-r', default='1080p', help='Output resolution')
@click.option('--output', '-o', help='Output filename')
def generate(preset, resolution, output):
    """Generate a gradient using a preset."""
    generator = GradientGeneratorCLI()
    
    if preset:
        success = generator.generate_gradient(
            preset_name=preset,
            resolution=resolution,
            output_name=output
        )
    else:
        print("Please specify a preset with --preset. Use 'list-presets' to see available options.")
        return
    
    if success:
        print("🎉 Gradient generated successfully!")


@cli.command()
@click.option('--type', '-t', required=True, help='Gradient type (linear, radial, perlin, fractal, wave)')
@click.option('--colors', '-c', required=True, help='Color palette name or custom RGB values')
@click.option('--resolution', '-r', default='1080p', help='Output resolution')
@click.option('--output', '-o', help='Output filename')
@click.option('--param', '-P', multiple=True, help='Custom parameters (key=value)')
def custom(type, colors, resolution, output, param):
    """Generate a custom gradient with specific parameters."""
    generator = GradientGeneratorCLI()
    
    # Parse colors
    if colors in ColorPalette.list_palettes():
        color_list = ColorPalette.get_palette(colors)
    else:
        # Try to parse as RGB values (e.g., "255,0,0 0,255,0 0,0,255")
        try:
            color_strs = colors.split()
            color_list = []
            for color_str in color_strs:
                r, g, b = map(int, color_str.split(','))
                color_list.append((r, g, b))
        except:
            print(f"Invalid colors: {colors}")
            print("Use a palette name or RGB format: '255,0,0 0,255,0 0,0,255'")
            return
    
    # Parse parameters
    params = {}
    for p in param:
        if '=' in p:
            key, value = p.split('=', 1)
            # Try to convert to number
            try:
                if '.' in value:
                    params[key] = float(value)
                else:
                    params[key] = int(value)
            except:
                params[key] = value
    
    success = generator.generate_gradient(
        gradient_type=type,
        colors=color_list,
        resolution=resolution,
        output_name=output,
        **params
    )
    
    if success:
        print("🎉 Custom gradient generated successfully!")


@cli.command(name='list-presets')
def list_presets():
    """List all available gradient presets."""
    presets = GradientPreset.list_presets()
    
    print("📋 Available Gradient Presets:")
    print("=" * 40)
    
    categories = {
        "✨ Premium Grainy": GradientPreset.get_preset_by_category("premium_grainy"),
        "🌟 Organic/Glass": GradientPreset.get_preset_by_category("organic"),
        "🧠 Neural/Tech": GradientPreset.get_preset_by_category("neural"),
        "🎨 Classic": GradientPreset.get_preset_by_category("classic"),
        "🔢 Fractal": GradientPreset.get_preset_by_category("fractal"),
        "🌊 Wave": GradientPreset.get_preset_by_category("wave"),
        "📐 Geometric": GradientPreset.get_preset_by_category("geometric"),
    }
    
    for category, preset_names in categories.items():
        if preset_names:
            print(f"\n{category}:")
            for name in preset_names:
                print(f"  • {name}")


@cli.command(name='list-palettes')
def list_palettes():
    """List all available color palettes."""
    palettes = ColorPalette.list_palettes()
    
    print("🎨 Available Color Palettes:")
    print("=" * 40)
    
    for palette in palettes:
        colors = ColorPalette.get_palette(palette)
        color_preview = " ".join([f"RGB({r},{g},{b})" for r, g, b in colors[:3]])
        print(f"  • {palette}: {color_preview}...")


@cli.command()
@click.option('--preset', '-p', help='Preset to use for batch generation')
@click.option('--count', '-n', default=5, help='Number of gradients to generate')
@click.option('--resolution', '-r', default='1080p', help='Output resolution')
def batch(preset, count, resolution):
    """Generate multiple gradients with variations."""
    generator = GradientGeneratorCLI()
    
    if preset:
        # Generate variations of the same preset
        for i in range(count):
            output_name = f"{preset}_variation_{i+1}"
            success = generator.generate_gradient(
                preset_name=preset,
                resolution=resolution,
                output_name=output_name
            )
            if not success:
                print(f"Failed to generate variation {i+1}")
    else:
        # Generate random presets
        import random
        presets = GradientPreset.list_presets()
        
        for i in range(count):
            selected_preset = random.choice(presets)
            output_name = f"batch_{i+1}_{selected_preset.lower().replace(' ', '_')}"
            success = generator.generate_gradient(
                preset_name=selected_preset,
                resolution=resolution,
                output_name=output_name
            )
            if not success:
                print(f"Failed to generate batch item {i+1}")
    
    print(f"🎉 Batch generation complete! Generated {count} gradients.")


@cli.command()
def init():
    """Initialize configuration file with defaults."""
    config = create_default_config()
    save_config(config)
    print("✅ Configuration initialized: config.json")
    print("Edit this file to customize default settings.")


@cli.command()
def demo():
    """Generate a demo set showing different gradient types."""
    generator = GradientGeneratorCLI()
    
    demo_presets = [
        "Glass Morph",
        "Organic Flow",
        "Fluid Dreams",
        "Crystal Blue",
        "Neural Flow",
        "Ocean Depths"
    ]
    
    print("🎬 Generating demo set...")
    
    for preset in demo_presets:
        print(f"Generating {preset}...")
        success = generator.generate_gradient(
            preset_name=preset,
            resolution="1080p",
            output_name=f"demo_{preset.lower().replace(' ', '_')}"
        )
        if not success:
            print(f"Failed to generate {preset}")
    
    print("🎉 Demo set complete! Check the outputs folder.")


@cli.command(name='ai-generate')
@click.option('--style', '-s', default='modern', help='AI style: modern, vintage, neon, pastel, nature, emotion')
@click.option('--type', '-t', default='glass', help='Gradient type: organic, glass, fluid')
@click.option('--resolution', '-r', default='1080p', help='Output resolution')
@click.option('--output', '-o', help='Output filename')
@click.option('--seed', help='Random seed for reproducible results')
def ai_generate(style, type, resolution, output, seed):
    """Generate a gradient using AI-powered color generation."""
    generator = GradientGeneratorCLI()
    ai_gen = AIColorGenerator(seed=int(seed) if seed else None)
    
    # Generate AI colors based on style
    if style in ['modern', 'vintage', 'neon', 'pastel', 'earthy']:
        colors = ai_gen.generate_trend_palette(style, 4)
        style_name = f"AI {style.title()} Trend"
    elif style in ['spring', 'summer', 'autumn', 'winter', 'ocean', 'forest', 'desert']:
        colors = ai_gen.generate_nature_palette(style, 4)
        style_name = f"AI {style.title()} Nature"
    elif style in ['calm', 'energetic', 'mysterious', 'joyful', 'elegant', 'fresh']:
        colors = ai_gen.generate_emotion_palette(style, 4)
        style_name = f"AI {style.title()} Emotion"
    elif style == 'fusion':
        colors = ai_gen.generate_ai_fusion_palette(4, 0.7)
        style_name = "AI Fusion"
    else:
        colors = ai_gen.generate_trend_palette('modern', 4)
        style_name = "AI Modern"
    
    # Set parameters based on type
    if type == 'glass':
        params = {
            'layers': 4,
            'reflection': 0.2,
            'distortion': 0.1,
            'highlights': 0.3,
            'angle': random.randint(0, 180),
            'grain_intensity': 0.03,
            'grain_type': 'photographic'
        }
    elif type == 'organic':
        params = {
            'smoothness': random.uniform(5.0, 8.0),
            'flow_strength': random.uniform(0.15, 0.3),
            'grain_intensity': random.uniform(0.02, 0.04),
            'grain_type': random.choice(['photographic', 'film', 'artistic']),
            'angle': random.randint(0, 180)
        }
    elif type == 'fluid':
        params = {
            'complexity': random.uniform(2.5, 4.0),
            'smoothness': random.uniform(6.0, 8.0),
            'bleeding': random.uniform(0.2, 0.4),
            'grain_intensity': random.uniform(0.025, 0.035),
            'grain_type': random.choice(['photographic', 'film'])
        }
    else:
        params = {}
    
    output_name = output or f"ai_{style}_{type}_{random.randint(1000, 9999)}"
    
    print(f"🤖 Generating AI-powered gradient: {style_name}")
    print(f"🎨 Colors: {colors}")
    print(f"⚙️  Type: {type}")
    
    success = generator.generate_gradient(
        gradient_type=type,
        colors=colors,
        resolution=resolution,
        output_name=output_name,
        **params
    )
    
    if success:
        print("🎉 AI gradient generated successfully!")


@cli.command(name='ai-batch')
@click.option('--count', '-n', default=5, help='Number of AI gradients to generate')
@click.option('--resolution', '-r', default='1080p', help='Output resolution')
@click.option('--mix-styles', is_flag=True, help='Mix different AI styles')
def ai_batch(count, resolution, mix_styles):
    """Generate multiple AI-powered gradients with random variations."""
    generator = GradientGeneratorCLI()
    
    styles = ['modern', 'vintage', 'neon', 'pastel', 'ocean', 'forest', 'calm', 'energetic', 'fusion']
    types = ['glass', 'organic', 'fluid']
    
    print(f"🤖 Generating {count} AI-powered gradients...")
    
    for i in range(count):
        style = random.choice(styles) if mix_styles else 'fusion'
        gradient_type = random.choice(types)
        seed = random.randint(1, 10000)
        
        ai_gen = AIColorGenerator(seed=seed)
        
        # Generate colors
        if style in ['modern', 'vintage', 'neon', 'pastel', 'earthy']:
            colors = ai_gen.generate_trend_palette(style, 4)
        elif style in ['spring', 'summer', 'autumn', 'winter', 'ocean', 'forest', 'desert']:
            colors = ai_gen.generate_nature_palette(style, 4)
        elif style in ['calm', 'energetic', 'mysterious', 'joyful', 'elegant', 'fresh']:
            colors = ai_gen.generate_emotion_palette(style, 4)
        else:  # fusion
            colors = ai_gen.generate_ai_fusion_palette(4, random.uniform(0.5, 0.9))
        
        # Generate random parameters
        if gradient_type == 'glass':
            params = {
                'layers': random.randint(3, 6),
                'reflection': random.uniform(0.1, 0.4),
                'distortion': random.uniform(0.05, 0.15),
                'highlights': random.uniform(0.25, 0.45),
                'angle': random.randint(0, 180),
                'grain_intensity': random.uniform(0.02, 0.04),
                'grain_type': random.choice(['photographic', 'film', 'artistic'])
            }
        elif gradient_type == 'organic':
            params = {
                'smoothness': random.uniform(4.0, 8.0),
                'flow_strength': random.uniform(0.1, 0.35),
                'grain_intensity': random.uniform(0.02, 0.045),
                'grain_type': random.choice(['photographic', 'film', 'artistic']),
                'angle': random.randint(0, 180)
            }
        else:  # fluid
            params = {
                'complexity': random.uniform(2.0, 4.5),
                'smoothness': random.uniform(5.0, 9.0),
                'bleeding': random.uniform(0.15, 0.45),
                'grain_intensity': random.uniform(0.02, 0.04),
                'grain_type': random.choice(['photographic', 'film'])
            }
        
        output_name = f"ai_batch_{i+1}_{style}_{gradient_type}_{seed}"
        
        print(f"Generating {i+1}/{count}: {style} {gradient_type} (seed: {seed})")
        
        success = generator.generate_gradient(
            gradient_type=gradient_type,
            colors=colors,
            resolution=resolution,
            output_name=output_name,
            **params
        )
        
        if not success:
            print(f"Failed to generate gradient {i+1}")
    
    print("🎉 AI batch generation complete!")


@cli.command(name='premium-demo')
def premium_demo():
    """Generate samples from the new Premium Grainy collection."""
    generator = GradientGeneratorCLI()
    
    premium_presets = [
        "Grainy Sunset",
        "Ocean Grain", 
        "Frosted Glass",
        "Coral Dream",
        "Purple Haze",
        "Golden Hour",
        "Ice Crystal",
        "Ethereal Blue"
    ]
    
    print("✨ Generating Premium Grainy demo collection...")
    
    for preset in premium_presets:
        print(f"Generating {preset}...")
        success = generator.generate_gradient(
            preset_name=preset,
            resolution="1080p",
            output_name=f"premium_{preset.lower().replace(' ', '_')}"
        )
        if not success:
            print(f"Failed to generate {preset}")
    
    print("✨ Premium Grainy demo complete! Check the outputs folder.")


if __name__ == "__main__":
    cli()