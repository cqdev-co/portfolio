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
        output_format: str = "png",
        **params,
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
                    raise ValueError(
                        "Either preset_name or (gradient_type + colors) required"
                    )

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
            generator = self._create_generator(
                grad_type, width, height, grad_colors, grad_params
            )

            # Generate image
            print(f"🎨 Generating '{name}' using {grad_type.value} algorithm...")
            print(f"📐 Resolution: {width}x{height}")
            print(f"🎯 Colors: {len(grad_colors)} colors")

            # Save to specific resolution folder with specified format
            file_extension = output_format.lower()
            if file_extension not in ["png", "jpg", "jpeg"]:
                file_extension = "png"  # Default fallback

            output_path = (
                Path(self.config.settings.output_dir)
                / resolution
                / f"{name.lower().replace(' ', '_')}.{file_extension}"
            )

            # Pass quality for JPEG
            if file_extension in ["jpg", "jpeg"]:
                generator.save(
                    str(output_path), quality=self.config.settings.jpeg_quality
                )
            else:
                generator.save(str(output_path))

            # Save metadata
            metadata = {
                "name": name,
                "type": grad_type.value,
                "resolution": [width, height],
                "colors": grad_colors,
                "params": grad_params,
            }

            metadata_path = (
                Path(self.config.settings.output_dir)
                / "metadata"
                / f"{name.lower().replace(' ', '_')}.json"
            )
            with open(metadata_path, "w") as f:
                json.dump(metadata, f, indent=2)

            print(f"✅ Generated: {output_path}")
            return True

        except Exception as e:
            print(f"❌ Error generating gradient: {e}")
            return False

    def _create_generator(
        self,
        grad_type: GradientType,
        width: int,
        height: int,
        colors: List[Tuple[int, int, int]],
        params: dict,
    ):
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
            wave_type = params.get("wave_type", "sine")
            if wave_type == "interference":
                return InterferencePatternGenerator(width, height, colors, **params)
            elif wave_type == "spiral":
                return SpiralWaveGenerator(width, height, colors, **params)
            elif wave_type == "cylindrical":
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
@click.option("--preset", "-p", help="Preset name to use")
@click.option("--resolution", "-r", default="1080p", help="Output resolution")
@click.option("--output", "-o", help="Output filename")
def generate(preset, resolution, output):
    """Generate a gradient using a preset."""
    generator = GradientGeneratorCLI()

    if preset:
        success = generator.generate_gradient(
            preset_name=preset, resolution=resolution, output_name=output
        )
    else:
        print(
            "Please specify a preset with --preset. Use 'list-presets' to see available options."
        )
        return

    if success:
        print("🎉 Gradient generated successfully!")


@cli.command()
@click.option(
    "--type",
    "-t",
    required=True,
    help="Gradient type (linear, radial, perlin, fractal, wave)",
)
@click.option(
    "--colors", "-c", required=True, help="Color palette name or custom RGB values"
)
@click.option("--resolution", "-r", default="1080p", help="Output resolution")
@click.option("--output", "-o", help="Output filename")
@click.option("--param", "-P", multiple=True, help="Custom parameters (key=value)")
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
                r, g, b = map(int, color_str.split(","))
                color_list.append((r, g, b))
        except:
            print(f"Invalid colors: {colors}")
            print("Use a palette name or RGB format: '255,0,0 0,255,0 0,0,255'")
            return

    # Parse parameters
    params = {}
    for p in param:
        if "=" in p:
            key, value = p.split("=", 1)
            # Try to convert to number
            try:
                if "." in value:
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
        **params,
    )

    if success:
        print("🎉 Custom gradient generated successfully!")


@cli.command(name="list-presets")
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


@cli.command(name="list-palettes")
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
@click.option("--preset", "-p", help="Preset to use for batch generation")
@click.option("--count", "-n", default=5, help="Number of gradients to generate")
@click.option("--resolution", "-r", default="1080p", help="Output resolution")
def batch(preset, count, resolution):
    """Generate multiple gradients with variations."""
    generator = GradientGeneratorCLI()

    if preset:
        # Generate variations of the same preset
        for i in range(count):
            output_name = f"{preset}_variation_{i + 1}"
            success = generator.generate_gradient(
                preset_name=preset, resolution=resolution, output_name=output_name
            )
            if not success:
                print(f"Failed to generate variation {i + 1}")
    else:
        # Generate random presets
        import random

        presets = GradientPreset.list_presets()

        for i in range(count):
            selected_preset = random.choice(presets)
            output_name = f"batch_{i + 1}_{selected_preset.lower().replace(' ', '_')}"
            success = generator.generate_gradient(
                preset_name=selected_preset,
                resolution=resolution,
                output_name=output_name,
            )
            if not success:
                print(f"Failed to generate batch item {i + 1}")

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
        "Ocean Depths",
    ]

    print("🎬 Generating demo set...")

    for preset in demo_presets:
        print(f"Generating {preset}...")
        success = generator.generate_gradient(
            preset_name=preset,
            resolution="1080p",
            output_name=f"demo_{preset.lower().replace(' ', '_')}",
        )
        if not success:
            print(f"Failed to generate {preset}")

    print("🎉 Demo set complete! Check the outputs folder.")


@cli.command(name="stock-quality")
@click.option(
    "--style",
    "-s",
    default="glass",
    help="Professional style: glass, rich, vibrant, sophisticated",
)
@click.option(
    "--type", "-t", default="glass", help="Gradient type: organic, glass, fluid"
)
@click.option("--resolution", "-r", default="1080p", help="Output resolution")
@click.option("--output", "-o", help="Output filename")
@click.option("--seed", help="Random seed for reproducible results")
@click.option(
    "--complexity", type=float, default=0.8, help="Complexity level (0.0-1.0)"
)
@click.option("--format", default="png", help="Output format: png, jpg, jpeg")
def stock_quality(style, type, resolution, output, seed, complexity, format):
    """Generate stock-photo quality gradients with all professional enhancements enabled."""
    generator = GradientGeneratorCLI()
    ai_gen = AIColorGenerator(seed=int(seed) if seed else None)

    print(f"🌟 Generating STOCK-QUALITY gradient with all professional enhancements...")
    print(f"✨ Style: {style} | Type: {type} | Complexity: {complexity}")

    # Always use professional palette generation
    colors = ai_gen.generate_professional_palette(style, 4)

    # Maximum quality parameters
    if type == "glass":
        params = {
            "layers": int(7 + complexity * 3),  # More layers for depth
            "reflection": 0.4 + complexity * 0.3,  # Strong reflections
            "distortion": 0.15 + complexity * 0.1,  # Realistic distortion
            "highlights": 0.6 + complexity * 0.3,  # Prominent highlights
            "angle": random.randint(15, 165),  # Avoid harsh angles
            "grain_intensity": 0.045 + complexity * 0.01,  # Professional grain
            "grain_type": "photographic",
            "grain_quality": "professional",
            "holographic": True,  # Always enable holographic
            "holographic_intensity": 0.4 + complexity * 0.2,
            "gamma_correct": True,  # Always gamma correct
            "anti_banding": True,  # Always anti-banding
        }
    elif type == "organic":
        params = {
            "smoothness": 8.0 + complexity * 4.0,  # Ultra-smooth
            "flow_strength": 0.2 + complexity * 0.2,
            "grain_intensity": 0.04 + complexity * 0.01,
            "grain_type": "photographic",
            "grain_quality": "professional",
            "angle": random.randint(15, 165),
            "gamma_correct": True,
            "anti_banding": True,
        }
    elif type == "fluid":
        params = {
            "complexity": 4.0 + complexity * 4.0,  # Maximum fluidity
            "smoothness": 10.0 + complexity * 6.0,  # Paint-like smoothness
            "bleeding": 0.3 + complexity * 0.3,
            "grain_intensity": 0.04 + complexity * 0.01,
            "grain_type": "photographic",
            "grain_quality": "professional",
            "gamma_correct": True,
            "anti_banding": True,
        }

    # Handle output format
    file_extension = "jpg" if format.lower() in ["jpg", "jpeg"] else "png"
    output_name = output or f"stock_{style}_{type}_{random.randint(1000, 9999)}"

    print(f"🎨 Professional Colors: {colors}")
    print(
        f"⚙️  Enhanced Parameters: {', '.join(f'{k}={v}' for k, v in list(params.items())[:3])}..."
    )
    print(f"📄 Format: {file_extension.upper()}")

    success = generator.generate_gradient(
        gradient_type=type,
        colors=colors,
        resolution=resolution,
        output_name=output_name,
        output_format=file_extension,
        **params,
    )

    if success:
        print(f"✅ Stock-quality gradient generated successfully!")
        print(f"📁 Output: {output_name}")
        print(
            f"💎 Features: Professional grain, Gamma correction, Anti-banding, Enhanced colors"
        )
        if type == "glass" and params.get("holographic"):
            print(f"🌈 Holographic effects enabled!")
    else:
        print(f"❌ Failed to generate gradient")


@cli.command(name="ai-generate")
@click.option(
    "--style",
    "-s",
    default="modern",
    help="AI style: modern, vintage, neon, pastel, nature, emotion, fusion",
)
@click.option(
    "--type", "-t", default="glass", help="Gradient type: organic, glass, fluid"
)
@click.option("--resolution", "-r", default="1080p", help="Output resolution")
@click.option("--output", "-o", help="Output filename")
@click.option("--seed", help="Random seed for reproducible results")
@click.option(
    "--professional", is_flag=True, help="Enable professional quality enhancements"
)
@click.option(
    "--holographic", is_flag=True, help="Enable holographic effects for glass gradients"
)
@click.option(
    "--grain-quality", default="standard", help="Grain quality: standard, professional"
)
@click.option(
    "--complexity", type=float, default=0.6, help="Complexity level (0.0-1.0)"
)
@click.option(
    "--use-openai", is_flag=True, help="Use OpenAI GPT for true AI color generation"
)
@click.option("--prompt", help="Custom prompt for OpenAI color generation")
@click.option("--format", default="png", help="Output format: png, jpg, jpeg")
@click.option(
    "--web-optimized",
    is_flag=True,
    help="Optimize for web display (based on real-world testing)",
)
def ai_generate(
    style,
    type,
    resolution,
    output,
    seed,
    professional,
    holographic,
    grain_quality,
    complexity,
    use_openai,
    prompt,
    format,
    web_optimized,
):
    """Generate a gradient using AI-powered color generation."""
    generator = GradientGeneratorCLI()
    ai_gen = AIColorGenerator(seed=int(seed) if seed else None, use_openai=use_openai)

    # Generate AI colors - OpenAI or local AI-inspired
    if use_openai and prompt:
        # Custom prompt mode
        colors = ai_gen.generate_openai_palette(prompt, 4, style)
        style_name = f"OpenAI: {prompt[:30]}..."
    elif use_openai:
        # Style-based OpenAI generation
        colors = ai_gen.generate_openai_style_palette(style, 4)
        style_name = f"OpenAI {style.title()}"
    elif professional and style in ["glass", "rich", "vibrant", "sophisticated"]:
        colors = ai_gen.generate_professional_palette(style, 4)
        style_name = f"Professional {style.title()}"
    elif style in ["modern", "vintage", "neon", "pastel", "earthy"]:
        colors = ai_gen.generate_trend_palette(style, 4)
        style_name = f"AI {style.title()} Trend"
    elif style in ["spring", "summer", "autumn", "winter", "ocean", "forest", "desert"]:
        colors = ai_gen.generate_nature_palette(style, 4)
        style_name = f"AI {style.title()} Nature"
    elif style in ["calm", "energetic", "mysterious", "joyful", "elegant", "fresh"]:
        colors = ai_gen.generate_emotion_palette(style, 4)
        style_name = f"AI {style.title()} Emotion"
    elif style == "fusion":
        colors = ai_gen.generate_ai_fusion_palette(4, complexity)
        style_name = "AI Fusion"
    else:
        colors = ai_gen.generate_trend_palette("modern", 4)
        style_name = "AI Modern"

    # Set parameters based on type with professional enhancements
    base_grain = 0.04 if professional else 0.03

    if type == "glass":
        params = {
            "layers": int(6 + complexity * 2) if professional else 4,
            "reflection": (0.3 + complexity * 0.3) if professional else 0.2,
            "distortion": (0.12 + complexity * 0.08) if professional else 0.1,
            "highlights": (0.5 + complexity * 0.2) if professional else 0.3,
            "angle": random.randint(0, 180),
            "grain_intensity": base_grain + complexity * 0.02,
            "grain_type": "photographic",
            "grain_quality": grain_quality,
            "holographic": holographic,
            "holographic_intensity": 0.3 + complexity * 0.2,
            "gamma_correct": professional,
            "anti_banding": professional,
            "web_optimized": web_optimized,
            "output_format": file_extension,
        }
    elif type == "organic":
        params = {
            "smoothness": random.uniform(7.0, 10.0)
            if professional
            else random.uniform(5.0, 8.0),
            "flow_strength": random.uniform(0.15, 0.3),
            "grain_intensity": base_grain + complexity * 0.015,
            "grain_type": random.choice(["photographic", "film", "artistic"]),
            "grain_quality": grain_quality,
            "angle": random.randint(0, 180),
            "gamma_correct": professional,
            "anti_banding": professional,
        }
    elif type == "fluid":
        params = {
            "complexity": random.uniform(3.5, 6.0)
            if professional
            else random.uniform(2.5, 4.0),
            "smoothness": random.uniform(8.0, 12.0)
            if professional
            else random.uniform(6.0, 8.0),
            "bleeding": random.uniform(0.2, 0.4),
            "grain_intensity": base_grain + complexity * 0.015,
            "grain_type": random.choice(["photographic", "film"]),
            "grain_quality": grain_quality,
            "gamma_correct": professional,
            "anti_banding": professional,
            "web_optimized": web_optimized,
            "output_format": file_extension,
        }
    else:
        params = {
            "gamma_correct": professional,
            "anti_banding": professional,
            "grain_quality": grain_quality,
            "web_optimized": web_optimized,
            "output_format": file_extension,
        }

    # Handle output format
    file_extension = "jpg" if format.lower() in ["jpg", "jpeg"] else "png"
    output_name = output or f"ai_{style}_{type}_{random.randint(1000, 9999)}"

    print(f"🤖 Generating AI-powered gradient: {style_name}")
    print(f"🎨 Colors: {colors}")
    print(f"⚙️  Type: {type}")
    print(f"📄 Format: {file_extension.upper()}")

    success = generator.generate_gradient(
        gradient_type=type,
        colors=colors,
        resolution=resolution,
        output_name=output_name,
        output_format=file_extension,
        **params,
    )

    if success:
        print("🎉 AI gradient generated successfully!")


@cli.command(name="ai-enhanced")
@click.option(
    "--prompt",
    help='AI prompt describing desired wallpaper (e.g., "serene ocean sunset with soft lighting")',
)
@click.option(
    "--mood",
    default="balanced",
    help="Mood: calm, energetic, mysterious, joyful, dramatic, serene, intense",
)
@click.option(
    "--lighting",
    default="natural",
    help="Lighting style: natural, dramatic, soft, ambient, neon, cinematic, golden",
)
@click.option(
    "--composition",
    default="balanced",
    help="Composition: balanced, dynamic, flowing, geometric, organic, asymmetric",
)
@click.option(
    "--texture-style",
    default="smooth",
    help="Texture: smooth, grainy, silky, rough, metallic, glassy, organic",
)
@click.option(
    "--atmosphere",
    default="clear",
    help="Atmosphere: clear, hazy, dreamy, crisp, ethereal, vibrant, muted",
)
@click.option(
    "--color-temperature",
    default="neutral",
    help="Color temperature: warm, cool, neutral, golden, blue, violet",
)
@click.option("--depth", type=float, default=0.5, help="Depth perception (0.0-1.0)")
@click.option(
    "--complexity", type=float, default=0.6, help="Overall complexity (0.0-1.0)"
)
@click.option(
    "--use-openai", is_flag=True, help="Use OpenAI for advanced AI generation"
)
@click.option("--resolution", "-r", default="1080p", help="Output resolution")
@click.option("--output", "-o", help="Output filename")
@click.option("--format", default="png", help="Output format: png, jpg, jpeg")
def ai_enhanced(
    prompt,
    mood,
    lighting,
    composition,
    texture_style,
    atmosphere,
    color_temperature,
    depth,
    complexity,
    use_openai,
    resolution,
    output,
    format,
):
    """Generate wallpapers with enhanced AI control over mood, lighting, composition, and atmosphere."""
    generator = GradientGeneratorCLI()
    ai_gen = AIColorGenerator(use_openai=use_openai)

    print(f"🤖 AI Enhanced Generation")
    print(f"💭 Prompt: {prompt or 'Auto-generated based on parameters'}")
    print(f"🎭 Mood: {mood} | 💡 Lighting: {lighting} | 🎨 Composition: {composition}")
    print(
        f"🖌️  Texture: {texture_style} | 🌫️  Atmosphere: {atmosphere} | 🌡️  Temperature: {color_temperature}"
    )

    # Generate AI-influenced parameters
    ai_params = _generate_ai_influenced_parameters(
        prompt,
        mood,
        lighting,
        composition,
        texture_style,
        atmosphere,
        color_temperature,
        depth,
        complexity,
        ai_gen,
        use_openai,
    )

    # Generate colors based on enhanced AI understanding
    if use_openai and prompt:
        enhanced_prompt = _create_enhanced_color_prompt(
            prompt, mood, lighting, atmosphere, color_temperature
        )
        colors = ai_gen.generate_openai_palette(enhanced_prompt, 4, mood)
    else:
        colors = _generate_contextual_colors(
            mood, lighting, atmosphere, color_temperature, ai_gen
        )

    # Determine best gradient type based on composition
    gradient_type = _select_gradient_type_for_composition(
        composition, ai_params["surface_style"]
    )

    # Handle output format
    file_extension = "jpg" if format.lower() in ["jpg", "jpeg"] else "png"
    output_name = (
        output or f"ai_enhanced_{mood}_{lighting}_{random.randint(1000, 9999)}"
    )

    print(f"⚙️  AI Parameters: {gradient_type} with {len(ai_params)} enhanced controls")
    print(f"🎨 AI Colors: {colors}")

    success = generator.generate_gradient(
        gradient_type=gradient_type,
        colors=colors,
        resolution=resolution,
        output_name=output_name,
        output_format=file_extension,
        **ai_params,
    )

    if success:
        print("🎉 AI Enhanced gradient generated successfully!")
        print(
            f"✨ Features: AI-driven {texture_style} texture, {lighting} lighting, {atmosphere} atmosphere"
        )


@cli.command(name="ai-mood-batch")
@click.option("--count", "-n", default=8, help="Number of AI gradients to generate")
@click.option(
    "--theme",
    default="emotions",
    help="Batch theme: emotions, lighting, atmosphere, temperature, mixed",
)
@click.option("--resolution", "-r", default="1080p", help="Output resolution")
@click.option("--use-openai", is_flag=True, help="Use OpenAI for enhanced generation")
@click.option(
    "--complexity", type=float, default=0.7, help="Overall complexity (0.0-1.0)"
)
def ai_mood_batch(count, theme, resolution, use_openai, complexity):
    """Generate a batch of AI wallpapers exploring different moods, lighting, and atmospheres."""
    generator = GradientGeneratorCLI()

    # Define theme collections
    theme_collections = {
        "emotions": {
            "configs": [
                {
                    "mood": "calm",
                    "lighting": "soft",
                    "atmosphere": "dreamy",
                    "color_temperature": "cool",
                },
                {
                    "mood": "energetic",
                    "lighting": "dramatic",
                    "atmosphere": "vibrant",
                    "color_temperature": "warm",
                },
                {
                    "mood": "mysterious",
                    "lighting": "ambient",
                    "atmosphere": "hazy",
                    "color_temperature": "violet",
                },
                {
                    "mood": "joyful",
                    "lighting": "natural",
                    "atmosphere": "clear",
                    "color_temperature": "golden",
                },
                {
                    "mood": "serene",
                    "lighting": "golden",
                    "atmosphere": "ethereal",
                    "color_temperature": "warm",
                },
                {
                    "mood": "intense",
                    "lighting": "neon",
                    "atmosphere": "crisp",
                    "color_temperature": "blue",
                },
                {
                    "mood": "dramatic",
                    "lighting": "cinematic",
                    "atmosphere": "muted",
                    "color_temperature": "neutral",
                },
                {
                    "mood": "balanced",
                    "lighting": "natural",
                    "atmosphere": "clear",
                    "color_temperature": "neutral",
                },
            ]
        },
        "lighting": {
            "configs": [
                {
                    "mood": "calm",
                    "lighting": "natural",
                    "atmosphere": "clear",
                    "color_temperature": "neutral",
                },
                {
                    "mood": "energetic",
                    "lighting": "dramatic",
                    "atmosphere": "vibrant",
                    "color_temperature": "warm",
                },
                {
                    "mood": "serene",
                    "lighting": "soft",
                    "atmosphere": "dreamy",
                    "color_temperature": "cool",
                },
                {
                    "mood": "mysterious",
                    "lighting": "ambient",
                    "atmosphere": "hazy",
                    "color_temperature": "violet",
                },
                {
                    "mood": "intense",
                    "lighting": "neon",
                    "atmosphere": "crisp",
                    "color_temperature": "blue",
                },
                {
                    "mood": "joyful",
                    "lighting": "golden",
                    "atmosphere": "ethereal",
                    "color_temperature": "golden",
                },
                {
                    "mood": "dramatic",
                    "lighting": "cinematic",
                    "atmosphere": "muted",
                    "color_temperature": "neutral",
                },
                {
                    "mood": "balanced",
                    "lighting": "natural",
                    "atmosphere": "clear",
                    "color_temperature": "neutral",
                },
            ]
        },
        "atmosphere": {
            "configs": [
                {
                    "mood": "calm",
                    "lighting": "soft",
                    "atmosphere": "clear",
                    "color_temperature": "neutral",
                },
                {
                    "mood": "mysterious",
                    "lighting": "ambient",
                    "atmosphere": "hazy",
                    "color_temperature": "cool",
                },
                {
                    "mood": "serene",
                    "lighting": "golden",
                    "atmosphere": "dreamy",
                    "color_temperature": "warm",
                },
                {
                    "mood": "energetic",
                    "lighting": "dramatic",
                    "atmosphere": "crisp",
                    "color_temperature": "vibrant",
                },
                {
                    "mood": "joyful",
                    "lighting": "natural",
                    "atmosphere": "ethereal",
                    "color_temperature": "golden",
                },
                {
                    "mood": "intense",
                    "lighting": "neon",
                    "atmosphere": "vibrant",
                    "color_temperature": "blue",
                },
                {
                    "mood": "dramatic",
                    "lighting": "cinematic",
                    "atmosphere": "muted",
                    "color_temperature": "violet",
                },
                {
                    "mood": "balanced",
                    "lighting": "ambient",
                    "atmosphere": "clear",
                    "color_temperature": "neutral",
                },
            ]
        },
        "temperature": {
            "configs": [
                {
                    "mood": "calm",
                    "lighting": "soft",
                    "atmosphere": "clear",
                    "color_temperature": "cool",
                },
                {
                    "mood": "energetic",
                    "lighting": "dramatic",
                    "atmosphere": "vibrant",
                    "color_temperature": "warm",
                },
                {
                    "mood": "serene",
                    "lighting": "golden",
                    "atmosphere": "dreamy",
                    "color_temperature": "golden",
                },
                {
                    "mood": "mysterious",
                    "lighting": "ambient",
                    "atmosphere": "hazy",
                    "color_temperature": "violet",
                },
                {
                    "mood": "joyful",
                    "lighting": "natural",
                    "atmosphere": "ethereal",
                    "color_temperature": "blue",
                },
                {
                    "mood": "intense",
                    "lighting": "neon",
                    "atmosphere": "crisp",
                    "color_temperature": "neutral",
                },
                {
                    "mood": "dramatic",
                    "lighting": "cinematic",
                    "atmosphere": "muted",
                    "color_temperature": "warm",
                },
                {
                    "mood": "balanced",
                    "lighting": "natural",
                    "atmosphere": "clear",
                    "color_temperature": "cool",
                },
            ]
        },
        "mixed": {
            "configs": [
                {
                    "mood": "calm",
                    "lighting": "soft",
                    "atmosphere": "dreamy",
                    "color_temperature": "cool",
                },
                {
                    "mood": "energetic",
                    "lighting": "neon",
                    "atmosphere": "vibrant",
                    "color_temperature": "warm",
                },
                {
                    "mood": "mysterious",
                    "lighting": "cinematic",
                    "atmosphere": "hazy",
                    "color_temperature": "violet",
                },
                {
                    "mood": "joyful",
                    "lighting": "golden",
                    "atmosphere": "clear",
                    "color_temperature": "golden",
                },
                {
                    "mood": "serene",
                    "lighting": "ambient",
                    "atmosphere": "ethereal",
                    "color_temperature": "blue",
                },
                {
                    "mood": "intense",
                    "lighting": "dramatic",
                    "atmosphere": "crisp",
                    "color_temperature": "neutral",
                },
                {
                    "mood": "dramatic",
                    "lighting": "soft",
                    "atmosphere": "muted",
                    "color_temperature": "warm",
                },
                {
                    "mood": "balanced",
                    "lighting": "natural",
                    "atmosphere": "clear",
                    "color_temperature": "cool",
                },
            ]
        },
    }

    # Composition styles to cycle through
    compositions = [
        "balanced",
        "dynamic",
        "flowing",
        "geometric",
        "organic",
        "asymmetric",
    ]
    texture_styles = ["smooth", "grainy", "silky", "glassy", "organic", "metallic"]

    selected_theme = theme_collections.get(theme, theme_collections["emotions"])
    configs = selected_theme["configs"]

    print(f"🎨 Generating {count} AI wallpapers with '{theme}' theme")
    print(
        f"🤖 OpenAI: {'Enabled' if use_openai else 'Local AI'} | Complexity: {complexity}"
    )
    print("─" * 50)

    successful_generations = 0

    for i in range(count):
        # Select configuration (cycle through if count > available configs)
        config = configs[i % len(configs)]
        composition = compositions[i % len(compositions)]
        texture_style = texture_styles[i % len(texture_styles)]

        # Add some variation to depth
        depth = 0.3 + (i / count) * 0.6  # Progress from 0.3 to 0.9

        print(f"\n🎭 Generation {i + 1}/{count}:")
        print(f"   Mood: {config['mood']} | Lighting: {config['lighting']}")
        print(
            f"   Atmosphere: {config['atmosphere']} | Temperature: {config['color_temperature']}"
        )
        print(
            f"   Composition: {composition} | Texture: {texture_style} | Depth: {depth:.1f}"
        )

        # Generate using enhanced AI
        ai_gen = AIColorGenerator(use_openai=use_openai)

        # Generate AI-influenced parameters
        ai_params = _generate_ai_influenced_parameters(
            None,
            config["mood"],
            config["lighting"],
            composition,
            texture_style,
            config["atmosphere"],
            config["color_temperature"],
            depth,
            complexity,
            ai_gen,
            use_openai,
        )

        # Generate contextual colors
        colors = _generate_contextual_colors(
            config["mood"],
            config["lighting"],
            config["atmosphere"],
            config["color_temperature"],
            ai_gen,
        )

        # Select gradient type
        gradient_type = _select_gradient_type_for_composition(
            composition, ai_params["surface_style"]
        )

        # Create descriptive output name
        output_name = f"ai_mood_{theme}_{i + 1:02d}_{config['mood']}_{config['lighting']}_{composition}"

        # Generate the wallpaper
        success = generator.generate_gradient(
            gradient_type=gradient_type,
            colors=colors,
            resolution=resolution,
            output_name=output_name,
            output_format="png",
            **ai_params,
        )

        if success:
            successful_generations += 1
            print(f"   ✅ Generated: {output_name}")
        else:
            print(f"   ❌ Failed to generate {output_name}")

    print("\n" + "─" * 50)
    print(
        f"🎉 Batch complete! {successful_generations}/{count} wallpapers generated successfully"
    )
    print(f"📁 Check outputs/{resolution}/ for your AI mood collection")


@cli.command(name="ai-batch")
@click.option("--count", "-n", default=5, help="Number of AI gradients to generate")
@click.option("--resolution", "-r", default="1080p", help="Output resolution")
@click.option("--mix-styles", is_flag=True, help="Mix different AI styles")
def ai_batch(count, resolution, mix_styles):
    """Generate multiple AI-powered gradients with random variations."""
    generator = GradientGeneratorCLI()

    styles = [
        "modern",
        "vintage",
        "neon",
        "pastel",
        "ocean",
        "forest",
        "calm",
        "energetic",
        "fusion",
    ]
    types = ["glass", "organic", "fluid"]

    print(f"🤖 Generating {count} AI-powered gradients...")

    for i in range(count):
        style = random.choice(styles) if mix_styles else "fusion"
        gradient_type = random.choice(types)
        seed = random.randint(1, 10000)

        ai_gen = AIColorGenerator(seed=seed)

        # Generate colors
        if style in ["modern", "vintage", "neon", "pastel", "earthy"]:
            colors = ai_gen.generate_trend_palette(style, 4)
        elif style in [
            "spring",
            "summer",
            "autumn",
            "winter",
            "ocean",
            "forest",
            "desert",
        ]:
            colors = ai_gen.generate_nature_palette(style, 4)
        elif style in ["calm", "energetic", "mysterious", "joyful", "elegant", "fresh"]:
            colors = ai_gen.generate_emotion_palette(style, 4)
        else:  # fusion
            colors = ai_gen.generate_ai_fusion_palette(4, random.uniform(0.5, 0.9))

        # Generate random parameters
        if gradient_type == "glass":
            params = {
                "layers": random.randint(3, 6),
                "reflection": random.uniform(0.1, 0.4),
                "distortion": random.uniform(0.05, 0.15),
                "highlights": random.uniform(0.25, 0.45),
                "angle": random.randint(0, 180),
                "grain_intensity": random.uniform(0.02, 0.04),
                "grain_type": random.choice(["photographic", "film", "artistic"]),
            }
        elif gradient_type == "organic":
            params = {
                "smoothness": random.uniform(4.0, 8.0),
                "flow_strength": random.uniform(0.1, 0.35),
                "grain_intensity": random.uniform(0.02, 0.045),
                "grain_type": random.choice(["photographic", "film", "artistic"]),
                "angle": random.randint(0, 180),
            }
        else:  # fluid
            params = {
                "complexity": random.uniform(2.0, 4.5),
                "smoothness": random.uniform(5.0, 9.0),
                "bleeding": random.uniform(0.15, 0.45),
                "grain_intensity": random.uniform(0.02, 0.04),
                "grain_type": random.choice(["photographic", "film"]),
            }

        output_name = f"ai_batch_{i + 1}_{style}_{gradient_type}_{seed}"

        print(f"Generating {i + 1}/{count}: {style} {gradient_type} (seed: {seed})")

        success = generator.generate_gradient(
            gradient_type=gradient_type,
            colors=colors,
            resolution=resolution,
            output_name=output_name,
            **params,
        )

        if not success:
            print(f"Failed to generate gradient {i + 1}")

    print("🎉 AI batch generation complete!")


@cli.command(name="premium-demo")
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
        "Ethereal Blue",
    ]

    print("✨ Generating Premium Grainy demo collection...")

    for preset in premium_presets:
        print(f"Generating {preset}...")
        success = generator.generate_gradient(
            preset_name=preset,
            resolution="1080p",
            output_name=f"premium_{preset.lower().replace(' ', '_')}",
        )
        if not success:
            print(f"Failed to generate {preset}")

    print("✨ Premium Grainy demo complete! Check the outputs folder.")


def _generate_ai_influenced_parameters(
    prompt,
    mood,
    lighting,
    composition,
    texture_style,
    atmosphere,
    color_temperature,
    depth,
    complexity,
    ai_gen,
    use_openai,
):
    """Generate parameters influenced by AI understanding of mood, lighting, and atmosphere."""

    params = {}

    # Base quality settings
    params["gamma_correct"] = True
    params["anti_banding"] = True
    params["grain_quality"] = "professional"

    # Mood-influenced parameters
    mood_configs = {
        "calm": {"intensity_mod": 0.7, "smoothness_mod": 1.3, "grain_reduce": 0.8},
        "energetic": {"intensity_mod": 1.4, "smoothness_mod": 0.7, "grain_reduce": 1.2},
        "mysterious": {
            "intensity_mod": 1.1,
            "smoothness_mod": 0.9,
            "grain_reduce": 1.1,
        },
        "joyful": {"intensity_mod": 1.2, "smoothness_mod": 1.1, "grain_reduce": 0.9},
        "dramatic": {"intensity_mod": 1.5, "smoothness_mod": 0.8, "grain_reduce": 1.3},
        "serene": {"intensity_mod": 0.6, "smoothness_mod": 1.4, "grain_reduce": 0.7},
        "intense": {"intensity_mod": 1.6, "smoothness_mod": 0.6, "grain_reduce": 1.4},
    }
    mood_config = mood_configs.get(mood, mood_configs["calm"])

    # Lighting-influenced parameters
    lighting_configs = {
        "natural": {"highlight_mod": 1.0, "reflection_mod": 1.0, "holographic": False},
        "dramatic": {"highlight_mod": 1.5, "reflection_mod": 1.3, "holographic": True},
        "soft": {"highlight_mod": 0.7, "reflection_mod": 0.8, "holographic": False},
        "ambient": {"highlight_mod": 0.9, "reflection_mod": 0.9, "holographic": False},
        "neon": {"highlight_mod": 1.8, "reflection_mod": 1.1, "holographic": True},
        "cinematic": {"highlight_mod": 1.3, "reflection_mod": 1.2, "holographic": True},
        "golden": {"highlight_mod": 1.1, "reflection_mod": 1.0, "holographic": False},
    }
    lighting_config = lighting_configs.get(lighting, lighting_configs["natural"])

    # Texture-influenced parameters
    texture_configs = {
        "smooth": {"grain_intensity": 0.02, "grain_type": "photographic"},
        "grainy": {"grain_intensity": 0.06, "grain_type": "film"},
        "silky": {"grain_intensity": 0.01, "grain_type": "artistic"},
        "rough": {"grain_intensity": 0.08, "grain_type": "digital"},
        "metallic": {"grain_intensity": 0.04, "grain_type": "photographic"},
        "glassy": {"grain_intensity": 0.03, "grain_type": "photographic"},
        "organic": {"grain_intensity": 0.05, "grain_type": "film"},
    }
    texture_config = texture_configs.get(texture_style, texture_configs["smooth"])

    # Atmosphere-influenced parameters
    atmosphere_configs = {
        "clear": {"distortion_mod": 0.8, "blur_mod": 0.9},
        "hazy": {"distortion_mod": 1.2, "blur_mod": 1.4},
        "dreamy": {"distortion_mod": 1.1, "blur_mod": 1.5},
        "crisp": {"distortion_mod": 0.7, "blur_mod": 0.8},
        "ethereal": {"distortion_mod": 1.0, "blur_mod": 1.3},
        "vibrant": {"distortion_mod": 0.9, "blur_mod": 0.9},
        "muted": {"distortion_mod": 1.0, "blur_mod": 1.2},
    }
    atmosphere_config = atmosphere_configs.get(atmosphere, atmosphere_configs["clear"])

    # Composition-influenced surface style
    composition_styles = {
        "balanced": "organic",
        "dynamic": "fluid",
        "flowing": "organic",
        "geometric": "glass",
        "organic": "organic",
        "asymmetric": "fluid",
    }
    params["surface_style"] = composition_styles.get(composition, "organic")

    # Apply depth influence
    depth_layers = max(3, int(4 + depth * 4))  # 3-8 layers based on depth
    depth_complexity = 0.5 + depth * 0.5  # 0.5-1.0 complexity

    # Combine all influences for final parameters
    base_grain = texture_config["grain_intensity"] * mood_config["grain_reduce"]
    base_smoothness = (
        6.0 * mood_config["smoothness_mod"] * atmosphere_config["blur_mod"]
    )
    base_highlights = (
        0.4 * lighting_config["highlight_mod"] * mood_config["intensity_mod"]
    )
    base_reflection = 0.3 * lighting_config["reflection_mod"]
    base_distortion = 0.1 * atmosphere_config["distortion_mod"]

    # Final parameter set
    params.update(
        {
            "layers": depth_layers,
            "smoothness": min(15.0, max(2.0, base_smoothness)),
            "grain_intensity": min(0.1, max(0.01, base_grain + complexity * 0.02)),
            "grain_type": texture_config["grain_type"],
            "highlights": min(0.9, max(0.1, base_highlights)),
            "reflection": min(0.5, max(0.1, base_reflection)),
            "distortion": min(0.3, max(0.05, base_distortion)),
            "holographic": lighting_config["holographic"],
            "holographic_intensity": 0.3 + complexity * 0.3
            if lighting_config["holographic"]
            else 0,
            "flow_strength": 0.2 + depth * 0.2,
            "complexity": depth_complexity * complexity,
            "bleeding": 0.2 + atmosphere_config["blur_mod"] * 0.2,
            "angle": random.randint(15, 165),
        }
    )

    return params


def _create_enhanced_color_prompt(
    prompt, mood, lighting, atmosphere, color_temperature
):
    """Create an enhanced prompt for OpenAI color generation."""

    color_temp_descriptions = {
        "warm": "warm, golden, orange-tinted colors",
        "cool": "cool, blue, cyan-tinted colors",
        "neutral": "balanced, natural colors",
        "golden": "golden hour, amber, honey-colored tones",
        "blue": "blue-dominant, oceanic, sky-inspired colors",
        "violet": "purple, magenta, violet-dominant colors",
    }

    temp_desc = color_temp_descriptions.get(color_temperature, "natural colors")

    enhanced_prompt = f"""
    {prompt}
    
    Color requirements:
    - Mood: {mood} feeling and energy
    - Lighting: {lighting} lighting style
    - Atmosphere: {atmosphere} atmospheric quality
    - Color temperature: {temp_desc}
    
    Generate gradient colors that capture this specific combination of mood, lighting, and atmosphere.
    """

    return enhanced_prompt.strip()


def _generate_contextual_colors(mood, lighting, atmosphere, color_temperature, ai_gen):
    """Generate colors based on contextual understanding without OpenAI."""

    # Map parameters to existing AI generation methods
    style_mapping = {
        ("calm", "soft"): "calm",
        ("energetic", "dramatic"): "energetic",
        ("mysterious", "ambient"): "mysterious",
        ("joyful", "natural"): "joyful",
        ("serene", "golden"): "elegant",
        ("intense", "neon"): "energetic",
    }

    # Try to find exact match, fallback to mood-based
    style_key = (mood, lighting)
    if style_key in style_mapping:
        style = style_mapping[style_key]
        return ai_gen.generate_emotion_palette(style, 4)
    elif mood in ["calm", "energetic", "mysterious", "joyful", "elegant"]:
        return ai_gen.generate_emotion_palette(mood, 4)
    else:
        # Use color temperature as backup
        temp_styles = {
            "warm": "autumn",
            "cool": "winter",
            "golden": "summer",
            "blue": "ocean",
            "violet": "elegant",
        }
        nature_style = temp_styles.get(color_temperature, "spring")
        return ai_gen.generate_nature_palette(nature_style, 4)


def _select_gradient_type_for_composition(composition, surface_style):
    """Select the best gradient type based on composition style."""

    composition_mapping = {
        "balanced": "organic",
        "dynamic": "fluid",
        "flowing": "organic",
        "geometric": "glass",
        "organic": "organic",
        "asymmetric": "fluid",
    }

    return composition_mapping.get(composition, surface_style)


if __name__ == "__main__":
    cli()
