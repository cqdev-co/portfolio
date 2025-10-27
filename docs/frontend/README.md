# Frontend Documentation

## Recent Updates

### Content Refinements (October 2025)
Updated the Security Event Gateway article to align with professional standards:
- **Language Refinement**: Replaced "alert fatigue" terminology with more neutral, growth-focused language about "high alert volume challenging efficiency"
- **Metrics Standardization**: Rounded all financial figures and performance metrics to avoid implying precise internal data (e.g., "$1,000" → "~$1,000", "90%" → "~90%")
- **Result Framing**: Added disclaimers framing results as "illustrative" or "based on internal analysis" to clarify the nature of the data
- **Deployment Clarity**: Clarified that the system is a proof-of-concept/prototype rather than production deployment

## Scanner Navigation Structure

The portfolio now features a unified scanner navigation system that provides users with access to multiple trading analysis tools:

### Scanner Hub (`/scanners`)
- **Centralized Access**: Single entry point for all available scanners
- **Minimalistic Design**: Clean, simple list layout with scanner titles and win rates
- **Simple Link Styling**: Traditional underlined links with hover effects for clarity
- **Visual Separation**: Horizontal divider between title and scanner list
- **Performance Indicators**: Win rate statistics displayed where applicable in monospace badges
- **Responsive Layout**: Optimized for all screen sizes with focused content

### Available Scanners
1. **Volatility Squeeze Scanner** (`/volatility-squeeze-scanner`)
   - Status: Active
   - Focus: Technical analysis using Bollinger Bands and Keltner Channels
   - Win Rate: 68% with 2.1% average returns

2. **Unusual Options Scanner** (`/unusual-options-scanner`)
   - Status: Active  
   - Focus: Insider detection through options flow analysis
   - Features: Real-time data with 0DTE exclusion filters

### Navigation Updates
- **Dock Icon**: Scanner icon now points to `/scanners` instead of directly to volatility squeeze scanner
- **Label Change**: Updated from "Scanner" to "Scanners" to reflect multiple options
- **User Experience**: Improved discoverability of all available analysis tools

## Public Access Model

All scanners are fully public and accessible to all users without authentication requirements. This change was implemented based on user feedback to remove barriers and encourage more users to utilize the professional trading tools.

## Open Graph Images with WP-Service Backgrounds

### Overview
The portfolio frontend now features enhanced Open Graph (OG) images that utilize beautiful gradient backgrounds inspired by the WP-Service wallpaper generation system. The serene gold gradient provides a professional, glossy aesthetic for social media previews.

### Features
- **Multiple Background Styles**: Support for default, serene-gold, and custom gradient backgrounds
- **Consistent Branding**: Maintains portfolio design language across all preview images
- **Professional Aesthetics**: Glass-like effects with backdrop blur and subtle borders
- **Responsive Design**: Optimized for all social media platforms (1200x630px)
- **Type-Safe Implementation**: Full TypeScript support with proper typing

### Implementation

#### Background Styles
The system supports three background styles:

1. **Default**: Classic dark background (`#0f172a`)
2. **Serene Gold**: Gradient inspired by WP-Service wallpapers
   - Colors: `#fbbf24` → `#f59e0b` → `#d97706` → `#92400e` → `#451a03`
   - Direction: 135-degree diagonal gradient
3. **Gradient**: Purple-blue gradient for variety

#### Usage
```typescript
import { createOGImage } from '@/lib/og-image';

// Use serene gold background
export default async function OGImage() {
  return createOGImage({
    title: 'Page Title',
    subtitle: 'Page description',
    logoText: 'CQ',
    backgroundStyle: 'serene-gold',
  });
}
```

#### Visual Enhancements
- **Glass Morphism**: Semi-transparent elements with backdrop blur
- **Text Shadows**: Improved readability on gradient backgrounds  
- **Subtle Borders**: 1px white borders with low opacity
- **Professional Typography**: Sans-serif fonts with proper hierarchy

### File Structure
```
src/lib/
└── og-image.tsx           # Enhanced OG image generation system

src/app/
├── opengraph-image.tsx    # Main site OG image (serene-gold)
├── about/
│   └── opengraph-image.tsx # About page OG image (serene-gold)
├── volatility-squeeze-scanner/
│   └── opengraph-image.tsx # VSS page OG image (serene-gold)
└── blog/[slug]/
    └── opengraph-image.tsx # Blog post OG images (default)
```

### Configuration
Background styles are configured in `/src/lib/og-image.tsx`:

```typescript
const backgroundStyles = {
  'serene-gold': {
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #d97706 50%, #92400e 75%, #451a03 100%)',
    textColor: 'white',
    logoBackground: 'rgba(255, 255, 255, 0.2)',
    buttonBackground: 'rgba(255, 255, 255, 0.15)',
  },
  // ... other styles
};
```

### Integration with WP-Service
The serene gold gradient is inspired by the `serene_gold_1.png` wallpaper from the WP-Service, creating visual consistency between:
- Social media previews (Open Graph images)
- Desktop wallpapers (WP-Service output)
- Portfolio branding elements

This creates a cohesive visual identity across all touchpoints while maintaining the glossy, professional aesthetic preferred by the user.

### Next.js Integration
The system leverages Next.js's built-in Open Graph image generation:
- Automatic optimization and caching
- Edge runtime compatibility
- Social media platform optimization
- SEO-friendly metadata generation

### Future Enhancements
- Dynamic background selection based on content type
- Integration with additional WP-Service gradients
- Animated gradient transitions
- Custom logo overlays for different sections