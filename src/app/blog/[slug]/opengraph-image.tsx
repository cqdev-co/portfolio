import { DEFAULT_OG_SIZE, createOGImage } from '@/lib/og-image';
import { DATA } from '@/data/resume';
import { getPost } from '@/data/blog';
import { ImageResponse } from 'next/og';

export const alt = 'Blog post by Conor Quinlan';
export const size = DEFAULT_OG_SIZE;
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

  // Create a date element to be displayed above the title
  const headerElement = (
    <div 
      style={{ 
        fontSize: 24, 
        marginBottom: 20, 
        color: '#d8b4fe', 
        display: 'flex', 
        alignItems: 'center',
        alignSelf: 'flex-start',
        position: 'relative',
        zIndex: 20 
      }}
    >
      <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#d8b4fe', marginRight: 10 }}></div>
      {new Date(post.metadata.publishedAt).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}
    </div>
  );

  // Create a custom footer with author name
  const footerElement = (
    <div style={{ marginTop: 60, display: 'flex', alignItems: 'center', alignSelf: 'flex-start' }}>
      <div style={{ fontWeight: 'bold', marginRight: 16 }}>{DATA.name}</div>
      <div style={{ color: '#a1a1aa' }}>{DATA.url.replace('https://', '')}</div>
    </div>
  );

  // Use our createOGImage utility with custom elements
  return createOGImage({
    title: post.metadata.title,
    subtitle: post.metadata.summary,
    backgroundPattern: true,
    showUrl: false, // We'll use our custom footer instead
    gradientTitle: false, // Solid color for better readability
    alignment: 'start',
    padding: '60px',
    headerElement,
    footerElement,
  });
} 