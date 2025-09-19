import { createOGImage, DEFAULT_OG_SIZE } from '@/lib/og-image';

export const alt = 'Volatility Squeeze Scanner - Professional Trading Tool';
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
