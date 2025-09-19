import { createOGImage, DEFAULT_OG_SIZE } from '@/lib/og-image';

export const alt = 'Volatility Squeeze Scanner - Professional Stock Market Analysis Tool for Day Trading and Swing Trading';
export const size = DEFAULT_OG_SIZE;
export const contentType = 'image/png';

export default async function VolatilitySqueezeOGImage() {
  return createOGImage({
    title: '',
    subtitle: '',
    logoText: '',
    backgroundStyle: 'serene-gold',
  });
}
