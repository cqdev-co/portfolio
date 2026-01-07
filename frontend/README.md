# Modern Portfolio Website

A sleek, minimal, and professional portfolio website built with Next.js, TypeScript, Tailwind CSS, Bun, and Shadcn/UI.

![Portfolio Screenshot](screenshot.png)

## Features

- 🚀 **Modern Stack**: Built with Next.js 14, TypeScript, and Tailwind CSS
- 🧩 **Component Library**: Uses Shadcn/UI for beautiful UI components
- 📱 **Responsive Design**: Looks great on all devices
- 🔍 **SEO Optimized**: Proper metadata for better search engine visibility
- 🌗 **Dark Mode Ready**: Supports light and dark themes
- ⚡ **Fast Performance**: Quick loading times with Next.js App Router
- 💼 **Professional Layout**: LinkedIn-style header with Dillion-inspired content sections

## Pages

- **Home**: Introduction with skills, work experience, and featured projects
- **About**: Detailed information about background, skills, and experience
- **Projects**: Showcase of portfolio projects with descriptions and technologies used
- **Contact**: Contact form and information

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (>= 1.0.0)
- Node.js (>= 18.0.0)

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/cqdev-co/portfolio.git
   cd portfolio/frontend
   ```

2. Install dependencies

   ```bash
   bun install
   ```

3. Run the development server

   ```bash
   bun dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Customization

### Personal Information

1. Update your name, title, and description in `src/app/page.tsx`
2. Add your work experience and skills
3. Update the project information in `src/app/projects/page.tsx`
4. Edit contact information in `src/app/contact/page.tsx`

### Styling

- The theme can be customized in the `components.json` file
- Global CSS can be modified in `src/app/globals.css`
- Component styles use Tailwind CSS classes

### Images

- Replace the placeholder images with your own:
  - Add a banner image to the header component
  - Add a profile photo
  - Add project screenshots

## Deployment

This project is configured for deployment to Vercel with a monorepo structure. The `vercel.json` file in the root directory configures Vercel to build from the `frontend/` directory.

To deploy:

1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the configuration and deploy from the frontend directory
3. Or deploy manually:
   ```bash
   vercel --prod
   ```

The deployment configuration is handled by the root-level `vercel.json` file.

## Built With

- [Next.js](https://nextjs.org/) - The React framework
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Shadcn/UI](https://ui.shadcn.com/) - UI component library
- [Bun](https://bun.sh/) - JavaScript runtime and package manager

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by [Dillion's Portfolio](https://github.com/dillionmegida)
- LinkedIn for the header design inspiration
