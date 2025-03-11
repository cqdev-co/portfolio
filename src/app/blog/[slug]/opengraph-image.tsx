import { ImageResponse } from 'next/og';
import { DATA } from '@/data/resume';
import { getPost } from '@/data/blog';

export const alt = 'Blog post by Conor Quinlan';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function BlogOGImage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  
  if (!post) {
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
            fontFamily: 'sans-serif',
          }}
        >
          <h1 style={{ fontSize: 60 }}>Blog Post Not Found</h1>
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '60px',
          fontFamily: 'sans-serif',
          backgroundImage: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.8) 100%)',
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
        
        {/* Content */}
        <div style={{ zIndex: 10, width: '100%' }}>
          <div 
            style={{ 
              fontSize: 24, 
              marginBottom: 20, 
              color: '#d8b4fe', 
              display: 'flex', 
              alignItems: 'center' 
            }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#d8b4fe', marginRight: 10 }}></div>
            {new Date(post.metadata.publishedAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
          
          <h1 
            style={{ 
              fontSize: 64, 
              fontWeight: 700, 
              margin: 0, 
              marginBottom: 20,
              maxWidth: '800px',
              lineHeight: 1.2,
            }}
          >
            {post.metadata.title}
          </h1>
          
          <p 
            style={{ 
              fontSize: 24, 
              margin: 0, 
              opacity: 0.8,
              maxWidth: '700px',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {post.metadata.summary}
          </p>
          
          <div style={{ marginTop: 60, display: 'flex', alignItems: 'center' }}>
            <div style={{ fontWeight: 'bold', marginRight: 16 }}>{DATA.name}</div>
            <div style={{ color: '#a1a1aa' }}>{DATA.url.replace('https://', '')}</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
} 