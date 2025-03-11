import { DEFAULT_OG_SIZE, createOGImage } from '@/lib/og-image';

export const alt = 'About Conor Quinlan - Security Engineer';
export const size = DEFAULT_OG_SIZE;
export const contentType = 'image/png';

export default async function AboutOGImage() {
  return createOGImage({
    title: 'About Me',
    subtitle: 'Security Engineer specializing in cloud security, DevSecOps, and secure infrastructure',
  });
}