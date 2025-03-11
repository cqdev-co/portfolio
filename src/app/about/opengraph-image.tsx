import { ImageResponse } from 'next/og';
import { DATA } from '@/data/resume';

export const alt = 'About Conor Quinlan - Security Engineer';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function AboutOGImage() {
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
          position: 'relative',
        }}
      >
        {/* Background pattern */}
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
        
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontSize: 64,
              fontWeight: 700,
              margin: '0 0 20px 0',
              background: 'linear-gradient(to right, #9333ea, #4f46e5)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            About Me
          </h1>
          <p
            style={{
              fontSize: 32,
              margin: '0 0 40px 0',
              color: '#e2e8f0',
              maxWidth: '800px',
              lineHeight: 1.4,
            }}
          >
            Security Engineer specializing in cloud security, DevSecOps, and secure infrastructure
          </p>
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
      </div>
    ),
    {
      ...size,
    }
  );
} 