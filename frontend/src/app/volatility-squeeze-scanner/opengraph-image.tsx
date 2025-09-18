import { createOGImage, DEFAULT_OG_SIZE } from '@/lib/og-image';
import { DATA } from '@/data/resume';

export const alt = 'Volatility Squeeze Scanner - Professional Trading Tool';
export const size = DEFAULT_OG_SIZE;
export const contentType = 'image/png';

export default async function VolatilitySqueezeOGImage() {
  return createOGImage({
    title: 'Volatility Squeeze Scanner',
    subtitle: 'Professional trading tool for identifying explosive breakout opportunities',
    logoText: DATA.initials,
    backgroundStyle: 'serene-gold',
  });
}
