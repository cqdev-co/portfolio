# 🎨 Mathematical Gradient Generator with AI Enhancement

Generate high-quality gradient wallpapers using advanced mathematical algorithms, AI-powered color generation, and professional-grade texture effects.

## 🎯 Overview

A professional Python service for generating high-quality gradient wallpapers and backgrounds. Combines mathematical precision with AI-powered creativity to produce unique, customizable gradients with sophisticated texture effects. Ideal for designers, developers, and content creators who need beautiful, original gradient assets.

## ✨ Features

### 🤖 **NEW: Enhanced AI-Powered Generation**
- **Smart Color Generation** - AI-driven palettes based on trends, nature, emotions, and artistic styles
- **Environmental Control** - AI understands mood, lighting, atmosphere, and composition
- **Natural Language Prompts** - OpenAI integration for true AI-powered generation
- **Mood-Based Batch Generation** - Create entire collections with consistent emotional themes
- **Fusion Algorithms** - ML-inspired color harmonization and clustering
- **Automatic Optimization** - AI-assisted parameter selection for unique results

### ✨ **Professional Texture System** 
- **Multiple Grain Types** - Film grain, photographic grain, digital noise, and artistic grain effects
- **Intelligent Distribution** - Realistic grain placement based on image luminance
- **Customizable Intensity** - Fine-tune texture strength for desired aesthetic

### 🎨 **Advanced Generation Engine**
- **Mathematical Algorithms** - Linear, radial, Perlin noise, fractals, wave patterns, organic, glass, fluid
- **Multiple Resolutions** - 4K, 1440p, 1080p, mobile, tablet, ultrawide, and custom sizes
- **Professional Presets** - 25+ carefully crafted presets across 6 distinct categories
- **Color Palette System** - 14+ curated palettes plus unlimited AI-generated combinations
- **Local Processing** - No external APIs required, complete offline functionality
- **Parameter Control** - Fine-tune every aspect for precise results
- **Modular Design** - Clean, extensible architecture for easy customization

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Initialize configuration:**
   ```bash
   python gradgen.py init
   ```

3. **Generate your first gradient:**
   ```bash
   # Generate a high-quality textured gradient
   python gradgen.py generate --preset "Ocean Grain" --resolution 1080p
   
   # Create unique AI-powered gradients
   python gradgen.py ai-generate --style fusion --type glass
   
   # Use mathematical presets
   python gradgen.py generate --preset "Neural Flow" --resolution 1080p
   ```

## 🎨 Algorithm Types

### 🌟 Organic & Glass Effects
**Advanced algorithms for modern, sophisticated gradients:**
- **Organic Gradients** - Smooth, flowing patterns with natural movement and subtle texture
- **Glass Effects** - Multi-layered transparency with reflections, highlights, and distortion
- **Fluid Patterns** - Paint-like blending with ultra-smooth transitions

### Linear Gradients
Clean directional color transitions with customizable angles.

### Radial Gradients  
Circular/elliptical gradients emanating from configurable center points.

### Perlin Noise
Cloud-like organic textures using multi-octave noise algorithms.

### Fractals
Mathematical beauty with Mandelbrot, Julia sets, and Burning Ship fractals.

### Wave Patterns
Sine waves, interference patterns, spirals, and cylindrical waves.

## 📋 Available Presets

```bash
# List all presets by category
python gradgen.py list-presets

✨ Premium Grainy:
  • Grainy Sunset     • Ocean Grain       • Frosted Glass
  • Coral Dream       • Mint Mist         • Purple Haze
  • Golden Hour       • Ice Crystal       • Rose Gold
  • Ethereal Blue

🌟 Organic/Glass:
  • Glass Morph       • Organic Flow      • Fluid Dreams
  • Glossy Teal       • Smooth Sunrise    • Crystal Blue
  • Velvet Purple     • Soft Emerald

🧠 Neural/Tech:
  • Neural Flow       • Quantum Waves      • Data Streams

🎨 Classic:
  • Ocean Depths      • Sunset Ridge       • Forest Canopy

🔢 Fractal:
  • Mandelbrot Classic • Julia Dreams      • Burning Ship

🌊 Wave:
  • Ripple Effect     • Sunset Spiral     • Frequency Bands

📐 Geometric:
  • Radial Burst      • Linear Fade       • Diagonal Flow
```

## 🌈 Color Palettes

```bash
# View all available color palettes
python gradgen.py list-palettes

# Professional themes
neural_flow, cyber, modern_blue, elegant_purple

# Natural themes  
sunset, ocean, forest, earth

# Creative themes
cosmic, neon, fire, matrix
```

## 💻 Usage Examples

```bash
# Generate textured gradients with professional quality
python gradgen.py generate --preset "Ocean Grain" --resolution 1080p
python gradgen.py generate --preset "Frosted Glass" --resolution 4k
python gradgen.py premium-demo  # Generate complete texture collection

# Create unique AI-powered gradients
python gradgen.py ai-generate --style fusion --type glass --resolution 1080p
python gradgen.py ai-generate --style ocean --type organic --seed 12345
python gradgen.py ai-batch --count 10 --mix-styles --resolution 1440p

# NEW: Enhanced AI with mood, lighting, and atmosphere control
python gradgen.py ai-enhanced --mood dramatic --lighting cinematic --atmosphere hazy
python gradgen.py ai-enhanced --prompt "serene ocean sunset" --use-openai --complexity 0.8
python gradgen.py ai-mood-batch --theme emotions --count 8 --use-openai

# Generate modern organic and glass effects
python gradgen.py generate --preset "Glass Morph" --resolution 1080p
python gradgen.py generate --preset "Organic Flow" --resolution 4k

# Custom gradients with enhanced textures
python gradgen.py custom --type organic --colors "neural_flow" --resolution 4k \
  --param smoothness=6.0 --param grain_intensity=0.03 --param grain_type=photographic

# Glass effect with film grain texture
python gradgen.py custom --type glass --colors "sunset" --resolution 1080p \
  --param layers=5 --param reflection=0.3 --param grain_type=film

# Mathematical algorithm-based gradients
python gradgen.py generate --preset "Neural Flow" --resolution 1080p
python gradgen.py batch --preset "Ocean Depths" --count 5 --resolution 1440p
```

## 🔧 Custom Parameters

Fine-tune gradients with algorithm-specific parameters:

**🌟 Organic Gradients (for smooth, natural look):**
- `smoothness`: Gaussian blur intensity (1.0-10.0) - higher = smoother
- `flow_strength`: Organic movement amount (0.0-1.0) 
- `grain_intensity`: Subtle texture amount (0.0-0.1)
- `angle`: Flow direction (0-360 degrees)

**🌟 Glass Effects (for translucent, layered look):**
- `layers`: Transparency layers (2-6) - more = deeper glass effect
- `reflection`: Reflection intensity (0.0-0.5)
- `distortion`: Glass distortion amount (0.0-0.2)
- `highlights`: Highlight brightness (0.0-0.5)
- `angle`: Glass orientation (0-360 degrees)

**🌟 Fluid Patterns (for paint-like blending):**
- `complexity`: Flow detail level (1.0-5.0)
- `smoothness`: Blur intensity (2.0-8.0) - higher = more paint-like
- `bleeding`: Color mixing amount (0.0-1.0)

**Linear Gradients:**
- `angle`: Gradient direction (0-360 degrees)
- `center_x`, `center_y`: Gradient center (0.0-1.0)

**Radial Gradients:**
- `center_x`, `center_y`: Circle center (0.0-1.0)
- `inner_radius`, `outer_radius`: Radius bounds (0.0-1.0)
- `ellipse_ratio`: Width/height ratio

**Perlin Noise:**
- `scale`: Noise frequency (1.0-20.0)
- `octaves`: Detail layers (1-8)
- `persistence`: Amplitude falloff (0.0-1.0)
- `lacunarity`: Frequency multiplier (1.0-4.0)

**Fractals:**
- `max_iter`: Detail level (50-500)
- `zoom`: Magnification (0.1-10.0)
- `center_x`, `center_y`: View center

**Wave Patterns:**
- `frequency`: Wave frequency (0.5-10.0)
- `amplitude`: Wave strength (0.1-2.0)
- `wave_type`: sine, cosine, triangle, sawtooth

## 🤖 AI-Powered Features

### AI Style Options
```bash
# Trend-based styles
python gradgen.py ai-generate --style modern    # Contemporary blues, oranges, purples
python gradgen.py ai-generate --style vintage   # Retro yellows, teals, muted tones
python gradgen.py ai-generate --style neon      # Bright magentas, limes, cyans
python gradgen.py ai-generate --style pastel    # Soft pinks, greens, light colors

# Nature-inspired styles  
python gradgen.py ai-generate --style ocean     # Deep blues and aqua tones
python gradgen.py ai-generate --style forest    # Rich greens and earth tones
python gradgen.py ai-generate --style desert    # Warm browns, oranges, tans

# Emotion-based styles
python gradgen.py ai-generate --style calm      # Soothing blues and cool tones
python gradgen.py ai-generate --style energetic # Vibrant reds and warm colors
python gradgen.py ai-generate --style elegant   # Sophisticated purples and wines

# AI Fusion (combines multiple approaches)
python gradgen.py ai-generate --style fusion    # AI-powered multi-style combination
```

### 🚀 NEW: Enhanced AI Control

The new `ai-enhanced` command gives you unprecedented control over every aspect of your wallpaper:

```bash
# Enhanced AI generation with full environmental control
python gradgen.py ai-enhanced \
  --prompt "serene mountain lake at golden hour" \
  --mood serene \
  --lighting golden \
  --atmosphere dreamy \
  --color-temperature warm \
  --composition flowing \
  --texture-style silky \
  --depth 0.8 \
  --complexity 0.7 \
  --use-openai

# Quick mood-based generation
python gradgen.py ai-enhanced --mood dramatic --lighting cinematic
python gradgen.py ai-enhanced --mood calm --atmosphere ethereal
python gradgen.py ai-enhanced --mood energetic --lighting neon --texture-style metallic

# AI Mood Batch Generation - Complete collections
python gradgen.py ai-mood-batch --theme emotions --count 8 --use-openai
python gradgen.py ai-mood-batch --theme lighting --count 8 --complexity 0.8
python gradgen.py ai-mood-batch --theme mixed --count 12 --use-openai
```

**🎭 Mood Options:** calm, energetic, mysterious, joyful, dramatic, serene, intense  
**💡 Lighting:** natural, dramatic, soft, ambient, neon, cinematic, golden  
**🌫️ Atmosphere:** clear, hazy, dreamy, crisp, ethereal, vibrant, muted  
**🎨 Composition:** balanced, dynamic, flowing, geometric, organic, asymmetric  
**🖌️ Texture:** smooth, grainy, silky, rough, metallic, glassy, organic  
**🌡️ Color Temperature:** warm, cool, neutral, golden, blue, violet

### Enhanced Grain Types
```bash
# Film grain (vintage look with multiple layers)
--param grain_type=film grain_intensity=0.04

# Photographic grain (realistic camera grain) - Default  
--param grain_type=photographic grain_intensity=0.03

# Digital noise (clean electronic noise)
--param grain_type=digital grain_intensity=0.02

# Artistic grain (organic irregular patterns)
--param grain_type=artistic grain_intensity=0.035
```

## 📁 Output Structure

```
outputs/
├── 4k/              # 3840×2160
├── 1440p/           # 2560×1440
├── 1080p/           # 1920×1080
├── 720p/            # 1280×720
├── mobile/          # 1080×1920
├── tablet/          # 2048×1536
├── ultrawide/       # 3440×1440
├── square/          # 1080×1080
└── metadata/        # Generation parameters
```

## ⚙️ Configuration

Edit `config.json` to customize defaults:

```json
{
  "settings": {
    "output_dir": "outputs",
    "default_resolution": "1080p", 
    "default_format": "PNG",
    "jpeg_quality": 95
  }
}
```

## 🛠️ Architecture

The project follows clean, modular architecture:

```
src/
├── core/           # Base classes and enums
├── generators/     # Mathematical algorithms
├── utils/          # Color palettes and utilities
└── config/         # Settings and presets
```

## 💡 Pro Tips for Professional Results

**🏆 RECOMMENDED: Stock-Quality Generation (Best Results)**

```bash
# Perfect combination - Rich Organic (universally appealing)
python gradgen.py stock-quality --style rich --type organic --complexity 0.8

# Professional glass effects
python gradgen.py stock-quality --style rich --type glass --complexity 0.7

# Creative fluid patterns  
python gradgen.py stock-quality --style rich --type fluid --complexity 0.8
```

**For High-Quality Textured Gradients:**

```bash
# Professional textured gradients (recommended starting point)
python gradgen.py generate --preset "Ocean Grain"
python gradgen.py generate --preset "Frosted Glass"  
python gradgen.py generate --preset "Golden Hour"

# AI-powered with professional enhancements
python gradgen.py ai-generate --style rich --type organic --professional \
  --grain-quality professional --complexity 0.8

# Advanced glass with holographic effects
python gradgen.py ai-generate --style rich --type glass --professional \
  --holographic --complexity 0.7

# Custom glass effects with realistic grain
python gradgen.py custom --type glass --colors "neural_flow" \
  --param layers=5 --param reflection=0.3 --param highlights=0.4 \
  --param grain_type=photographic --param grain_intensity=0.03
```

**📖 [See Complete Output Styles Guide](docs/README.md)** - Comprehensive guide to choosing the perfect style and algorithm combinations for your needs.

**Optimal Parameters for Professional Results:**
- **Rich Organic** = Most universally appealing combination
- **Complexity 0.7-0.8** = Sweet spot for professional quality
- **Professional Grain** = Significant texture quality improvement
- **Gamma Correction** = Eliminates color banding
- **Anti-banding Dithering** = Smooth, professional gradations

## 🎯 Use Cases

- **Professional Design Projects** - High-quality textures and backgrounds for client work
- **Desktop & Mobile Wallpapers** - Custom backgrounds for any screen size
- **Web & Application UI** - Unique gradient backgrounds and visual elements  
- **Print & Digital Media** - Premium-quality gradients with sophisticated texturing
- **Creative Projects** - AI-powered color exploration and mathematical art generation
- **UI/UX Design** - Modern, polished gradients for contemporary interfaces

## 🌟 Key Advantages

**Advanced Technology Stack:**
- **Mathematical Precision** - Algorithmically generated patterns ensure consistency and quality
- **AI-Enhanced Creativity** - Smart color generation produces unique, sophisticated palettes
- **Professional Texturing** - Multi-layer grain system creates realistic, high-end effects
- **Complete Customization** - Full parameter control from simple presets to detailed fine-tuning
- **Local Processing** - No external dependencies, API costs, or internet requirements
- **Unlimited Generation** - Create as many unique gradients as needed without restrictions

*Generate professional-quality gradient assets with the combined power of mathematical algorithms and AI-driven creativity.*