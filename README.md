# Portfolio Monorepo

This repository contains a modern portfolio website and related services organized as a monorepo.

## Structure

```
portfolio/
├── frontend/          # Next.js portfolio website
├── wp-service/        # Wallpaper generation service
├── vercel.json        # Vercel deployment configuration
└── package.json       # Root workspace configuration
```

## Projects

### 🌐 Frontend
A modern, responsive portfolio website built with Next.js, TypeScript, and Tailwind CSS.

**Location**: `./frontend/`  
**Tech Stack**: Next.js 15, TypeScript, Tailwind CSS, Shadcn/UI  
**Documentation**: [Frontend README](./frontend/README.md)

### 🎨 WP Service
A Python service for generating custom wallpapers and gradients.

**Location**: `./wp-service/`  
**Tech Stack**: Python, PIL/Pillow, NumPy  
**Documentation**: [WP Service README](./wp-service/README.md)

## Quick Start

### Frontend Development
```bash
cd frontend
bun install
bun dev
```

### WP Service Development
```bash
cd wp-service
pip install -r requirements.txt
python gradgen.py
```

## Deployment

### Frontend (Vercel)
The frontend is configured for automatic deployment to Vercel. The `vercel.json` configuration ensures Vercel builds from the `frontend/` directory.

### WP Service
The wallpaper service can be deployed as a standalone Python application or containerized service.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes in the appropriate directory
4. Update documentation as needed
5. Submit a pull request

## License

MIT License - see individual project directories for specific licensing information.
