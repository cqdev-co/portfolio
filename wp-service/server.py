"""
FastAPI server exposing wp-service gradient generation over HTTP.

Start with:
    uvicorn server:app --host 0.0.0.0 --port 8000
"""

import io
import random
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.config.presets import GradientPreset
from src.core.base import Resolution
from src.generators import (
    FluidGradientGenerator,
    FractalGenerator,
    GlassGradientGenerator,
    LinearGradientGenerator,
    OrganicGradientGenerator,
    PerlinNoiseGenerator,
    RadialGradientGenerator,
    WaveGradientGenerator,
)
from src.utils.ai_color_gen import AIColorGenerator
from src.utils.color_utils import ColorPalette

app = FastAPI(title="wp-service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


GENERATOR_MAP = {
    "linear": LinearGradientGenerator,
    "radial": RadialGradientGenerator,
    "perlin": PerlinNoiseGenerator,
    "fractal": FractalGenerator,
    "wave": WaveGradientGenerator,
    "organic": OrganicGradientGenerator,
    "glass": GlassGradientGenerator,
    "fluid": FluidGradientGenerator,
}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    style: str = "rich"
    gradient_type: str = Field("organic", alias="type")
    resolution: str = "1080p"
    complexity: float = 0.8
    output_format: str = "png"
    prompt: str | None = None
    use_ollama: bool = False
    seed: int | None = None
    professional: bool = True
    holographic: bool | None = None

    class Config:
        populate_by_name = True


class AIColorsRequest(BaseModel):
    prompt: str
    num_colors: int = 4
    style_hint: str = ""


class AIColorsResponse(BaseModel):
    colors: list[list[int]]
    hex: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_params(
    gradient_type: str,
    complexity: float,
    professional: bool,
    resolution: str = "1080p",
    holographic: bool | None = None,
) -> dict:
    """Build generation params for HTTP generation (tuned for smooth, editorial output)."""
    w, h = Resolution.get(resolution)
    ref_diag = (1920 * 1920 + 1080 * 1080) ** 0.5
    diag = (w * w + h * h) ** 0.5
    grain_scale = (ref_diag / diag) ** 0.5
    base_grain = (0.04 if professional else 0.03) * grain_scale

    if gradient_type == "glass":
        holo = bool(holographic) if holographic is not None else False
        return {
            "layers": int(7 + complexity * 3),
            "reflection": 0.4 + complexity * 0.3,
            "distortion": 0.15 + complexity * 0.1,
            "highlights": 0.6 + complexity * 0.3,
            "angle": random.randint(15, 165),
            "grain_intensity": base_grain + complexity * 0.01,
            "grain_type": "photographic",
            "grain_quality": "professional",
            "holographic": holo,
            "holographic_intensity": 0.25 + complexity * 0.22,
            "gamma_correct": True,
            "anti_banding": True,
        }
    if gradient_type == "organic":
        return {
            "smoothness": min(7.5, 4.5 + complexity * 3.0),
            "flow_strength": 0.2 + complexity * 0.2,
            "grain_intensity": base_grain + complexity * 0.01,
            "grain_type": "photographic",
            "grain_quality": "professional",
            "angle": random.randint(15, 165),
            "gamma_correct": True,
            "anti_banding": True,
        }
    if gradient_type == "fluid":
        return {
            "complexity": 4.0 + complexity * 4.0,
            "smoothness": min(9.0, 4.0 + complexity * 4.0),
            "bleeding": 0.3 + complexity * 0.3,
            "grain_intensity": base_grain + complexity * 0.01,
            "grain_type": "photographic",
            "grain_quality": "professional",
            "gamma_correct": True,
            "anti_banding": True,
        }
    return {
        "gamma_correct": professional,
        "anti_banding": professional,
    }


def _render_image(
    gradient_type: str,
    colors: list[tuple[int, int, int]],
    resolution: str,
    output_format: str,
    params: dict,
) -> bytes:
    """Render a gradient and return raw image bytes."""
    res = Resolution.get_all()
    if resolution not in res:
        raise HTTPException(status_code=400, detail=f"Unknown resolution: {resolution}")
    width, height = res[resolution]

    gen_cls = GENERATOR_MAP.get(gradient_type)
    if gen_cls is None:
        raise HTTPException(
            status_code=400, detail=f"Unknown gradient type: {gradient_type}"
        )

    generator = gen_cls(width, height, colors, **params)
    img = generator.to_image()

    buf = io.BytesIO()
    fmt = "JPEG" if output_format.lower() in ("jpg", "jpeg") else "PNG"
    img.save(buf, format=fmt, quality=95)
    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/presets")
def list_presets():
    """Return available presets grouped by category."""
    preset_names = GradientPreset.list_presets()
    grouped: dict[str, list[str]] = {}
    for name in preset_names:
        preset = GradientPreset.get_preset(name)
        cat = preset.get("category", "other")
        grouped.setdefault(cat, []).append(name)
    return {"presets": grouped}


@app.get("/api/palettes")
def list_palettes():
    """Return available color palette names and their colors."""
    names = ColorPalette.list_palettes()
    result = {}
    for name in names:
        colors = ColorPalette.get_palette(name)
        result[name] = {
            "colors": [list(c) for c in colors],
            "hex": [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in colors],
        }
    return {"palettes": result}


@app.get("/api/resolutions")
def list_resolutions():
    """Return available resolutions."""
    return {"resolutions": Resolution.get_all()}


@app.get("/api/styles")
def list_styles():
    """Return available style and type options for the frontend."""
    return {
        "styles": ["rich", "vibrant", "sophisticated", "glass"],
        "types": list(GENERATOR_MAP.keys()),
        "resolutions": list(Resolution.get_all().keys()),
    }


@app.post("/api/ai-colors", response_model=AIColorsResponse)
def generate_ai_colors(req: AIColorsRequest):
    """Generate an AI color palette via Ollama (no image)."""
    ai_gen = AIColorGenerator(use_ollama=True)

    if not ai_gen.use_ollama:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not configured. Set OLLAMA_API_KEY in .env.local.",
        )

    try:
        colors = ai_gen.generate_ollama_palette(
            req.prompt, req.num_colors, req.style_hint
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return AIColorsResponse(
        colors=[list(c) for c in colors],
        hex=[f"#{r:02x}{g:02x}{b:02x}" for r, g, b in colors],
    )


@app.post("/api/generate")
def generate_wallpaper(req: GenerateRequest):
    """Generate a wallpaper and return it as image bytes."""
    ai_gen = AIColorGenerator(
        seed=req.seed,
        use_ollama=req.use_ollama,
    )

    if req.use_ollama and req.prompt:
        try:
            colors = ai_gen.generate_ollama_palette(req.prompt, 4, req.style)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    elif req.use_ollama:
        try:
            colors = ai_gen.generate_ollama_style_palette(req.style, 4)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    else:
        colors = ai_gen.generate_professional_palette(req.style, 4)

    params = _build_params(
        req.gradient_type,
        req.complexity,
        req.professional,
        req.resolution,
        req.holographic,
    )
    if req.seed is not None:
        params["seed"] = int(req.seed)
    image_bytes = _render_image(
        req.gradient_type, colors, req.resolution, req.output_format, params
    )

    media = (
        "image/jpeg" if req.output_format.lower() in ("jpg", "jpeg") else "image/png"
    )
    return Response(content=image_bytes, media_type=media)
