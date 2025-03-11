import { DATA } from '@/data/resume';
import { ImageResponse } from 'next/og';
import { ReactElement } from 'react';

export const DEFAULT_OG_SIZE = {
  width: 1200,
  height: 630,
};

type OGImageProps = {
  title: string;
  subtitle?: string;
  backgroundPattern?: boolean;
  showUrl?: boolean;
  gradientTitle?: boolean;
  alignment?: 'center' | 'start';
  padding?: string;
  headerElement?: ReactElement;
  footerElement?: ReactElement;
};

/**
 * Creates a reusable Open Graph image with consistent styling
 */
export function createOGImage({
  title,
  subtitle,
  backgroundPattern = true,
  showUrl = true,
  gradientTitle = true,
  alignment = 'center',
  padding = '40px 80px',
  headerElement,
  footerElement,
}: OGImageProps) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: alignment === 'center' ? 'center' : 'flex-start',
          justifyContent: alignment === 'center' ? 'center' : 'flex-end',
          backgroundColor: '#0f172a',
          color: 'white',
          padding,
          textAlign: alignment === 'center' ? 'center' : 'left',
          fontFamily: 'sans-serif',
          position: 'relative',
          backgroundImage: alignment !== 'center' 
            ? 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.8) 100%)' 
            : undefined,
        }}
      >
        {/* Background pattern */}
        {backgroundPattern && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#0f172a',
              backgroundImage: 'radial-gradient(circle at 25px 25px, #334155 2px, transparent 0), radial-gradient(circle at 75px 75px, #334155 2px, transparent 0)',
              backgroundSize: '100px 100px',
              zIndex: 0,
              opacity: 0.2,
            }}
          />
        )}
        
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: alignment === 'center' ? 'center' : 'flex-start',
            justifyContent: 'center',
            zIndex: 1,
            width: '100%',
          }}
        >
          {/* Optional header element (like a date) */}
          {headerElement}
          
          <h1
            style={{
              fontSize: 64,
              fontWeight: 700,
              margin: '0 0 20px 0',
              ...(gradientTitle ? {
                background: 'linear-gradient(to right, #9333ea, #4f46e5)',
                backgroundClip: 'text',
                color: 'transparent',
              } : {
                color: 'white'
              }),
              maxWidth: '800px',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          
          {subtitle && (
            <p
              style={{
                fontSize: subtitle.length > 70 ? 24 : 32,
                margin: '0 0 40px 0',
                color: '#e2e8f0',
                maxWidth: '800px',
                lineHeight: 1.4,
                ...(subtitle.length > 100 && {
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }),
              }}
            >
              {subtitle}
            </p>
          )}
          
          {/* Optional footer element */}
          {footerElement}
          
          {/* URL element if enabled */}
          {showUrl && !footerElement && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: alignment === 'center' ? 'center' : 'flex-start',
                padding: '12px 24px',
                backgroundColor: '#7c3aed',
                borderRadius: 8,
                fontSize: 24,
                marginTop: subtitle ? 0 : 40,
              }}
            >
              {DATA.url.replace('https://', '')}
            </div>
          )}
        </div>
      </div>
    ),
    { ...DEFAULT_OG_SIZE }
  );
} 