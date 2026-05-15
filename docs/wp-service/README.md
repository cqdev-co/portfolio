# wp-service

Mathematical gradient wallpaper generator with AI-powered color generation via Ollama Cloud and a FastAPI server for frontend integration.

## Architecture

```
wp-service/
├── gradgen.py          # CLI entry point (Click commands)
├── server.py           # FastAPI server for frontend access
├── config.json         # App settings (output dir, resolution, format)
├── src/
│   ├── core/base.py    # GradientType, Resolution, BaseGenerator
│   ├── config/
│   │   ├── settings.py # AppSettings, load_config, save_config
│   │   └── presets.py  # 25+ named gradient presets
│   ├── generators/     # linear, radial, perlin, fractal, wave, organic, glass, fluid
│   └── utils/
│       ├── color_utils.py   # Static palettes and color math
│       └── ai_color_gen.py  # AI palette generation (Ollama Cloud + local heuristics)
└── outputs/            # Generated images + metadata
```

## Ollama Cloud Integration

AI color generation uses Ollama Cloud (matching the repo-wide pattern). Configure via environment variables in `.env.local`:

| Variable         | Default           | Description                           |
| ---------------- | ----------------- | ------------------------------------- |
| `OLLAMA_API_KEY` | (required for AI) | Bearer token for `https://ollama.com` |
| `OLLAMA_MODEL`   | `llama3.2`        | Model used for palette generation     |

The AI path is **optional** -- all commands work without Ollama using local heuristic palette generators. Pass `--use-ollama` on the CLI or set `use_ollama: true` in the API request to activate it.

## CLI Usage

```bash
pip install -r requirements.txt
python gradgen.py init

# Local AI-inspired generation (no Ollama required)
python gradgen.py ai-generate --style rich --type organic --professional
python gradgen.py stock-quality --style rich --type glass --complexity 0.7

# Ollama-powered generation
python gradgen.py ai-generate --use-ollama --prompt "serene ocean sunset" --type organic
python gradgen.py ai-enhanced --use-ollama --prompt "golden hour warmth" --mood calm --lighting golden
python gradgen.py ai-mood-batch --use-ollama --theme emotions --count 8
```

## FastAPI Server

The server exposes gradient generation over HTTP so the Next.js frontend can consume it.

```bash
# Start the server
uvicorn server:app --host 0.0.0.0 --port 8000
```

### Endpoints

| Method | Path               | Description                                            |
| ------ | ------------------ | ------------------------------------------------------ |
| `POST` | `/api/generate`    | Generate a wallpaper image (returns PNG/JPEG bytes)    |
| `POST` | `/api/ai-colors`   | Generate an AI color palette via Ollama (returns JSON) |
| `GET`  | `/api/presets`     | List available gradient presets                        |
| `GET`  | `/api/palettes`    | List available color palettes                          |
| `GET`  | `/api/resolutions` | List available resolutions                             |
| `GET`  | `/api/styles`      | List style/type/resolution options for the frontend    |

### POST /api/generate

```json
{
  "style": "rich",
  "type": "organic",
  "resolution": "1080p",
  "complexity": 0.8,
  "output_format": "png",
  "prompt": "warm sunset tones",
  "use_ollama": true,
  "seed": 42,
  "professional": true,
  "holographic": false
}
```

Returns raw image bytes with `Content-Type: image/png` or `image/jpeg`.

**Behavior notes**

- **Color blending**: When `professional` / `gamma_correct` semantics apply, scalar fields map to RGB using **OKLab** interpolation between palette stops (smoother than sRGB lerp). Set `gamma_correct: false` in custom flows to force direct sRGB lerp, or pass `blend_space` in generator params (`oklab`, `linear`, `srgb`) if you extend the API.
- **`seed`**: Passed into the image generator so grain, dithering, and Perlin-backed organic flow match the palette RNG when you set `seed` on the request.
- **`holographic`**: For `type: glass`, defaults to **false** for a cleaner look. Set `holographic: true` for iridescent highlights.
- **Grain**: Default grain intensity is scaled down slightly on larger canvases (e.g. 4K) so texture does not overpower the gradient.

### POST /api/ai-colors

```json
{
  "prompt": "deep ocean blues",
  "num_colors": 4,
  "style_hint": "rich"
}
```

Returns:

```json
{
  "colors": [
    [30, 58, 138],
    [59, 130, 246],
    [6, 182, 212],
    [34, 197, 94]
  ],
  "hex": ["#1e3a8a", "#3b82f6", "#06b6d4", "#22c55e"]
}
```

## Frontend Integration

The Next.js frontend at `/wallpaper` provides a UI for generating wallpapers:

- **API route**: `frontend/src/app/api/wallpaper/route.ts` proxies requests to the FastAPI server (`WP_SERVICE_URL` env var, default `http://localhost:8000`)
- **Page**: `frontend/src/app/wallpaper/page.tsx`
- **Component**: `frontend/src/components/wallpaper/wallpaper-generator.tsx`

Configure the frontend with:

```
WP_SERVICE_URL=http://localhost:8000
```

## Aesthetic tuning

**Reference tastes (editorial / stock-style):** Favorites in testing clustered on **organic** and **glass** with cohesive blue–lavender palettes, **film or light photographic grain**, and **glass without holographic** for a calmer look. **Ocean Grain**, **Frosted Glass**, and **stock-quality** `organic` + `rich` / `glass` style fit that lane. **Neural Flow** is implemented as a soft **organic** blue ramp (not Perlin) so it stays in the same family as Ocean Grain.

- **Organic** (`organic`): Best default for soft editorial wallpapers; combines a directional field with a low-frequency **Perlin** blend so structure is less “pure sine” than before. Prefer PNG for banding-free output; JPEG still uses anti-banded dithering on fluid and organic paths.
- **Glass** (`glass`): Use without `holographic` for refined glassy depth; enable `holographic` only when you want visible iridescence.
- **Fluid** (`fluid`): Paint-like smear; anti-banding dither runs after blur and optional grain.
- **Perlin** (`perlin`): Cloudy abstract fields; same OKLab palette mapping as other types when `gamma_correct` is true.

Generator tuning knobs (CLI `custom` / preset `params`) include `organic_perlin_blend` (0–1, default ~0.28), `organic_perlin_scale`, and `organic_perlin_octaves` for the organic flow field.

## Gradient Types

| Type      | Description                                                                      |
| --------- | -------------------------------------------------------------------------------- |
| `organic` | Smooth flowing patterns with Perlin-mixed flow, natural movement, and film grain |
| `glass`   | Multi-layered transparency with reflections; optional holographic shimmer        |
| `fluid`   | Paint-like blending with ultra-smooth transitions                                |
| `linear`  | Clean directional color transitions                                              |
| `radial`  | Circular/elliptical gradients                                                    |
| `perlin`  | Cloud-like organic textures using multi-octave noise                             |
| `fractal` | Mandelbrot, Julia sets, Burning Ship                                             |
| `wave`    | Sine waves, interference patterns, spirals                                       |

## Styles

| Style           | Description                                |
| --------------- | ------------------------------------------ |
| `rich`          | Deep, vibrant, saturated (best all-around) |
| `vibrant`       | Maximum saturation, bold                   |
| `sophisticated` | Elegant, refined, muted                    |
| `glass`         | Translucent, bright, airy                  |
