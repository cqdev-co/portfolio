import { DATA } from '@/data/resume';
import { DEFAULT_OG_SIZE, createOGImage } from '@/lib/og-image';

export const alt = 'Conor Quinlan - Security Engineer & Software Developer';
export const size = DEFAULT_OG_SIZE;
export const contentType = 'image/png';

export default async function OGImage() {
  return createOGImage({
    title: DATA.name,
    subtitle: DATA.title,
    logoText: DATA.initials,
  });
}