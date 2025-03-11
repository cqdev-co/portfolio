import { DEFAULT_OG_SIZE, createOGImage } from '@/lib/og-image';
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

  return createOGImage({
    title: post.metadata.title,
    subtitle: post.metadata.summary,
  });
} 