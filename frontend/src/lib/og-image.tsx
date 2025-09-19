import { DATA } from '@/data/resume';
import { ImageResponse } from 'next/og';

export const DEFAULT_OG_SIZE = {
  width: 1200,
  height: 630,
};

// Background style configurations
const backgroundStyles = {
  default: {
    background: '#0f172a',
    textColor: 'white',
    logoBackground: '#7c3aed',
    buttonBackground: '#7c3aed',
  },
  'serene-gold': {
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 25%, #d97706 50%, #92400e 75%, #451a03 100%)',
    textColor: 'white',
    logoBackground: 'rgba(255, 255, 255, 0.2)',
    buttonBackground: 'rgba(255, 255, 255, 0.15)',
  },
  gradient: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    textColor: 'white', 
    logoBackground: 'rgba(255, 255, 255, 0.2)',
    buttonBackground: 'rgba(255, 255, 255, 0.15)',
  },
};

type OGImageProps = {
  title: string;
  subtitle?: string;
  logoText?: string;
  backgroundStyle?: 'default' | 'serene-gold' | 'gradient';
};

/**
 * Creates an Open Graph image with customizable background styles
 * including support for the serene gold gradient from WP-Service
 */
export function createOGImage({
  title,
  subtitle,
  logoText = 'CQ',
  backgroundStyle = 'default',
}: OGImageProps) {
  const style = backgroundStyles[backgroundStyle];
  
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: style.background,
          color: style.textColor,
          padding: '40px 80px',
          textAlign: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo Circle - only show if logoText is provided */}
        {logoText && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '120px',
              height: '120px',
              borderRadius: '60px',
              backgroundColor: style.logoBackground,
              marginBottom: '30px',
              fontWeight: 'bold',
              fontSize: '48px',
              backdropFilter: backgroundStyle !== 'default' ? 'blur(10px)' : 'none',
              border: backgroundStyle !== 'default' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            }}
          >
            {logoText}
          </div>
        )}
        
        {/* Title - only show if title is provided */}
        {title && (
          <h1
            style={{
              fontSize: 64,
              fontWeight: 700,
              marginBottom: '20px',
              color: style.textColor,
              textShadow: backgroundStyle !== 'default' ? '0 2px 4px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            {title}
          </h1>
        )}
        
        {/* Subtitle - only show if subtitle is provided */}
        {subtitle && (
          <p
            style={{
              fontSize: 32,
              marginBottom: '40px',
              color: backgroundStyle === 'default' ? '#e2e8f0' : 'rgba(255, 255, 255, 0.9)',
              textShadow: backgroundStyle !== 'default' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            {subtitle}
          </p>
        )}
        
        {/* Website URL - only show if any content is provided */}
        {(title || subtitle || logoText) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 24px',
              backgroundColor: style.buttonBackground,
              borderRadius: 8,
              fontSize: 24,
              backdropFilter: backgroundStyle !== 'default' ? 'blur(10px)' : 'none',
              border: backgroundStyle !== 'default' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
            }}
          >
            {DATA.url.replace('https://', '')}
          </div>
        )}
      </div>
    ),
    { ...DEFAULT_OG_SIZE }
  );
} 