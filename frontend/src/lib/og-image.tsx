import { DATA } from '@/data/resume';
import { ImageResponse } from 'next/og';

export const DEFAULT_OG_SIZE = {
  width: 1200,
  height: 630,
};

type OGImageProps = {
  title: string;
  subtitle?: string;
  logoText?: string;
};

/**
 * Creates a simple Open Graph image with minimal styling
 * to avoid build issues
 */
export function createOGImage({
  title,
  subtitle,
  logoText = 'CQ',
}: OGImageProps) {
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
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '40px 80px',
          textAlign: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo Circle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '120px',
            height: '120px',
            borderRadius: '60px',
            backgroundColor: '#7c3aed',
            marginBottom: '30px',
            fontWeight: 'bold',
            fontSize: '48px',
          }}
        >
          {logoText}
        </div>
        
        <h1
          style={{
            fontSize: 64,
            fontWeight: 700,
            marginBottom: '20px',
            color: 'white',
          }}
        >
          {title}
        </h1>
        
        {subtitle && (
          <p
            style={{
              fontSize: 32,
              marginBottom: '40px',
              color: '#e2e8f0',
            }}
          >
            {subtitle}
          </p>
        )}
        
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 24px',
            backgroundColor: '#7c3aed',
            borderRadius: 8,
            fontSize: 24,
          }}
        >
          {DATA.url.replace('https://', '')}
        </div>
      </div>
    ),
    { ...DEFAULT_OG_SIZE }
  );
} 